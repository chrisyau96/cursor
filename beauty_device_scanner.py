#!/usr/bin/env python3
"""
HK Beauty Device Trend Scanner
================================
Scans XHS (Xiaohongshu), TikTok, Instagram, and X (Twitter/X) via Apify
for trending home-use electronic beauty devices from foreign markets.
Designed for Hong Kong product-sourcing teams to surface new B2C devices.

Key capabilities
----------------
• Apify-powered social scraping  — XHS, TikTok, Instagram, X
• AI-enhanced date validation    — Mistral reasons over every available date
  signal (metadata, relative phrases, seasonal cues, launch language)
• Distributor / sourcing search  — Brave Search + Mistral AI
• 3-5 validated results per platform  (configurable via RESULTS_PER_PLATFORM)
• Excel workbook with embedded product images, colour-coded relevance,
  and a Priority Summary sheet

Setup
-----
1. Verify API keys in SECTION 1 – CONFIGURATION (or set env vars).
2. Install:  pip install requests openpyxl pillow python-dateutil
3. Check APIFY_ACTOR_IDS — update any expired actor slugs.
   Find actors at:  https://apify.com/store
4. Run:  python beauty_device_scanner.py
5. Open: hk_beauty_device_trends.xlsx
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import os
import re
import tempfile
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

import requests
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XLImage
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from PIL import Image, ImageOps, UnidentifiedImageError


# =============================================================================
# SECTION 1 – CONFIGURATION
# =============================================================================

# --------------- API credentials (env vars take precedence) ------------------
BRAVE_API_KEY   = os.getenv("BRAVE_API_KEY",   "BSAkcO77ShLyojFQMX8ZJ8x0aPZrUIi")
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY",  "IDNIEe6IhIIIIsQPHgM8Uao6N1qwdZEr")
APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN",  "apify_api_2LIxymIcu8oSy4CrF8iXiAP5iJJmrX09ju4e")

# --------------- Apify actor IDs ---------------------------------------------
# Format:  "author/actor-name"   (as shown on https://apify.com/store)
# Set to "" to skip a platform entirely.
#
# Recommended actors to verify / replace if 404:
#   XHS       → search "xiaohongshu scraper" on Apify Store
#   TikTok    → "clockworks/free-tiktok-scraper"  (free, maintained)
#   Instagram → "apify/instagram-hashtag-scraper" (official)
#   X/Twitter → "quacker/twitter-scraper"  or  "apidojo/tweet-scraper"
APIFY_ACTOR_IDS: Dict[str, str] = {
    # easyapi/rednote-xiaohongshu-search-scraper  — most-used XHS search actor (44 000+ runs)
    "XHS":       "easyapi/rednote-xiaohongshu-search-scraper",
    # clockworks/free-tiktok-scraper              — widely used free TikTok actor
    "TikTok":    "clockworks/free-tiktok-scraper",
    # apify/instagram-hashtag-scraper             — official Apify Instagram actor
    "Instagram": "apify/instagram-hashtag-scraper",
    # quacker/twitter-scraper                     — well-maintained X/Twitter actor
    "X":         "quacker/twitter-scraper",
}

# --------------- Scan settings -----------------------------------------------
OUTPUT_FILE          = "hk_beauty_device_trends.xlsx"
DAYS_LOOKBACK        = 90    # Scan window (days back from today)
RESULTS_PER_PLATFORM = 5     # Max products per platform  (target 3-5)
MIN_ENGAGEMENT       = 50    # Minimum combined likes/views/comments

# --------------- AI / request settings ---------------------------------------
REQUEST_TIMEOUT   = 45       # seconds
SLEEP_CALLS       = 1.5      # general inter-call pause
SLEEP_MISTRAL     = 7.0      # extra spacing for Mistral rate limits
MISTRAL_MODEL     = "mistral-small-latest"
MISTRAL_API_BASE  = "https://api.mistral.ai/v1"

# --------------- Per-platform search configuration ---------------------------
# actor_input: sent directly to the Apify actor as its start input.
# keywords:    also used in distributor search queries.
PLATFORM_CONFIG: Dict[str, Dict[str, Any]] = {
    "XHS": {
        # RedNote / Xiaohongshu — primary Chinese beauty social platform
        # Actor: easyapi/rednote-xiaohongshu-search-scraper
        "market": "Mainland China / Chinese-language markets",
        "keywords": ["美容仪 新品", "美容家电 新款", "LED面膜仪 测评", "射频仪 推荐", "微电流美容仪"],
        "actor_input": {
            "keyword": "美容仪 新品",          # primary search keyword
            "maxItems": RESULTS_PER_PLATFORM * 6,
            "sortType": "latest",             # latest posts first
        },
    },
    "TikTok": {
        # TikTok — global viral content; strong beauty-device trend signal
        # Actor: clockworks/free-tiktok-scraper
        "market": "International / US / Southeast Asia",
        "keywords": ["beauty device new", "LED face mask", "skincare device"],
        "actor_input": {
            "hashtags": ["beautydevice", "ledmask", "skincaredevice", "rfdevice", "microcurrent"],
            "searchQueries": ["beauty device new launch", "LED mask skincare"],
            "resultsPerPage": RESULTS_PER_PLATFORM * 5,
            "maxItems": RESULTS_PER_PLATFORM * 8,
            "shouldDownloadVideos": False,
            "shouldDownloadCovers": False,
        },
    },
    "Instagram": {
        # Instagram — beauty influencer and brand-launch presence
        # Actor: apify/instagram-hashtag-scraper
        "market": "International / Western markets",
        "keywords": ["beautydevice", "ledmask", "skincaretech", "beautytech", "rfdevice"],
        "actor_input": {
            "hashtags": ["beautydevice", "ledmask", "skincaredevice", "beautytool"],
            "resultsLimit": RESULTS_PER_PLATFORM * 8,
        },
    },
    "X": {
        # X (Twitter) — industry news, brand announcements, trend signal
        # Actor: quacker/twitter-scraper
        "market": "International / US",
        "keywords": ["beauty device new launch", "LED face mask review", "skincare device"],
        "actor_input": {
            "searchTerms": ["beauty device new launch", "new LED mask skincare", "RF facial device review"],
            "maxItems": RESULTS_PER_PLATFORM * 8,
            "sort": "Latest",
        },
    },
}

# --------------- Excel column definitions  (name, width) ---------------------
COLUMNS: List[Tuple[str, int]] = [
    ("Platform",                    13),
    ("Market",                      28),
    ("Product Name",                34),
    ("Brand",                       20),
    ("Category",                    22),
    ("Key Features / Selling Points", 48),
    ("AI-Validated Date",           20),
    ("Date Confidence",             15),
    ("Price",                       14),
    ("Engagement Metrics",          32),
    ("HK Market Relevance",         16),
    ("HK Relevance Reasoning",      44),
    ("Product Image",               15),
    ("Source URL",                  48),
    ("Distributor / Sourcing Info", 46),
    ("Distributor URL",             42),
]

# 1-based column indices for special treatment
COL_DATE_CONFIDENCE = 8
COL_HK_RELEVANCE    = 11
COL_IMAGE           = 13


# =============================================================================
# SECTION 2 – DATA CLASSES
# =============================================================================

@dataclass
class SocialPost:
    platform:   str
    market:     str
    title:      str
    text:       str
    url:        str
    date_hint:  str = ""
    image_url:  str = ""
    raw:        Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProductInsight:
    platform:             str
    market:               str
    product_name:         str
    brand:                str
    category:             str
    key_features:         str
    ai_date:              str
    date_confidence:      str   # "High" | "Medium" | "Low"
    price:                str
    engagement:           str
    hk_relevance:         str   # "High" | "Medium" | "Low"
    hk_relevance_reason:  str
    image_url:            str
    source_url:           str
    distributor_info:     str = ""
    distributor_url:      str = ""


# =============================================================================
# SECTION 3 – LOGGING
# =============================================================================

def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-7s | %(message)s",
        datefmt="%H:%M:%S",
    )


# =============================================================================
# SECTION 4 – DATE HELPERS
# =============================================================================

def today() -> dt.date:
    return dt.datetime.now().date()


def scan_start() -> dt.date:
    return today() - dt.timedelta(days=DAYS_LOOKBACK)


# =============================================================================
# SECTION 5 – HTTP HELPERS
# =============================================================================

_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def _get(url: str,
         params: Optional[Dict] = None,
         headers: Optional[Dict] = None,
         timeout: int = REQUEST_TIMEOUT) -> Optional[requests.Response]:
    h = {"User-Agent": _UA}
    if headers:
        h.update(headers)
    for attempt in range(3):
        try:
            resp = requests.get(url, headers=h, params=params, timeout=timeout)
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                logging.warning("GET failed [%.70s]: %s", url, exc)
    return None


def _post_json(url: str, body: Dict, headers: Dict,
               timeout: int = REQUEST_TIMEOUT) -> Optional[Dict]:
    for attempt in range(3):
        try:
            resp = requests.post(url, json=body, headers=headers, timeout=timeout)
            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", 65))
                logging.warning("Rate limited — waiting %ds", wait)
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, json.JSONDecodeError) as exc:
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                logging.warning("POST failed [%.70s]: %s", url, exc)
    return None


# =============================================================================
# SECTION 6 – APIFY ITEM FIELD EXTRACTORS
# (handles the wide variety of field names across different actor schemas)
# =============================================================================

def _text(item: Dict) -> str:
    for k in ("title", "caption", "desc", "description", "text", "content",
              "videoDescription", "full_text", "body", "note_text", "postText",
              "articleBody"):
        v = item.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()[:3000]
    return ""


def _url(item: Dict) -> str:
    for k in ("url", "postUrl", "webVideoUrl", "videoUrl", "link",
              "shortCodeUrl", "permalink", "tweet_url", "note_url", "shareUrl",
              "postLink"):
        v = item.get(k)
        if isinstance(v, str) and v.startswith("http"):
            return v
    return ""


def _image(item: Dict) -> str:
    for k in ("displayUrl", "thumbnailUrl", "coverUrl", "imageUrl", "image",
              "thumbnail", "videoCover", "mediaUrl", "cover_url", "previewUrl"):
        v = item.get(k)
        if isinstance(v, str) and v.startswith("http"):
            return v
        if isinstance(v, list) and v:
            first = v[0]
            if isinstance(first, str) and first.startswith("http"):
                return first
            if isinstance(first, dict):
                for sk in ("url", "src", "uri"):
                    sv = first.get(sk)
                    if isinstance(sv, str) and sv.startswith("http"):
                        return sv
    return ""


def _date_hint(item: Dict) -> str:
    for k in ("date", "createdAt", "timestamp", "publishedAt", "takenAt",
              "createTime", "uploadDate", "created_at", "pubDate", "time",
              "postedAt", "postDate"):
        v = item.get(k)
        if v:
            return str(v)
    return ""


def _engagement_total(item: Dict) -> int:
    total = 0
    for k in ("likes", "likeCount", "diggCount", "comments", "commentCount",
              "shares", "shareCount", "views", "viewCount", "playCount",
              "collectCount", "saveCount", "retweet_count", "favorite_count",
              "numLikes", "numComments", "numShares", "numViews",
              "interactionCount"):
        try:
            v = item.get(k)
            if v is not None:
                total += int(str(v).replace(",", ""))
        except (ValueError, TypeError):
            pass
    return total


def _engagement_text(item: Dict) -> str:
    parts: List[str] = []
    groups: Dict[str, List[str]] = {
        "Views":    ["views", "viewCount", "playCount", "numViews"],
        "Likes":    ["likes", "likeCount", "diggCount", "favorite_count", "numLikes"],
        "Comments": ["comments", "commentCount", "numComments"],
        "Shares":   ["shares", "shareCount", "retweet_count", "numShares"],
        "Saves":    ["collectCount", "saveCount"],
    }
    for label, keys in groups.items():
        for k in keys:
            v = item.get(k)
            if v not in (None, "", 0):
                parts.append(f"{label}: {v}")
                break
    # Creator
    for k in ("author", "authorName", "username", "ownerUsername",
              "channelName", "user_name", "nickname", "authorMeta"):
        v = item.get(k)
        if isinstance(v, str) and v:
            parts.append(f"Creator: @{v.lstrip('@')}")
            break
        if isinstance(v, dict):
            name = v.get("uniqueId") or v.get("nickname") or v.get("username")
            if name:
                parts.append(f"Creator: @{name}")
                break
    return "; ".join(parts) if parts else "N/A"


# =============================================================================
# SECTION 7 – BRAVE SEARCH
# =============================================================================

def brave_search(query: str, count: int = 8) -> List[Dict]:
    if not BRAVE_API_KEY:
        return []
    resp = _get(
        "https://api.search.brave.com/res/v1/web/search",
        params={"q": query, "count": min(count, 10),
                "result_filter": "web", "text_decorations": "false"},
        headers={"Accept": "application/json",
                 "X-Subscription-Token": BRAVE_API_KEY},
    )
    if not resp:
        return []
    try:
        return resp.json().get("web", {}).get("results", [])
    except (json.JSONDecodeError, AttributeError):
        return []


def search_distributor_web(product_name: str, brand: str) -> List[Dict]:
    """Collect web results about HK/Asia distributors for a product."""
    seen: set = set()
    results: List[Dict] = []
    queries = [
        f'"{brand}" "Hong Kong" distributor wholesale authorized',
        f'"{brand}" Asia distributor official retailer',
        f'"{brand}" {product_name} buy Asia',
    ]
    for q in queries:
        for r in brave_search(q, count=5):
            u = r.get("url", "")
            if u and u not in seen:
                seen.add(u)
                results.append(r)
        time.sleep(SLEEP_CALLS)
    return results[:12]


# =============================================================================
# SECTION 8 – MISTRAL AI
# =============================================================================

def _mistral_headers() -> Dict:
    return {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json",
    }


def _clean_json(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"```$", "", text).strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
    return m.group(0) if m else text


def call_mistral(prompt: str,
                 system: str = "Return valid JSON only.",
                 max_tokens: int = 1800) -> Optional[Dict]:
    """Call Mistral chat completion and return parsed JSON dict."""
    if not MISTRAL_API_KEY:
        logging.error("MISTRAL_API_KEY not configured")
        return None
    payload = {
        "model": MISTRAL_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": prompt},
        ],
        "temperature": 0.1,
        "max_tokens":  max_tokens,
        "response_format": {"type": "json_object"},
    }
    data = _post_json(
        f"{MISTRAL_API_BASE}/chat/completions",
        payload,
        _mistral_headers(),
    )
    if not data:
        return None
    try:
        raw = data["choices"][0]["message"]["content"]
        return json.loads(_clean_json(raw))
    except (KeyError, IndexError, json.JSONDecodeError, TypeError) as exc:
        logging.warning("Mistral JSON parse error: %s", exc)
        return None


# ---------------------------------------------------------------------------
def ai_validate_post(post: SocialPost) -> Optional[Dict]:
    """
    Ask Mistral to:
      1. Validate whether the post features a specific B2C home-use
         electronic beauty device suitable for HK sourcing.
      2. Extract structured product fields.
      3. AI-estimate the post/launch date with explicit confidence level,
         using ALL available signals — NOT just site metadata.
    """
    prompt = f"""
