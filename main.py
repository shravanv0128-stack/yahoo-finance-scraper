"""CLI entry point for the Yahoo Finance earnings call transcript scraper."""
import argparse
import csv
import logging
import os
import sys

from scraper.core import run

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("yahoo_scraper")


def load_companies_from_csv(path):
    companies = []
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            if not row.get("ticker"):
                continue
            companies.append(
                {
                    "ticker": row["ticker"],
                    "company_name": row.get("company_name", ""),
                    "sector": row.get("sector", ""),
                }
            )
    return companies


def main():
    parser = argparse.ArgumentParser(
        description="Scrape Yahoo Finance earnings call transcripts."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--input-csv", help="CSV file with columns: ticker, company_name, sector")
    source.add_argument(
        "--tickers", nargs="+", help="One or more tickers to scrape, e.g. --tickers AAPL MSFT"
    )
    parser.add_argument(
        "--limit", type=int, default=4, help="Max transcripts to download per ticker (default: 4)"
    )
    parser.add_argument(
        "--resume", action="store_true", help="Skip tickers/quarters already downloaded locally"
    )
    parser.add_argument(
        "--out-dir", default="data", help="Output directory root (default: data)"
    )
    parser.add_argument(
        "--headed", action="store_true", help="Run the browser with a visible UI (default: headless)"
    )
    args = parser.parse_args()

    if args.input_csv:
        if not os.path.exists(args.input_csv):
            logger.error("Input CSV not found: %s", args.input_csv)
            sys.exit(1)
        companies = load_companies_from_csv(args.input_csv)
    else:
        companies = [{"ticker": t, "company_name": "", "sector": ""} for t in args.tickers]

    if not companies:
        logger.error("No tickers to process.")
        sys.exit(1)

    run(companies, limit=args.limit, resume=args.resume, out_dir=args.out_dir, headless=not args.headed)


if __name__ == "__main__":
    main()
