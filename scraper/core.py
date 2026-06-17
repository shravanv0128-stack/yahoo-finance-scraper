"""Core Playwright scraping logic for Yahoo Finance earnings call transcripts.

Transcripts are not reachable via plain anchor links on the quote page; Yahoo
renders the quote/article pages via SvelteKit and embeds the API responses it
fetched server-side as JSON inside <script type="application/json"
data-sveltekit-fetched data-url="..."> tags. We piggyback on that: load the
quote page once to harvest a crumb token, then call the same internal APIs
the page itself used (quote -> quartrId, quoteSummary -> transcript list,
/xhr/transcript -> full speaker-attributed transcript text).
"""
import datetime
import json
import logging
import os
import re

from playwright.sync_api import sync_playwright

from . import robots
from .index_store import IndexStore
from .supabase_client import upsert_transcript
from .utils import clean_text, rate_limit_sleep, retry_with_backoff, transcript_filename

logger = logging.getLogger("yahoo_scraper")

YAHOO_BASE = "https://finance.yahoo.com/quote/{ticker}"
CRUMB_RE = re.compile(r"crumb=([A-Za-z0-9_\-%]+)")


class Stats:
    def __init__(self):
        self.companies_processed = 0
        self.transcripts_found = 0
        self.transcripts_downloaded = 0
        self.supabase_succeeded = 0
        self.supabase_failed = 0
        self.failures = 0
        self.skipped = 0

    def summary(self):
        return (
            "\n===== SCRAPE SUMMARY =====\n"
            f"Companies processed:      {self.companies_processed}\n"
            f"Transcripts found:        {self.transcripts_found}\n"
            f"Transcripts downloaded:   {self.transcripts_downloaded}\n"
            f"Supabase inserts OK:      {self.supabase_succeeded}\n"
            f"Supabase inserts failed:  {self.supabase_failed}\n"
            f"Failures:                 {self.failures}\n"
            f"Skipped (resume):         {self.skipped}\n"
            "==========================="
        )


def _extract_crumb(html: str):
    match = CRUMB_RE.search(html)
    return match.group(1) if match else None


def _api_get(browser_context, url):
    """GET `url` through the browser context (shares cookies/session) and parse JSON."""
    resp = browser_context.request.get(url)
    if not resp.ok:
        raise RuntimeError(f"HTTP {resp.status} for {url}")
    return resp.json()


def _get_quartr_id(browser_context, ticker, crumb):
    url = (
        f"https://query1.finance.yahoo.com/v7/finance/quote"
        f"?symbols={ticker}&crumb={crumb}"
    )
    if not robots.is_allowed(url):
        raise RuntimeError(f"robots.txt disallows {url}")
    data = _api_get(browser_context, url)
    results = data.get("quoteResponse", {}).get("result", [])
    if not results:
        raise RuntimeError(f"No quote result for {ticker}")
    quartr_id = results[0].get("quartrId")
    if not quartr_id:
        raise RuntimeError(f"No quartrId for {ticker}")
    return quartr_id


def _get_transcript_list(browser_context, ticker, crumb):
    url = (
        f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}"
        f"?modules=earningsCallTranscripts&crumb={crumb}"
    )
    if not robots.is_allowed(url):
        raise RuntimeError(f"robots.txt disallows {url}")
    data = _api_get(browser_context, url)
    results = data.get("quoteSummary", {}).get("result", [])
    if not results:
        return []
    module = results[0].get("earningsCallTranscripts", {})
    return module.get("transcripts", [])


def _get_transcript_content(browser_context, quartr_id, event_id, crumb):
    url = (
        f"https://finance.yahoo.com/xhr/transcript"
        f"?eventType=earnings_call&quartrId={quartr_id}&eventId={event_id}&crumb={crumb}"
    )
    if not robots.is_allowed(url):
        raise RuntimeError(f"robots.txt disallows {url}")
    return _api_get(browser_context, url)


def _build_transcript_text(transcript_content):
    content = transcript_content.get("transcriptContent", {})
    speaker_mapping = {
        s.get("speaker"): s.get("speaker_data", {})
        for s in content.get("speaker_mapping", [])
    }
    transcript = content.get("transcript", {})
    paragraphs = transcript.get("paragraphs", [])

    if not paragraphs:
        return clean_text(transcript.get("text", ""))

    lines = []
    last_speaker = object()
    for para in paragraphs:
        speaker_id = para.get("speaker")
        text = (para.get("text") or "").strip()
        if not text:
            continue
        if speaker_id != last_speaker:
            speaker = speaker_mapping.get(speaker_id, {})
            name = speaker.get("name") or "Unknown Speaker"
            role = speaker.get("role")
            company = speaker.get("company")
            label_parts = [p for p in (role, company) if p]
            label = f"{name} ({', '.join(label_parts)})" if label_parts else name
            lines.append(f"\n{label}:")
            last_speaker = speaker_id
        lines.append(text)

    return clean_text("\n".join(lines))


