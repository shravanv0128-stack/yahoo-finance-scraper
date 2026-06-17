"""robots.txt compliance helper for finance.yahoo.com."""
import logging
import urllib.robotparser

logger = logging.getLogger("yahoo_scraper")

ROBOTS_URL = "https://finance.yahoo.com/robots.txt"
USER_AGENT = "YahooFinanceTranscriptScraper/1.0"

_parser = None


def _load_parser():
    global _parser
    if _parser is not None:
        return _parser
    parser = urllib.robotparser.RobotFileParser()
    parser.set_url(ROBOTS_URL)
    try:
        parser.read()
    except Exception as exc:
        logger.warning("Could not fetch robots.txt (%s); defaulting to deny.", exc)
        parser = None
    _parser = parser
    return _parser


def is_allowed(url: str) -> bool:
    """Check whether `url` may be fetched per finance.yahoo.com robots.txt."""
    parser = _load_parser()
    if parser is None:
        return False
    try:
        return parser.can_fetch(USER_AGENT, url)
    except Exception:
        return False
