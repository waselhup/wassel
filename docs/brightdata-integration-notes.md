# Bright Data Integration Notes

## Dataset
- **Name:** LinkedIn people profiles
- **ID:** `gd_l1viktl72bvl7bjuj0`
- **Size:** ~115M profiles indexed

## Endpoints
- **Trigger:** `POST https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_l1viktl72bvl7bjuj0&include_errors=true`
- **Progress:** `GET https://api.brightdata.com/datasets/v3/progress/{snapshot_id}`
- **Snapshot:** `GET https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}?format=json`

## Mode
**Async (trigger → poll → fetch).** No blocking-sync option available for this dataset. Poll every 2s, 90s hard cap.

## Auth
`Authorization: Bearer <BRIGHT_DATA_API_KEY>` — single header, no zone required for Web Scraper API datasets.

## Input schema
```json
[{"url": "https://www.linkedin.com/in/<slug>/"}]
```
Array of objects with `url` key. Single item per call in our usage.

## Output schema — SUCCESS
Array of 1 object. Key fields observed:

- `id` — slug (e.g. `"alhashimali"`) — **authoritative for slug verification**
- `linkedin_id` — duplicate of slug
- `linkedin_num_id` — numeric LinkedIn internal ID
- `name` — full name with titles/suffixes (e.g. `"Ali Alhashim, CMA"`)
- `first_name`, `last_name`
- `city`, `country_code`, `location`
- `about` — summary text
- `url` — canonical profile URL (e.g. `"https://my.linkedin.com/in/Alhashimali"`)
- `input_url` — original URL submitted (echoed back)
- `input.url` — alternate location of submitted URL
- `current_company` — `{ link, name, company_id, location }`
- `experience` — array OR null (often null for privacy-limited profiles)
- `education` — array: `{ title, url, start_year, end_year, description }`
- `educations_details` — text summary (e.g. `"Northumbria University"`)
- `languages` — array: `{ title, subtitle }` (subtitle is proficiency)
- `certifications` — array: `{ title, subtitle, meta, credential_url, credential_id }`
- `recommendations` — array of strings (full recommendation texts)
- `recommendations_count` — number
- `honors_and_awards` — array: `{ title, publication, date, description }`
- `activity` — array of recent posts/likes/comments with `{ interaction, link, title, img, id }`
- `followers`, `connections`
- `avatar`, `banner_image`, `default_avatar`
- `bio_links` — array (empty in sample)
- `similar_profiles`, `memorialized_account`, `influencer`
- `timestamp` — when scraped

## Output schema — FAILURE (fake URL)
```json
[
  {
    "timestamp": "...",
    "input": { "url": "..." },
    "error": "The profile is hidden or private.",
    "error_code": "dead_page"
  }
]
```
Progress endpoint reports `records: 0, errors: 0` — the error row is in snapshot.

**Critical finding:** Bright Data does NOT return a nearest-match. Unlike Apify `harvestapi~linkedin-profile-search`, this dataset is strictly URL-resolved. A fake URL produces `error_code: "dead_page"` and zero records.

Other known error codes (documented elsewhere in Bright Data docs): `not_found`, `access_denied`, `timeout`. Adapter should treat any non-success row (row containing `error_code` or `error` key) as profile-not-found.

## Latency observed
- Real URL: ~14s end-to-end (trigger → ready)
- Fake URL: ~5s (fails fast)
- Typical production budget: 30-60s with polling overhead

## Fake-URL behavior
**Ideal.** Returns structured error with `error_code: "dead_page"`. No silent fallback, no nearest-match. Safe against the Apify-style data-integrity bug.

## Cost
Pay-as-you-go on a 10-day trial. Cost per record not returned in response headers; check dashboard. Scope: analyzeTargeted route only, ~25 token deduction per user call covers margin.

## Slug verification
Even though Bright Data is direct-URL, we still add a slug-match layer as defense-in-depth:
- Compare normalized slug from `input.profileUrl` vs `id` / `linkedin_id` / `/in/<slug>` extracted from `url` field
- Reject as NOT_FOUND if mismatch
- Never deduct tokens before this passes

## Env vars
- `BRIGHT_DATA_API_KEY` — the bearer token
- `BRIGHT_DATA_LINKEDIN_DATASET_ID` — `gd_l1viktl72bvl7bjuj0` (in case Bright Data re-IDs)

## Trial caveat
10 days remaining as of 2026-04-24. User must upgrade before expiry or revert to Apify via rollback branch.