def scrape_ticker(
    browser_context,
    ticker: str,
    company_name: str,
    sector: str,
    limit: int,
    stats: Stats,
    index_store: IndexStore,
    out_dir: str,
    resume: bool,
):
    url = YAHOO_BASE.format(ticker=ticker)

    if not robots.is_allowed(url):
        logger.warning("robots.txt disallows fetching %s; skipping ticker.", ticker)
        stats.failures += 1
        return

    page = browser_context.new_page()
    try:
        def load():
            page.goto(url, timeout=30000, wait_until="domcontentloaded")

        retry_with_backoff(load, on_error=lambda a, e: None)
        html = page.content()
    finally:
        page.close()

    crumb = _extract_crumb(html)
    if not crumb:
        logger.warning("Could not extract crumb for %s; skipping ticker.", ticker)
        stats.failures += 1
        return

    try:
        quartr_id = retry_with_backoff(
            lambda: _get_quartr_id(browser_context, ticker, crumb),
            on_error=lambda a, e: None,
        )
        transcripts = retry_with_backoff(
            lambda: _get_transcript_list(browser_context, ticker, crumb),
            on_error=lambda a, e: None,
        )
    except Exception as exc:
        logger.warning("Could not fetch transcript list for %s: %s", ticker, exc)
        stats.failures += 1
        return

    if not transcripts:
        logger.info("No transcripts found for %s", ticker)
        return

    # Most recent first.
    transcripts = sorted(transcripts, key=lambda t: t.get("date", 0), reverse=True)
    items = transcripts[:limit]
    stats.transcripts_found += len(items)

    for entry in items:
        title = entry.get("title", "")
        quarter = entry.get("fiscalPeriod")
        year = entry.get("fiscalYear")
        href = entry.get("url", "")
        event_id = entry.get("eventId")
        pub_date = entry.get("date", "")

        if not quarter or not year or not event_id:
            logger.warning("Incomplete transcript entry for %s: %s; skipping.", ticker, title)
            stats.failures += 1
            continue

        year = str(year)

        if index_store.already_indexed(ticker, year, quarter):
            logger.info("Skipping already-indexed %s %s %s (resume)", ticker, year, quarter)
            stats.skipped += 1
            continue

        fname = transcript_filename(year, quarter)
        text_path = os.path.join(out_dir, "transcripts", ticker, f"{fname}.txt")
        html_path = os.path.join(out_dir, "raw_html", ticker, f"{fname}.html")

        if resume and os.path.exists(text_path):
            logger.info("Resume: local file exists for %s %s %s, skipping download.", ticker, year, quarter)
            stats.skipped += 1
            continue

        rate_limit_sleep()
        try:
            transcript_content = retry_with_backoff(
                lambda: _get_transcript_content(browser_context, quartr_id, event_id, crumb),
                on_error=lambda a, e: None,
            )
            text = _build_transcript_text(transcript_content)
            raw_json = json.dumps(transcript_content, indent=2)
        except Exception as exc:
            logger.error("Failed to fetch transcript for %s %s %s: %s", ticker, year, quarter, exc)
            stats.failures += 1
            _record(
                index_store, stats, ticker, company_name, sector, quarter, year,
                title, href, pub_date, "", "", "failed", str(exc),
            )
            continue

        if not text or len(text) < 200:
            stats.failures += 1
            _record(
                index_store, stats, ticker, company_name, sector, quarter, year,
                title, href, pub_date, "", "", "unavailable", "Transcript content not accessible",
            )
            continue

        os.makedirs(os.path.dirname(text_path), exist_ok=True)
        os.makedirs(os.path.dirname(html_path), exist_ok=True)
        with open(text_path, "w", encoding="utf-8") as fh:
            fh.write(text)
        with open(html_path, "w", encoding="utf-8") as fh:
            fh.write(raw_json)

        stats.transcripts_downloaded += 1
        scrape_ts = datetime.datetime.utcnow().isoformat()

        record = {
            "ticker": ticker,
            "company_name": company_name,
            "fiscal_quarter": quarter,
            "fiscal_year": year,
            "article_title": title,
            "article_url": href,
            "publication_date": pub_date,
            "transcript_text": text,
            "scrape_timestamp": scrape_ts,
        }
        ok = upsert_transcript(record)
        if ok:
            stats.supabase_succeeded += 1
        else:
            stats.supabase_failed += 1

        _record(
            index_store, stats, ticker, company_name, sector, quarter, year,
            title, href, pub_date, text_path, html_path, "downloaded",
            "" if ok else "supabase_upsert_failed",
            supabase_status="success" if ok else "failed",
            scrape_timestamp=scrape_ts,
        )


def _record(
    index_store, stats, ticker, company_name, sector, quarter, year,
    title, href, pub_date, text_path, html_path, status, error,
    supabase_status="", scrape_timestamp="",
):
    index_store.append(
        {
            "ticker": ticker,
            "company_name": company_name,
            "sector": sector,
            "fiscal_quarter": quarter,
            "fiscal_year": year,
            "article_title": title,
            "article_url": href,
            "publication_date": pub_date,
            "scrape_timestamp": scrape_timestamp or datetime.datetime.utcnow().isoformat(),
            "local_text_path": text_path,
            "local_html_path": html_path,
            "supabase_status": supabase_status,
            "status": status,
            "error": error,
        }
    )


def run(companies, limit, resume, out_dir, headless=True):
    stats = Stats()
    index_path = os.path.join(out_dir, "metadata", "transcripts_index.csv")
    index_store = IndexStore(index_path)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
            )
        )
        try:
            for company in companies:
                ticker = company["ticker"].strip().upper()
                company_name = company.get("company_name", "").strip()
                sector = company.get("sector", "").strip()
                logger.info("Processing %s (%s)", ticker, company_name or "unknown company")
                try:
                    scrape_ticker(
                        context, ticker, company_name, sector, limit, stats,
                        index_store, out_dir, resume,
                    )
                except Exception as exc:
                    logger.error("Unhandled error processing %s: %s", ticker, exc)
                    stats.failures += 1
                stats.companies_processed += 1
                rate_limit_sleep(3.0, 8.0)
        finally:
            context.close()
            browser.close()

    logger.info(stats.summary())
    return stats