You are a product-sourcing analyst for a Hong Kong beauty and consumer-electronics retailer.

TASK
Analyse this {post.platform} social-media post. Decide if it features a SPECIFIC,
IDENTIFIABLE B2C home-use electronic beauty device worth considering for HK product sourcing.

══════════════════════════════════════════════
POST DATA
══════════════════════════════════════════════
Platform  : {post.platform}
Market    : {post.market}
Title     : {post.title[:280]}
Content   : {post.text[:1800]}
Date meta : {post.date_hint or "Not available"}
URL       : {post.url}

══════════════════════════════════════════════
CONTEXT
══════════════════════════════════════════════
Today       : {today().isoformat()}
Scan window : {scan_start().isoformat()} → {today().isoformat()} (last {DAYS_LOOKBACK} days)

══════════════════════════════════════════════
VALID BEAUTY DEVICE — ALL criteria must hold
══════════════════════════════════════════════
✅ Specific BRAND NAME + MODEL/SERIES  (e.g. "FOREO UFO 3" or "NuFace Mini Pro 2")
✅ B2C HOME-USE ELECTRONIC beauty device:
   LED face/body masks · RF/radio-frequency lifting · microcurrent · EMS face-body toning
   IPL/laser hair removal · ultrasonic skin scrubber · photon therapy · galvanic facial
   laser hair-growth helmet · at-home fractional RF · scalp EMS · eye massager with heat
