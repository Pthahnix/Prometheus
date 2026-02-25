# Gap Analysis

Identify research gaps from literature survey results. This is Stage 2 of the research pipeline.

## Input

- Reading notes from Stage 1 (Literature Survey)
- Domain landscape summary

## Prerequisites

- Completed literature survey with rated and read papers
- Prompts: `prompt/gap-discovery.md`, `prompt/validate-gap.md`
- Tools: acd_search, web_search, pplx_ask (fallback), pplx_deep_research (validation)

## Process

### 1. Organize Reading Notes

Gather all Pass 1-2-3 notes from the literature survey. Group papers by theme/cluster identified in the domain landscape.

### 2. Apply Gap Discovery

Apply `prompt/gap-discovery.md` to the full collection of notes. This produces:
- Method comparison matrix
- Contradiction detection
- Blank identification
- Trend analysis

### 3. Validate Gaps (dual-source verification)

For each candidate gap:
a. `acd_search`: search for papers that may have addressed this gap
b. `web_search`: search for blog posts, preprints, GitHub repos addressing this gap
c. **Only if conflicting signals or low confidence**: `pplx_ask` — "Has [gap description] been addressed in recent work in [field]? Cite specific papers."
d. Discard gaps that are already addressed or clearly infeasible
e. Adjust ranking based on validation findings

### 4. Rank Gaps

Rank remaining gaps by: feasibility × potential impact × novelty.

High-rank gaps are:
- Clearly feasible with available resources
- Would make a meaningful contribution if solved
- Haven't been attempted (or only poorly attempted)

### 5. Compile Output

```
## Gap Analysis: [topic]

### Method Comparison Matrix
[table from gap-discovery prompt]

### Contradictions Found
[numbered list with evidence]

### Research Gaps (ranked)

#### Gap 1: [title]
- Type: [contradiction / blank / limitation / trend]
- Description: [2-3 sentences]
- Evidence: [specific papers and findings]
- Feasibility: [high/medium/low + why]
- Potential impact: [high/medium/low + why]

#### Gap 2: ...

### Field Trends
[where the field is heading, what's gaining/losing traction]
```

## Decision Points

- If few gaps found → the survey may have been too narrow, go back and expand
- If too many gaps → focus on the top 5-7 most promising
- If a gap needs more evidence → targeted acd_search or dfs_search to investigate

## Next Stage

Pass the ranked gap list to **Idea Generation** (skill/idea-generation.md).

## Validation Checkpoint (Mandatory)

After completing the ranked gap list, run stage-end validation:

1. Load `prompt/validate-gap.md`, replace `{{GAP_OUTPUT}}` with the full gap list + evidence
2. Call `pplx_deep_research` with the filled prompt
3. Parse the JSON response and process issues:
   - **CRITICAL**: HALT. A gap claimed as open is actually solved, or a critical gap was missed entirely. Report to user.
   - **WARNING**: Auto-fix — run targeted `acd_search` + `web_search` to verify. Re-check with `pplx_ask` (max 2 rounds).
   - **INFO**: Log and incorporate.
4. Only proceed to Stage 3 (Idea Generation) after all CRITICAL issues resolved.

## Tool Priority Reminder

```
Priority 1 (free):     acd_search, web_search
Priority 2 (cheap):    pplx_ask — ONLY for ambiguous gaps after Priority 1
Priority 4 (expensive): pplx_deep_research — exactly 1x (mandatory validation)
```
