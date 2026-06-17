# Yahoo Finance Earnings Call Transcript Scraper

Scrapes earnings call transcript articles linked from Yahoo Finance quote
pages (`https://finance.yahoo.com/quote/{TICKER}`), saves them locally, and
upserts them into a Supabase table.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

### Supabase credentials

Set these environment variables before running (never hardcode them):

```bash
export SUPABASE_URL="https://<your-project>.supabase.co"
export SUPABASE_KEY="<your-service-or-anon-key>"
```

If unset, the scraper logs a warning and skips Supabase upserts, but local
files and the CSV index are still written.

### Create the Supabase table

Run this in the Supabase SQL editor:

```sql
create table if not exists transcripts (
    id bigint generated always as identity primary key,
    ticker text not null,
    company_name text,
    fiscal_quarter text not null,
    fiscal_year text not null,
    article_title text,
    article_url text,
    publication_date text,
    transcript_text text,
    scrape_timestamp timestamptz,
    unique (ticker, fiscal_year, fiscal_quarter)
);
```

The `unique (ticker, fiscal_year, fiscal_quarter)` constraint is required for
the upsert logic (`on_conflict="ticker,fiscal_year,fiscal_quarter"`) to avoid
duplicate rows on re-runs.

## Usage

From a CSV of companies (columns: `ticker, company_name, sector`):

```bash
python main.py --input-csv companies.sample.csv --limit 4
```

From an explicit ticker list:

```bash
python main.py --tickers AAPL MSFT TSLA --limit 4
```

Resume a previous run, skipping tickers/quarters already downloaded locally:

```bash
python main.py --input-csv companies.sample.csv --resume
```

Run with a visible browser window (useful for debugging):

```bash
python main.py --tickers AAPL --headed
```

## Output layout

```
data/
  transcripts/{TICKER}/{fiscal_year}_{quarter}.txt   # cleaned transcript text
  raw_html/{TICKER}/{fiscal_year}_{quarter}.html      # raw article HTML
  metadata/transcripts_index.csv                      # one row per transcript attempt
```

`transcripts_index.csv` includes a `status` column (`downloaded`,
`unavailable`, `failed`) and `supabase_status` (`success`, `failed`, or
empty) so you can audit what succeeded.

## Behavior notes

- **robots.txt** is checked before fetching any quote page or article; URLs
  disallowed by `https://finance.yahoo.com/robots.txt` are marked
  `unavailable` and skipped — the scraper never bypasses paywalls or login
  walls.
- **Retries**: page loads use exponential backoff (up to 4 retries).
- **Rate limiting**: randomized delays between article requests and between
  tickers to avoid hammering the site.
- **Resume**: `--resume` skips tickers/quarters whose local `.txt` file
  already exists or that are already present in the metadata index.
- **Supabase failures never crash the run**: if an upsert fails, the error is
  logged, local files are kept, and the scraper moves to the next
  transcript.
- A run summary (companies processed, transcripts found/downloaded, Supabase
  successes/failures, failures, skips) is logged at the end of each run.