✅ Originates from a foreign market (US, UK, Korea, Japan, EU, Taiwan, mainland China for export)
   — NOT a local Hong Kong brand
✅ Post is recent (within scan window) OR product is newly launched / going viral

REJECT if:
❌ No specific brand+model (generic "LED mask" with no brand/model)
❌ Pure cosmetics, serums, skincare creams — not electronic
❌ Medical-grade / clinic-only / professional salon equipment
❌ Prototype / crowdfunding / unavailable consumer product
❌ Content is clearly >90 days old with zero new-trend signal

══════════════════════════════════════════════
AI DATE ESTIMATION — IMPORTANT
══════════════════════════════════════════════
Do NOT simply copy the metadata date.  Reason across ALL available signals:

1. Metadata timestamp  (convert Unix epoch if needed; most reliable when present)
2. Relative phrases in text: "2 days ago", "just dropped", "last week"
3. Seasonal cues: "summer launch", "winter skincare routine", "holiday gift"
4. Sale/event markers: "11.11", "Black Friday 2024", "618 festival", "Double 12"
5. Launch language: "new for 2025", "just released", "available now", "pre-order"
6. Social-platform context: trending content on TikTok/XHS skews recent
7. Cross-reference with your knowledge of the product's actual launch timeline

Confidence guide
  High   = exact date from reliable metadata OR clearly stated in post
  Medium = approximate date from 2+ independent signals
  Low    = rough estimate from 1 vague signal, or no usable signal

