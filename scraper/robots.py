"""robots.txt compliance helper, keyed per-domain.

The scraper talks to both finance.yahoo.com (page loads, /xhr/transcript)
and query1.finance.yahoo.com (quoteSummary/quote APIs), so robots.txt is
fetched and cached separately for each host actually requested.
"""
import logging
import urllib.robotparser
from urllib.parse import urlparse

logger = logging.getLogger("yahoo_scraper")

USER_AGENT = "YahooFinanceTranscriptScraper/1.0"

_parsers = {}


def _load_parser(netloc: str):
    if netloc in _parsers:
        return _parsers[netloc]
    parser = urllib.robotparser.RobotFileParser()
    parser.set_url(f"https://{netloc}/robots.txt")
    try:
        parser.read()
    except Exception as exc:
        logger.warning("Could not fetch robots.txt for %s (%s); defaulting to deny.", netloc, exc)
        parser = None
    _parsers[netloc] = parser
    return parser


def is_allowed(url: str) -> bool:
    """Check whether `url` may be fetched per its host's robots.txt."""
    netloc = urlparse(url).netloc
    parser = _load_parser(netloc)
    if parser is None:
        return False
    try:
        return parser.can_fetch(USER_AGENT, url)
    except Exception:
        return False
