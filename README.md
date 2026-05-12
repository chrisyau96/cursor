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

## Beauty device trend sourcing script (Apify + AI)

Use `beauty_device_trend_sourcing.py` to discover trendy foreign beauty devices from social sources (`Xiaohongshu`, `Instagram`, `TikTok`, `X`) for Hong Kong sourcing trials.

### Required environment variables

- `APIFY_API_TOKEN`
- `APIFY_ACTOR_XHS_ID`
- `APIFY_ACTOR_INSTAGRAM_ID`
- `APIFY_ACTOR_TIKTOK_ID`
- `APIFY_ACTOR_X_ID`

Optional:

- `MISTRAL_API_KEY` (AI extraction + source-date validation)
- `BRAVE_API_KEY` (distributor-site lookup)

### Run

```bash
python beauty_device_trend_sourcing.py \
  --min-results-per-source 3 \
  --max-results-per-source 5
```

Offline dry-run with fixture:

```bash
python beauty_device_trend_sourcing.py \
  --offline-fixture sample_apify_fixture.json \
  --skip-distributor-search
```
