"""Shared helpers: retry/backoff, rate limiting, text cleaning, parsing."""
import logging
import random
import re
import time

logger = logging.getLogger("yahoo_scraper")


def retry_with_backoff(fn, *, retries=4, base_delay=2.0, max_delay=30.0, on_error=None):
    """Call `fn()` retrying on exception with exponential backoff + jitter."""
    last_exc = None
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as exc:
            last_exc = exc
            if on_error:
                on_error(attempt, exc)
            if attempt == retries:
                break
            delay = min(max_delay, base_delay * (2 ** attempt)) + random.uniform(0, 1)
            logger.warning(
                "Attempt %d/%d failed (%s); retrying in %.1fs",
                attempt + 1,
                retries + 1,
                exc,
                delay,
            )
            time.sleep(delay)
    raise last_exc


def rate_limit_sleep(min_seconds=2.0, max_seconds=5.0):
    time.sleep(random.uniform(min_seconds, max_seconds))


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


QUARTER_YEAR_RE = re.compile(
    r"\bQ([1-4])\s*(?:FY)?\s*(\d{2,4})\b", re.IGNORECASE
)


def parse_quarter_year(title: str):
    """Extract (fiscal_quarter, fiscal_year) like ('Q1', '2026') from a title."""
    match = QUARTER_YEAR_RE.search(title or "")
    if not match:
        return None, None
    quarter = f"Q{match.group(1)}"
    year = match.group(2)
    if len(year) == 2:
        year = f"20{year}"
    return quarter, year


def transcript_filename(fiscal_year: str, fiscal_quarter: str) -> str:
    return f"{fiscal_year}_{fiscal_quarter}"
