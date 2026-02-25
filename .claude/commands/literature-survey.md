# Literature Survey

Comprehensive literature review on a research topic. This is Stage 1 of the research pipeline.

## Input

$ARGUMENTS — research topic or question

## Prerequisites

- Prometheus MCP tools available (acd_search, web_search, dfs_search, paper_content, web_content)
- Perplexity tools available (pplx_search, pplx_ask, pplx_pro_research, pplx_deep_research)
- Prompts: `prompt/paper-rating.md`, `prompt/paper-reading.md`, `prompt/validate-survey.md`

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

Fire searches in parallel (cast a wide net):
- `acd_search` × 2-3 (one per angle)
- `web_search` × 2-3 (match acd_search count; target GitHub awesome-lists, workshop proceedings, blog roundups, preprint servers)
- Deduplicate by `normalizedTitle`
- **Fallback**: If total relevant papers < 15 after dedup, add 1-2x `pplx_search(academic)` with different query angles

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

### 6. Per-Paper Augmentation (Tier 1 — HIGH papers only)

For each HIGH paper, after three-pass reading + citation expansion:
a. `web_search`: `"{paper_title}" blog review analysis interpretation`
b. `acd_search`: search for papers citing or improving upon this work
c. **Only if steps a-b yield < 3 useful results**: `pplx_search(web)` + `pplx_search(academic)` as fallback

Goal: build a 360° understanding — paper itself + community reception + follow-up works.

### 7. Tangential Exploration (Tier 3 — exactly 1 call per pipeline)

After all papers are read and notes compiled, run:
- `pplx_pro_research`: "What are the most recent breakthroughs, preprints, and unconventional approaches in [TOPIC] that may not appear in top-cited papers? Include workshop papers, industry blogs, and GitHub projects."
- Integrate any newly discovered important works into the landscape.

### 8. Compile Output

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

## Validation Checkpoint (Mandatory)

After completing the domain landscape, run stage-end validation:

1. Load `prompt/validate-survey.md`, replace `{{SURVEY_OUTPUT}}` with the full landscape + reading notes
2. Call `pplx_deep_research` with the filled prompt
3. Parse the JSON response and process issues:
   - **CRITICAL**: HALT. Report to user with evidence. Wait for user decision.
   - **WARNING**: Auto-fix — run targeted searches to fill gaps or correct claims. Re-validate fixed sections with `pplx_ask` (max 2 rounds). If still WARNING after 2 rounds, escalate to user.
   - **INFO**: Log and incorporate if trivial.
4. Only proceed to Stage 2 (Gap Analysis) after all CRITICAL issues are resolved and WARNINGs are addressed.

## Tool Priority Reminder

```
Priority 1 (free):     acd_search, web_search, dfs_search, paper_content
Priority 2 (cheap):    pplx_search, pplx_ask — ONLY after Priority 1 exhausted
Priority 3 (moderate): pplx_pro_research — exactly 1x (Tier 3 exploration)
Priority 4 (expensive): pplx_deep_research — exactly 1x (mandatory validation)
```
