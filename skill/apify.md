# Google Scholar Research

Use `marco.gullo/google-scholar-scraper` to search academic papers on Google Scholar, filter for arXiv-only sources, evaluate with AI, and save results.

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

Since only arXiv papers are kept (arXiv typically accounts for ~20-30\% of Google Scholar results), the fetch volume should be 3-5x the target paper count.

**Before execution, state**: which breadth level was chosen, the rationale, and the `maxItems` value.

### Step 2: Dual Query — Capture Both Frontier and Classic Work

Execute **two** queries to Google Scholar and merge results:

**Query A — Frontier (newest work):**

```json
{
  "keyword": "<search keywords>",
  "maxItems": "<from Step 1>",
  "sortBy": "date",
  "proxyOptions": { "useApifyProxy": true }
}
```

**Query B — Relevance (high-impact / classic work):**

```json
{
  "keyword": "<search keywords>",
  "maxItems": "<from Step 1>",
  "sortBy": "relevance",
  "proxyOptions": { "useApifyProxy": true }
}
```

**Merge & Deduplicate:** Combine results from both queries. Deduplicate by arXiv URL (or title if URL unavailable). Keep the entry with richer metadata when duplicates are found.

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

### Step 4: AI-Powered Paper Evaluation

Call the Prometheus MCP tool `evaluate_papers` with the arXiv-filtered paper list:

```json
{
  "papers": [
    {
      "title": "Paper title",
      "year": 2026,
      "citations": 0,
      "arxiv_url": "https://arxiv.org/abs/..."
    }
  ],
  "query": "original research topic"
}
```

The tool will, for each paper:

1. Download full text via `arxiv2markdown`
2. Save markdown to local `.assets/markdown/`
3. Run AI evaluation (tier + recommendation)

Each paper receives:

- **Tier**: `frontier` (recent, novel) / `rising` (gaining traction) / `foundational` (landmark work)
- **Recommendation**: `low` / `medium` / `high`
- **Summary**: 2-3 sentence overview
- **Key contributions**: list of core contributions

### Step 5: Save Results

Save evaluated papers as a JSON file in `.assets/paper/`.

**Filename format:** `{YYYY-MM-DD}_{topic_keywords}.json`

- Date is the execution date
- Topic keywords: core words from user input, lowercase, spaces to `_`, strip special characters
- Example: `2026-02-21_llm_reasoning.json`

**JSON structure:**

```json
{
  "query": "original search keywords",
  "date": "execution date",
  "total_fetched": 160,
  "arxiv_count": 45,
  "evaluated_count": 45,
  "papers": [
    {
      "title": "Paper title",
      "authors": "Author list",
      "year": 2026,
      "citations": 0,
      "arxiv_url": "arXiv link",
      "snippet": "searchMatch excerpt",
      "markdown_path": "local markdown file path",
      "tier": "frontier",
      "recommendation": "high",
      "summary": "AI-generated summary",
      "key_contributions": ["contribution 1"]
    }
  ]
}
```

### Step 6: Output Summary

After execution, report to the user:

- Pipeline: total fetched → arXiv filtered → evaluated
- **Three tables grouped by recommendation level:**
  - **High** (core papers): title, tier, year, citations, arXiv link — these papers' full markdown is saved and their references should be tracked for deeper research
  - **Medium** (relevant papers): title, tier, year, citations, arXiv link — full markdown saved, worth reading
  - **Low** (peripheral papers): title, tier, AI summary — only summary provided, no deep reading needed
- Saved JSON file path
- Saved markdown directory path
