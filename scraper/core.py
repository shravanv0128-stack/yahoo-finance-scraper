"""Core Playwright scraping logic for Yahoo Finance earnings call transcripts."""
import datetime
import logging
import os
import re

from playwright.sync_api import sync_playwright

from . import robots
from .index_store import IndexStore
from .supabase_client import upsert_transcript
from .utils import (
    clean_text,
    parse_quarter_year,
    rate_limit_sleep,
    retry_with_backoff,
    transcript_filename,
)

logger = logging.getLogger("yahoo_scraper")

YAHOO_BASE = "https://finance.yahoo.com/quote/{ticker}"
TRANSCRIPT_TITLE_RE = re.compile(
    r"\b[A-Z.\-]{1,10}\s+Q[1-4]\s*(?:FY)?\s*\d{2,4}\s+earnings\s+call\s+transcript\b",
    re.IGNORECASE,
)

COOKIE_BUTTON_SELECTORS = [
    "button[name='agree']",
    "button:has-text('Accept all')",
    "button:has-text('Accept')",
    "button:has-text('I agree')",
    "form[action*='consent'] button",
]


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


def _dismiss_consent(page):
    for selector in COOKIE_BUTTON_SELECTORS:
        try:
            locator = page.locator(selector)
            if locator.count() > 0:
                locator.first.click(timeout=3000)
                page.wait_for_timeout(500)
                return
        except Exception:
            continue


def _scroll_to_load(page, rounds=6):
    for _ in range(rounds):
        page.mouse.wheel(0, 2000)
        page.wait_for_timeout(700)


def _find_transcript_links(page, ticker):
    anchors = page.locator("a").all()
    found = {}
    for a in anchors:
        try:
            title = (a.text_content() or "").strip()
            href = a.get_attribute("href")
        except Exception:
            continue
        if not title or not href:
            continue
        if "transcript" not in title.lower():
            continue
        if ticker.lower() not in title.lower() and ticker.upper() not in title:
            continue
        if not TRANSCRIPT_TITLE_RE.search(title):
            continue
        if href.startswith("/"):
            href = "https://finance.yahoo.com" + href
        found[href] = title
    return found


def _extract_publication_date(page):
    try:
        time_el = page.locator("time").first
        if time_el.count() > 0:
            return time_el.get_attribute("datetime") or time_el.text_content()
    except Exception:
        pass
    return ""


def _extract_article_text(page):
    selectors = [
        "div.caas-body",
        "article",
        "div[data-testid='article-content']",
    ]
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() > 0:
                text = loc.inner_text()
                if text and len(text) > 200:
                    return text
        except Exception:
            continue
    try:
        return page.locator("body").inner_text()
    except Exception:
        return ""


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
        _dismiss_consent(page)
        _scroll_to_load(page)

        links = _find_transcript_links(page, ticker)
        if not links:
            logger.info("No transcript links found for %s", ticker)
            page.close()
            return

        items = list(links.items())[:limit]
        stats.transcripts_found += len(items)

        for href, title in items:
            quarter, year = parse_quarter_year(title)
            if not quarter or not year:
                logger.warning("Could not parse quarter/year from title '%s'; skipping.", title)
                stats.failures += 1
                continue

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

            if not robots.is_allowed(href):
                logger.warning("robots.txt disallows article %s; marking unavailable.", href)
                _record(
                    index_store, stats, ticker, company_name, sector, quarter, year,
                    title, href, "", "", "", "unavailable", "Disallowed by robots.txt",
                )
                continue

            rate_limit_sleep()
            status, error, text, html, pub_date = _fetch_article(browser_context, href)

            if status != "ok":
                stats.failures += 1
                _record(
                    index_store, stats, ticker, company_name, sector, quarter, year,
                    title, href, pub_date, "", "", status, error,
                )
                continue

            os.makedirs(os.path.dirname(text_path), exist_ok=True)
            os.makedirs(os.path.dirname(html_path), exist_ok=True)
            with open(text_path, "w", encoding="utf-8") as fh:
                fh.write(text)
            with open(html_path, "w", encoding="utf-8") as fh:
                fh.write(html)

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
    finally:
        page.close()


def _fetch_article(browser_context, href):
    page = browser_context.new_page()
    try:
        def load():
            page.goto(href, timeout=30000, wait_until="domcontentloaded")

        retry_with_backoff(load, on_error=lambda a, e: None)
        _dismiss_consent(page)
        _scroll_to_load(page, rounds=3)

        html = page.content()
        text = clean_text(_extract_article_text(page))
        pub_date = _extract_publication_date(page)

        if not text or len(text) < 200:
            return "unavailable", "Transcript content not accessible (possible paywall/auth)", "", html, pub_date

        return "ok", "", text, html, pub_date
    except Exception as exc:
        logger.error("Failed to fetch article %s: %s", href, exc)
        return "failed", str(exc), "", "", ""
    finally:
        page.close()


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