══════════════════════════════════════════════
HK MARKET RELEVANCE
══════════════════════════════════════════════
High   = Clear HK consumer demand; importable; price ≈ HKD 300–6 000; strong brand; low regulatory risk
Medium = Interesting; needs more research on availability / pricing / certification
Low    = Limited HK appeal, too niche/expensive, or significant barriers

══════════════════════════════════════════════
RETURN STRICT JSON — no markdown, no prose
══════════════════════════════════════════════
{{
  "is_valid":             true | false,
  "reject_reason":        "if false → brief reason; if true → empty string",
  "product_name":         "Brand + Full Model  (e.g. 'FOREO UFO 3 Smart Mask Treatment Device')",
  "brand":                "Brand name only",
  "category":             "LED Face Mask | RF Lifting Device | Microcurrent Device | IPL Hair Removal | EMS Toning Device | Ultrasonic Skin Device | Photon Therapy Device | Laser Hair Growth | Other",
  "origin_country":       "Country of origin",
  "key_features":         "3-5 selling points separated by  |  (e.g. '630 nm + 830 nm LED | 5-min treatment | FDA-cleared | app-connected')",
  "price":                "Price with currency if stated; else 'Not disclosed'",
  "ai_estimated_date":    "YYYY-MM-DD  |  YYYY-QN (e.g. 2024-Q4)  |  ~YYYY-MM  |  'Within scan window (exact unknown)'",
  "date_confidence":      "High | Medium | Low",
  "date_reasoning":       "1-2 sentences — how did you determine the date?",
  "hk_relevance":         "High | Medium | Low",
  "hk_relevance_reason":  "2-3 sentences on HK market fit",
  "best_image_url":       "Best product image URL visible in post; empty string if none"
}}
""".strip()

    result = call_mistral(prompt)
    time.sleep(SLEEP_MISTRAL)
    return result


# ---------------------------------------------------------------------------
def ai_analyze_distributors(product_name: str, brand: str, origin: str,
                             web_results: List[Dict]) -> Tuple[str, str]:
    """
    Feed Brave search results into Mistral and extract a distributor summary
    and best sourcing URL.  Returns (summary_text, best_url).
    """
    if not web_results:
        return "No distributor search results found", ""

    snippets = "\n\n".join(
        f"[{i+1}] Title  : {r.get('title', 'N/A')}\n"
        f"     URL    : {r.get('url', 'N/A')}\n"
        f"     Desc   : {r.get('description', 'N/A')}"
        for i, r in enumerate(web_results[:10])
    )

    prompt = f"""
