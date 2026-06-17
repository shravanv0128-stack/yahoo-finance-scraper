"""CSV metadata index for scraped transcripts."""
import csv
import os
import threading

FIELDS = [
    "ticker",
    "company_name",
    "sector",
    "fiscal_quarter",
    "fiscal_year",
    "article_title",
    "article_url",
    "publication_date",
    "scrape_timestamp",
    "local_text_path",
    "local_html_path",
    "supabase_status",
    "status",
    "error",
]

_lock = threading.Lock()


class IndexStore:
    def __init__(self, path: str):
        self.path = path
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self._existing = self._load_existing()
        if not os.path.exists(path):
            with open(path, "w", newline="", encoding="utf-8") as fh:
                csv.DictWriter(fh, fieldnames=FIELDS).writeheader()

    def _load_existing(self):
        keys = set()
        if os.path.exists(self.path):
            with open(self.path, newline="", encoding="utf-8") as fh:
                for row in csv.DictReader(fh):
                    keys.add((row.get("ticker"), row.get("fiscal_year"), row.get("fiscal_quarter")))
        return keys

    def already_indexed(self, ticker, fiscal_year, fiscal_quarter):
        return (ticker, fiscal_year, fiscal_quarter) in self._existing

    def append(self, row: dict):
        with _lock:
            with open(self.path, "a", newline="", encoding="utf-8") as fh:
                writer = csv.DictWriter(fh, fieldnames=FIELDS)
                writer.writerow({k: row.get(k, "") for k in FIELDS})
            self._existing.add((row.get("ticker"), row.get("fiscal_year"), row.get("fiscal_quarter")))
