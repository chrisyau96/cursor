# Project Opportunity Dashboard

This repository contains a local Python dashboard for reviewing improvement ideas from an Excel workbook.

The app helps you quickly spot quick wins and higher-priority projects by combining:

- KPI cards for project count, quick wins, average scores, and high-impact / low-effort items
- An impact-vs-effort scatter chart with 0-to-5 axes and project summaries shown on the dots
- Extra charts for project status/type, department ownership, and proposed tools
- A filterable table with a department filter, plus status, project type, tool, impact, and effort filters

## Expected Excel columns

Upload an `.xlsx` or `.xls` file with these columns:

| Column |
| --- |
| Item # |
| Project Type |
| Status |
| Summary |
| Current Flow |
| Opportunity to Improve |
| Proposed Tools |
| Impact |
| Impact Score |
| Solution Effort Score |
| Involved Dept |
| Discussion Dept |

`Impact Score` and `Solution Effort Score` should use a 0 to 5 scale. Department and tool cells can contain numbered lists, bullet lists, new lines, commas, or semicolons.

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

Open the local Streamlit URL shown in the terminal, then upload your Excel file. If no file is uploaded, the app displays the sample data from the request.

---

## Foreign-Market Beauty Device Scanner

`beauty_device_scanner.py` is a separate script that finds newly launched B2C
home-use electronic beauty devices in foreign markets (Japan, Korea, China,
Taiwan, US, UK, etc.) and writes a single Excel workbook for Hong Kong
sourcing review.

### What it does

1. **Social discovery via Apify** for Xiaohongshu (XHS), TikTok, Instagram
   and X (Twitter).
2. **Web discovery via Brave Search** across curated retailer / press
   domains (CurrentBody, Sephora, Amazon JP, Rakuten, @cosme, Olive Young,
   Hwahae, momoshop, BeautyMatter, PR Newswire).
3. **YouTube discovery** via the YouTube Data API.
4. **AI validation with Mistral** — every candidate is sent to Mistral for
   structured product extraction with strict inclusion/exclusion rules for
   the HK retail context.
5. **AI launch-date triangulation** — instead of trusting only the page
   date, the script runs a second Brave search per shortlisted product and
   asks Mistral to triangulate the most credible launch date from multiple
   snippets. Each row records the AI-confidence (`High` / `Medium` / `Low`).
6. **AI distributor / reseller lookup** — for each shortlisted product the
   script searches Brave for "distributor / reseller / official store" in
   Hong Kong, China and Asia, then asks Mistral to extract structured
   contact leads.
7. **Excel export** with embedded product thumbnails.

### Configure

Set API keys via environment variables (or use the defaults baked into the
script for a quick trial):

```bash
export BRAVE_API_KEY=...
export MISTRAL_API_KEY=...
export YOUTUBE_API_KEY=...
export APIFY_API_TOKEN=...
# Optional: override the Apify actor IDs
export APIFY_ACTOR_XHS=easyapi/xiaohongshu-search-scraper
export APIFY_ACTOR_TIKTOK=clockworks/tiktok-scraper
export APIFY_ACTOR_INSTAGRAM=apify/instagram-hashtag-scraper
export APIFY_ACTOR_X=apidojo/tweet-scraper
```

### Run

```bash
pip install -r requirements.txt

# Quick smoke test (no network)
python beauty_device_scanner.py --dry-run --output trial.xlsx

# Real scan, 3 products per source, last 120 days
python beauty_device_scanner.py --per-source 3 --days-lookback 120 \
    --output foreign_beauty_device_scan.xlsx

# Only run the social channel
python beauty_device_scanner.py --channels social --per-source 5

# Skip distributor lookup to save quota
python beauty_device_scanner.py --skip-distributor
```

`--per-source` defaults to **3** (sweet spot for the trial run). Anything
in the 3-5 range is recommended.
