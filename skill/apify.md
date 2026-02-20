# Google Scholar Research

Use `marco.gullo/google-scholar-scraper` to search academic papers on Google Scholar, filter for arXiv-only sources, and save results.

## User Input

$ARGUMENTS — research topic / keywords

## Execution SOP

### Step 1: Analyze Topic and Determine Fetch Volume

Based on the research topic, assess its breadth and set `maxItems`:

| Breadth | Characteristics | maxItems | Example |
| --------- | ---------------- | ---------- | --------- |
| Narrow | Specific method/model/technique | 30-50 | "LoRA fine-tuning for LLM" |
| Medium | A research direction | 50-100 | "LLM reasoning" |
| Broad | Cross-domain / survey-level | 100-200 | "large language model applications" |

Since only arXiv papers are kept (arXiv typically accounts for ~20-30% of Google Scholar results), the fetch volume should be 3-5x the target paper count.

**Before execution, state**: which breadth level was chosen, the rationale, and the `maxItems` value.

### Step 2: Build Input and Call Actor

Call `marco.gullo/google-scholar-scraper` with:

```json
{
  "keyword": "<search keywords>",
  "maxItems": "<from Step 1>",
  "sortBy": "date",
  "proxyOptions": { "useApifyProxy": true }
}
```

**Core input parameters:**

| Parameter | Type | Required | Description |
| ----------- | -------- | ---------- | ------------- |
| `keyword` | string | Yes | Google Scholar search keywords |
| `maxItems` | integer | No | Max items to fetch, default 20 |
| `sortBy` | `"relevance"` / `"date"` | No | Sort order, default relevance |
| `filter` | `"all"` / `"pdfOnly"` / `"htmlOnly"` | No | Document format filter |
| `newerThan` | integer | No | Only after this year (works when sortBy=relevance) |
| `olderThan` | integer | No | Only before this year (works when sortBy=relevance) |
| `articleType` | `"any"` / `"review"` | No | Article type filter |
| `proxyOptions` | object | Yes | Always `{"useApifyProxy": true}` |

### Step 3: arXiv Mandatory Filter (Highest Priority)

**Keep ONLY papers sourced from arXiv. Discard all other sources.**

A paper is from arXiv if ANY of the following is true (case-insensitive):

1. `source` field contains `"arxiv"`
2. `link` field contains `"arxiv.org"`
3. `documentLink` field contains `"arxiv.org"`

### Step 4: Paper Value Screening

Apply the following criteria to arXiv-filtered papers:

**Hard requirements (fail = discard):**

- Recency: paper year must be within the last 3 years (current year - 2 or later)
- Title and snippet must be relevant to the research topic

**Soft scoring dimensions (holistic judgment):**

| Dimension | Weight | Description |
| ----------- | -------- | ------------- |
| Citations | High | `citations` field; same-year papers ≥5 is good, older papers should be higher |
| Topic relevance | High | Keyword density in title and `searchMatch` |
| Versions | Low | `versions` > 0 indicates active updates |

**Special rules:**

- Papers from the last 6 months are exempt from citation requirements (too new to accumulate citations)
- If fewer than 5 papers remain after filtering, relax citation thresholds but keep the recency requirement

### Step 5: Save Results

Save filtered papers as a JSON file in `.assets/paper/`.

**Filename format:** `{YYYY-MM-DD}_{topic_keywords}.json`

- Date is the execution date
- Topic keywords: core words from user input, lowercase, spaces → `_`, strip special characters
- Example: `2026-02-21_llm_reasoning.json`

**JSON structure:**

```json
{
  "query": "original search keywords",
  "date": "execution date",
  "total_fetched": 80,
  "arxiv_count": 45,
  "total_filtered": 16,
  "papers": [
    {
      "title": "Paper title",
      "authors": "Author list",
      "year": 2026,
      "citations": 0,
      "arxiv_url": "arXiv link (prefer documentLink, fallback to link)",
      "snippet": "searchMatch excerpt"
    }
  ]
}
```

### Step 6: Output Summary

After execution, report to the user:

- Pipeline: total fetched → arXiv filtered → value screened
- Table of final papers (title, authors, year, citations, arXiv link)
- Saved file path