You are a sourcing specialist for a Hong Kong beauty product retailer.

TARGET PRODUCT : {product_name}
BRAND          : {brand}
ORIGIN         : {origin}

WEB SEARCH RESULTS (HK/Asia distributor search):
{snippets}

Identify the best HK/Asia sourcing options from these results.

Prioritise:
1. Official HK distributors or authorised HK retailers
2. Asia-Pacific regional distributors / brand offices
3. Brand's own website if it ships to HK / Asia
4. Reputable B2B sourcing platforms (Alibaba, Made-in-China, etc.)

Return JSON:
{{
  "distributor_summary":  "2-3 sentences naming specific companies/sites found.  Note if direct import is needed.",
  "best_url":             "Single most useful URL for HK sourcing (distributor, brand HK page, or B2B portal). Empty string if none.",
  "hk_availability":      "Available in HK | Asia only (no HK yet) | Direct import required | Unknown",
  "moq_or_notes":         "Any MOQ, exclusivity, or certification notes; else empty string"
}}
""".strip()

    result = call_mistral(prompt, max_tokens=500)
    time.sleep(SLEEP_MISTRAL)

    if result:
        summary = result.get("distributor_summary", "No distributor info found")
        avail   = result.get("hk_availability", "")
        notes   = result.get("moq_or_notes", "")
        full    = summary
        if avail:
            full += f"  [{avail}]"
        if notes:
            full += f"  Note: {notes}"
        return full.strip(), result.get("best_url", "")

    return "Distributor research inconclusive", ""


# =============================================================================
# SECTION 9 – APIFY INTEGRATION
# =============================================================================

def run_apify_actor(platform: str) -> List[Dict]:
    """
    Launch the configured Apify actor for a platform, poll until it finishes
    (up to ~5 min), then fetch and return dataset items.
    """
    actor_id = APIFY_ACTOR_IDS.get(platform, "")
    if not actor_id:
        logging.info("[%s] Skipped — no actor ID configured", platform)
        return []
    if not APIFY_API_TOKEN:
        logging.error("[%s] APIFY_API_TOKEN not set", platform)
        return []

    actor_input = PLATFORM_CONFIG[platform]["actor_input"]
    encoded     = quote(actor_id, safe="")
    run_url     = f"https://api.apify.com/v2/acts/{encoded}/runs"

    logging.info("[%s] Launching Apify actor: %s", platform, actor_id)
    try:
        resp = requests.post(
            run_url,
            json=actor_input,
            params={"token": APIFY_API_TOKEN, "waitForFinish": 90},
            timeout=120,
        )
        if resp.status_code == 404:
            logging.error(
                "[%s] Actor '%s' not found.\n"
                "  → Find a working actor at https://apify.com/store\n"
                "  → Update APIFY_ACTOR_IDS in the configuration section",
                platform, actor_id,
            )
            return []
        if resp.status_code == 403:
            logging.error(
                "[%s] Access denied for '%s' — check Apify plan/subscription", platform, actor_id
            )
            return []
        resp.raise_for_status()
        run_data = resp.json()
    except requests.RequestException as exc:
        logging.error("[%s] Failed to launch actor: %s", platform, exc)
        return []

    run        = run_data.get("data", run_data)
    status     = run.get("status", "")
    run_id     = run.get("id", "")
    dataset_id = run.get("defaultDatasetId", "")

    # Poll until terminal state (max ~5 min)
    if status != "SUCCEEDED" and run_id:
        logging.info("[%s] Polling actor run %s …", platform, run_id)
        for _ in range(30):
            time.sleep(10)
            sr = _get(
                f"https://api.apify.com/v2/actor-runs/{run_id}",
                params={"token": APIFY_API_TOKEN},
            )
            if not sr:
                continue
            run        = sr.json().get("data", {})
            status     = run.get("status", "")
            dataset_id = run.get("defaultDatasetId", dataset_id)
            if status in {"SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"}:
                break

    if status != "SUCCEEDED":
        logging.warning("[%s] Actor ended with status: %s", platform, status)
        return []
    if not dataset_id:
        logging.warning("[%s] No dataset ID returned", platform)
        return []

    # Fetch dataset items
    ir = _get(
        f"https://api.apify.com/v2/datasets/{dataset_id}/items",
        params={
            "token": APIFY_API_TOKEN,
            "clean": "true",
            "format": "json",
            "limit": RESULTS_PER_PLATFORM * 8,
        },
    )
    if not ir:
        return []
    try:
        items = ir.json()
        if isinstance(items, list):
            logging.info("[%s] Retrieved %d items from dataset", platform, len(items))
            return items
    except json.JSONDecodeError:
        pass
    return []


# =============================================================================
# SECTION 10 – PLATFORM PROCESSING PIPELINE
# =============================================================================

def process_platform(platform: str) -> List[ProductInsight]:
    """
    Full pipeline for one platform:
      1. Fetch raw items via Apify.
      2. Rank by engagement; fall back to all items if none meet threshold.
      3. For each item: AI-validate, extract product fields, estimate date.
      4. For each valid product: search for HK/Asia distributors.
      5. Return up to RESULTS_PER_PLATFORM insights.
    """
    market = PLATFORM_CONFIG[platform]["market"]

    raw_items = run_apify_actor(platform)
    if not raw_items:
        logging.warning("[%s] No items returned from Apify", platform)
        return []

    # Sort by engagement descending; keep low-engagement items as fallback
    ranked    = sorted(raw_items, key=_engagement_total, reverse=True)
    qualified = [it for it in ranked if _engagement_total(it) >= MIN_ENGAGEMENT]
    pool      = qualified if qualified else ranked

    logging.info(
        "[%s] Processing %d posts (engagement ≥ %d; total %d)",
        platform, len(pool), MIN_ENGAGEMENT, len(raw_items),
    )

    insights: List[ProductInsight] = []

    for idx, item in enumerate(pool, 1):
        if len(insights) >= RESULTS_PER_PLATFORM:
            break

        text      = _text(item)
        url       = _url(item)
        dh        = _date_hint(item)
        img_url   = _image(item)
        eng_text  = _engagement_text(item)

        if not text and not url:
            continue

        post = SocialPost(
            platform  = platform,
            market    = market,
            title     = item.get("title", "") or text[:100],
            text      = text,
            url       = url,
            date_hint = dh,
            image_url = img_url,
            raw       = item,
        )

        logging.info(
            "[%s] Post %d/%d — AI validating: %.80s…",
            platform, idx, len(pool), text,
        )

        extracted = ai_validate_post(post)
        if not extracted:
            logging.info("[%s] Post %d — AI extraction returned nothing", platform, idx)
            continue
        if not extracted.get("is_valid"):
            logging.info(
                "[%s] Post %d — rejected: %s",
                platform, idx, extracted.get("reject_reason", "?"),
            )
            continue

        product_name = extracted.get("product_name", "Unknown Product")
        brand        = extracted.get("brand", "Unknown Brand")
        origin       = extracted.get("origin_country", "Unknown")

        logging.info(
            "[%s] ✓ Found: %s  (HK relevance: %s)",
            platform, product_name, extracted.get("hk_relevance", "?"),
        )

        # ---------- Distributor search ----------
        logging.info("[%s] Searching distributors for: %s …", platform, brand)
        dist_results                = search_distributor_web(product_name, brand)
        distributor_info, dist_url  = ai_analyze_distributors(
            product_name, brand, origin, dist_results
        )

        insights.append(ProductInsight(
            platform             = platform,
            market               = market,
            product_name         = product_name,
            brand                = brand,
            category             = extracted.get("category", "Beauty Device"),
            key_features         = extracted.get("key_features", "N/A"),
            ai_date              = extracted.get("ai_estimated_date", "Unknown"),
            date_confidence      = extracted.get("date_confidence", "Low"),
            price                = extracted.get("price", "Not disclosed"),
            engagement           = eng_text,
            hk_relevance         = extracted.get("hk_relevance", "Medium"),
            hk_relevance_reason  = extracted.get("hk_relevance_reason", "N/A"),
            image_url            = img_url or extracted.get("best_image_url", ""),
            source_url           = url,
            distributor_info     = distributor_info,
            distributor_url      = dist_url,
        ))

        time.sleep(SLEEP_CALLS)

    logging.info("[%s] %d products collected", platform, len(insights))
    return insights[:RESULTS_PER_PLATFORM]


# =============================================================================
# SECTION 11 – IMAGE DOWNLOAD & RESIZE
# =============================================================================

def _download_image(url: str, out_dir: Path, size: int = 90) -> Optional[Path]:
    if not url or url.startswith("data:"):
        return None
    try:
        resp = requests.get(
            url, headers={"User-Agent": _UA}, timeout=20, stream=True
        )
        resp.raise_for_status()
        ct = resp.headers.get("Content-Type", "").lower()
        if "image" not in ct and not any(
            url.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif")
        ):
            return None

        digest = hashlib.sha256(url.encode()).hexdigest()[:12]
        raw    = out_dir / f"raw_{digest}"
        with raw.open("wb") as f:
            for chunk in resp.iter_content(8192):
                if chunk:
                    f.write(chunk)

        with Image.open(raw) as img:
            img    = ImageOps.exif_transpose(img)
            img.thumbnail((size, size), Image.Resampling.LANCZOS)
            canvas = Image.new("RGB", (size, size), "white")
            x, y   = (size - img.width) // 2, (size - img.height) // 2
            if img.mode in ("RGBA", "LA"):
                r, g, b, a = img.convert("RGBA").split()
                canvas.paste(img.convert("RGB"), (x, y), a)
            else:
                canvas.paste(img.convert("RGB"), (x, y))
            out = out_dir / f"img_{digest}.png"
            canvas.save(out, "PNG")

        raw.unlink(missing_ok=True)
        return out
    except Exception as exc:                                       # noqa: BLE001
        logging.debug("Image download failed [%.60s]: %s", url, exc)
        return None


# =============================================================================
# SECTION 12 – EXCEL WORKBOOK
# =============================================================================

_F_GREEN  = PatternFill("solid", fgColor="C6EFCE")
_F_YELLOW = PatternFill("solid", fgColor="FFEB9C")
_F_RED    = PatternFill("solid", fgColor="FFC7CE")
_F_HEADER = PatternFill("solid", fgColor="1F4E78")

_PLATFORM_FILL: Dict[str, PatternFill] = {
    "XHS":       PatternFill("solid", fgColor="FFF0F3"),
    "TikTok":    PatternFill("solid", fgColor="F0F0FF"),
    "Instagram": PatternFill("solid", fgColor="FFF5E8"),
    "X":         PatternFill("solid", fgColor="E8F4FF"),
}


def _relevance_fill(v: str) -> PatternFill:
    return {"High": _F_GREEN, "Medium": _F_YELLOW, "Low": _F_RED}.get(v, PatternFill())


def _write_main_sheet(ws, insights: List[ProductInsight], tmp_dir: Path) -> None:
    # ---- Header row ----
    ws.row_dimensions[1].height = 36
    for ci, (name, _) in enumerate(COLUMNS, 1):
        c = ws.cell(row=1, column=ci, value=name)
        c.fill      = _F_HEADER
        c.font      = Font(color="FFFFFF", bold=True, size=10)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for ci, (_, w) in enumerate(COLUMNS, 1):
        ws.column_dimensions[get_column_letter(ci)].width = w
    ws.freeze_panes = "A2"

    # ---- Data rows ----
    for ri, ins in enumerate(insights, 2):
        ws.row_dimensions[ri].height = 90
        pf = _PLATFORM_FILL.get(ins.platform)

        vals = [
            ins.platform,
            ins.market,
            ins.product_name,
            ins.brand,
            ins.category,
            ins.key_features.replace("|", "\n"),   # one feature per line
            ins.ai_date,
            ins.date_confidence,
            ins.price,
            ins.engagement,
            ins.hk_relevance,
            ins.hk_relevance_reason,
            "",                                     # image placeholder
            ins.source_url,
            ins.distributor_info,
            ins.distributor_url,
        ]
        for ci, v in enumerate(vals, 1):
            cell = ws.cell(row=ri, column=ci, value=v)
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            if pf:
                cell.fill = pf

        # Colour-code relevance/confidence columns
        ws.cell(row=ri, column=COL_HK_RELEVANCE).fill    = _relevance_fill(ins.hk_relevance)
        ws.cell(row=ri, column=COL_DATE_CONFIDENCE).fill = _relevance_fill(ins.date_confidence)

        # Embed product image
        if ins.image_url:
            img_path = _download_image(ins.image_url, tmp_dir, size=90)
            if img_path:
                xl_img        = XLImage(str(img_path))
                xl_img.width  = 90
                xl_img.height = 90
                ws.add_image(xl_img, f"{get_column_letter(COL_IMAGE)}{ri}")
            else:
                ws.cell(row=ri, column=COL_IMAGE, value="(no image)")


def _write_summary_sheet(ws, insights: List[ProductInsight]) -> None:
    ws["A1"] = "HK Beauty Device Trend Scan — Summary"
    ws["A1"].font = Font(bold=True, size=14, color="1F4E78")
    ws["A2"] = f"Generated     : {today().isoformat()}"
    ws["A3"] = f"Scan window   : {scan_start()} – {today()} ({DAYS_LOOKBACK} days)"
    ws["A4"] = f"Total products: {len(insights)}"

    by_plat   = Counter(i.platform for i in insights)
    high_plat = Counter(i.platform for i in insights if i.hk_relevance == "High")

    ws["A6"] = "Platform Breakdown"
    ws["A6"].font = Font(bold=True, size=11)
    for ci, h in enumerate(["Platform", "Total Found", "High Relevance"], 1):
        ws.cell(row=7, column=ci, value=h).font = Font(bold=True)
    for ri, (plat, cnt) in enumerate(by_plat.items(), 8):
        ws.cell(row=ri, column=1, value=plat)
        ws.cell(row=ri, column=2, value=cnt)
        ws.cell(row=ri, column=3, value=high_plat.get(plat, 0))

    start = 8 + len(by_plat) + 2
    ws.cell(row=start, column=1,
            value="Priority Products for HK Sourcing (High → Medium relevance)").font = Font(bold=True, size=11)
    heads = ["Product Name", "Brand", "Category", "Platform",
             "Price", "AI Date", "HK Relevance Reasoning", "Distributor URL"]
    for ci, h in enumerate(heads, 1):
        ws.cell(row=start + 1, column=ci, value=h).font = Font(bold=True)

    sorted_ins = sorted(
        insights,
        key=lambda x: ({"High": 0, "Medium": 1, "Low": 2}.get(x.hk_relevance, 3), x.platform),
    )
    for off, ins in enumerate(sorted_ins, start + 2):
        row_vals = [
            ins.product_name, ins.brand, ins.category, ins.platform,
            ins.price, ins.ai_date, ins.hk_relevance_reason, ins.distributor_url,
        ]
        for ci, v in enumerate(row_vals, 1):
            cell = ws.cell(row=off, column=ci, value=v)
            cell.fill = _relevance_fill(ins.hk_relevance)

    for ci, w in enumerate([36, 20, 24, 12, 16, 16, 50, 42], 1):
        ws.column_dimensions[get_column_letter(ci)].width = w


def create_workbook(insights: List[ProductInsight],
                    path: str = OUTPUT_FILE) -> None:
    wb       = Workbook()
    ws_main  = wb.active
    ws_main.title = "Beauty Device Trends"
    ws_sum   = wb.create_sheet("Priority Summary")

    # Keep temp images alive until wb.save()
    with tempfile.TemporaryDirectory(prefix="beauty_scan_") as tmp:
        _write_main_sheet(ws_main, insights, Path(tmp))
        _write_summary_sheet(ws_sum, insights)
        wb.save(path)

    logging.info("Workbook saved → %s  (%d products)", path, len(insights))


# =============================================================================
# SECTION 13 – MAIN
# =============================================================================

def main() -> None:
    setup_logging()

    logging.info("━" * 64)
    logging.info("HK BEAUTY DEVICE TREND SCANNER")
    logging.info("Scan window : %s → %s", scan_start(), today())
    logging.info("Per platform: up to %d products", RESULTS_PER_PLATFORM)
    active = [p for p, a in APIFY_ACTOR_IDS.items() if a]
    logging.info("Platforms   : %s", ", ".join(active))
    logging.info("━" * 64)

    if not APIFY_API_TOKEN:
        logging.error("APIFY_API_TOKEN is required. Set as env var or update configuration.")
        return
    if not MISTRAL_API_KEY:
        logging.error("MISTRAL_API_KEY is required. Set as env var or update configuration.")
        return

    all_insights: List[ProductInsight] = []

    for platform in APIFY_ACTOR_IDS:
        if not APIFY_ACTOR_IDS[platform]:
            logging.info("[%s] Skipped — actor ID not set", platform)
            continue

        logging.info("─" * 44)
        try:
            results = process_platform(platform)
            all_insights.extend(results)
            if len(results) < 3:
                logging.warning(
                    "[%s] Only %d result(s) found — consider checking actor ID or "
                    "adjusting search terms in PLATFORM_CONFIG",
                    platform, len(results),
                )
        except Exception as exc:                                   # noqa: BLE001
            logging.error("[%s] Fatal error: %s", platform, exc, exc_info=True)

        time.sleep(SLEEP_CALLS * 2)

    logging.info("─" * 44)
    logging.info("Total insights collected: %d", len(all_insights))

    # Sort: High relevance first, then by platform
    all_insights.sort(
        key=lambda x: (
            {"High": 0, "Medium": 1, "Low": 2}.get(x.hk_relevance, 3),
            x.platform,
        )
    )

    create_workbook(all_insights, OUTPUT_FILE)

    # ---- Final summary ----
    high   = sum(1 for i in all_insights if i.hk_relevance == "High")
    medium = sum(1 for i in all_insights if i.hk_relevance == "Medium")
    low    = len(all_insights) - high - medium

    logging.info("━" * 64)
    logging.info("SCAN COMPLETE  →  %s", OUTPUT_FILE)
    logging.info("Relevance: High=%d  Medium=%d  Low=%d", high, medium, low)
    for plat, cnt in Counter(i.platform for i in all_insights).items():
        logging.info("  %-12s  %d product(s)", plat, cnt)
    logging.info("━" * 64)


if __name__ == "__main__":
    main()
