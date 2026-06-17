"""Supabase upsert helper for transcript records."""
import logging
import os

logger = logging.getLogger("yahoo_scraper")

_client = None
_client_initialized = False


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


def upsert_transcript(record: dict) -> bool:
    """Upsert a transcript record into the `transcripts` table.

    Conflict target is (ticker, fiscal_year, fiscal_quarter). Returns True on
    success, False on failure. Never raises - failures are logged so the
    caller can continue processing other transcripts.
    """
    client = get_client()
    if client is None:
        return False

    try:
        client.table("transcripts").upsert(
            record, on_conflict="ticker,fiscal_year,fiscal_quarter"
        ).execute()
        return True
    except Exception as exc:
        logger.error(
            "Supabase upsert failed for %s %s %s: %s",
            record.get("ticker"),
            record.get("fiscal_year"),
            record.get("fiscal_quarter"),
            exc,
        )
        return False
