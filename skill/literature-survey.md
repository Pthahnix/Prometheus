# Literature Survey

Comprehensive literature review on a research topic. This is Stage 1 of the research pipeline.

## Input

$ARGUMENTS — research topic or question

## Prerequisites

- Prometheus MCP tools available (acd_search, web_search, dfs_search, paper_content)
- Prompts: `prompt/paper-rating.md`, `prompt/paper-reading.md`

## Process

### 1. Decompose the Topic

Break the research topic into 2-3 search angles:
- **Core**: the topic itself, most direct query
- **Methods**: key techniques or approaches used in this area
- **Applications/Adjacent**: related domains or downstream applications

Example for "efficient inference of large language models":
- Core: "efficient LLM inference"
- Methods: "model quantization pruning distillation"
- Adjacent: "LLM deployment edge devices"

### 2. Multi-Angle Search

Fire searches in parallel:
- `acd_search` × 2-3 (one per angle)
- `web_search` × 1 (topic + "survey" or "awesome" or "workshop")

Collect all results. Deduplicate by `normalizedTitle`.

### 3. Rate Papers

For each unique paper, apply `prompt/paper-rating.md`:
- Use title, abstract, year, citations, venue
- Rate: High / Medium / Low
- This is a quick pass — spend seconds per paper, not minutes

### 4. Read Papers

Apply `prompt/paper-reading.md` based on rating:
- **High**: Pass 1 → Pass 2 → Pass 3 (full three-pass)
- **Medium**: Pass 1 → Pass 2
- **Low**: Pass 1 only (or skip if clearly irrelevant)

Read the cached markdown (check `markdownDir` field). If full text not available, work from abstract only and note the gap.

### 5. Expand via References

For the top 2-3 High-rated papers:
- `dfs_search(depth=1, breadth=5)` to discover important references
- Rate and read any newly discovered papers that look relevant

Stop expanding when new papers are mostly duplicates.

### 6. Compile Output

Produce a structured literature survey:

```
## Literature Survey: [topic]

### Search Summary
- Angles searched: [list]
- Papers found: [total] (after dedup)
- Rated: [X high, Y medium, Z low]

### Domain Landscape
[2-3 paragraphs: what is this field about, major threads, key debates]

### High-Priority Papers
[For each: title, year, Pass 1-2-3 notes, why it matters]

### Medium-Priority Papers
[For each: title, year, Pass 1-2 notes, key takeaway]

### Low-Priority Papers
[Brief list: title, year, one-line note]

### Key Themes
[Bullet list of major themes/clusters discovered]

### Open Questions
[What couldn't be answered, what needs deeper investigation]
```

## Decision Points

- If initial searches return < 5 relevant papers → broaden queries, try synonyms
- If > 30 papers → tighten queries, raise rating threshold
- If a subfield emerges as critical → run focused acd_search on it
- If a seminal paper keeps getting cited → ensure it's in your High list

## Next Stage

Pass the reading notes and domain landscape to **Gap Analysis** (skill/gap-analysis.md).
