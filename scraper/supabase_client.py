"""Supabase upsert helper for transcript documents.

Targets the existing `documents` table (shared with the companies/chunks
RAG pipeline), not a standalone `transcripts` table. The table's only
unique constraint is on `external_id`, so that's the upsert conflict key -
re-running the scraper for the same ticker/quarter updates the existing row
instead of inserting a duplicate.
"""
import logging
import os

logger = logging.getLogger("yahoo_scraper")

_client = None
_client_initialized = False
_company_id_cache = {}


def get_client():
    """Lazily create and cache a Supabase client from env vars, or None if unavailable."""
    global _client, _client_initialized
    if _client_initialized:
        return _client
    _client_initialized = True

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        logger.warning(
            "SUPABASE_URL / SUPABASE_KEY not set; skipping Supabase upserts."
        )
        return None

    try:
        from supabase import create_client

        _client = create_client(url, key)
    except Exception as exc:
        logger.error("Failed to initialize Supabase client: %s", exc)
        _client = None
    return _client


def _lookup_company_id(client, ticker: str):
    """Look up companies.id by ticker, caching results. Returns None if not found."""
    if ticker in _company_id_cache:
        return _company_id_cache[ticker]
    try:
        resp = client.table("companies").select("id").eq("ticker", ticker).limit(1).execute()
        company_id = resp.data[0]["id"] if resp.data else None
    except Exception as exc:
        logger.warning("Could not look up company_id for %s: %s", ticker, exc)
        company_id = None
    _company_id_cache[ticker] = company_id
    return company_id


def external_id_for(ticker: str, fiscal_year: str, fiscal_quarter: str) -> str:
    return f"YF-{ticker}-{fiscal_year}-{fiscal_quarter}-transcript"


def upsert_transcript(record: dict) -> bool:
    """Upsert a transcript into the `documents` table.

    `record` must contain: ticker, company_name (unused, kept for the local
    CSV index), fiscal_quarter, fiscal_year, article_title, article_url,
    publication_date, transcript_text, scrape_timestamp.

    Conflict target is `external_id`, built deterministically from
    ticker/fiscal_year/fiscal_quarter so re-runs update the same row rather
    than inserting a duplicate. Returns True on success, False on failure -
    never raises, so callers can keep local files and continue on error.
    """
    client = get_client()
    if client is None:
        return False

    ticker = record["ticker"]
    fiscal_year = record["fiscal_year"]
    fiscal_quarter = record["fiscal_quarter"]

    doc_row = {
        "company_id": _lookup_company_id(client, ticker),
        "ticker": ticker,
        "doc_type": "transcript",
        "fiscal_year": int(fiscal_year),
        "fiscal_quarter": fiscal_quarter,
        "filing_date": record.get("publication_date") or None,
        "source_url": record["article_url"],
        "title": record["article_title"],
        "raw_text": record["transcript_text"],
        "external_id": external_id_for(ticker, fiscal_year, fiscal_quarter),
    }

    try:
        client.table("documents").upsert(doc_row, on_conflict="external_id").execute()
        return True
    except Exception as exc:
        logger.error(
            "Supabase upsert failed for %s %s %s: %s",
            ticker,
            fiscal_year,
            fiscal_quarter,
            exc,
        )
        return False
