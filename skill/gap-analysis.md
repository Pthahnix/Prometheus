# Gap Analysis

Identify research gaps from literature survey results. This is Stage 2 of the research pipeline.

## Input

- Reading notes from Stage 1 (Literature Survey)
- Domain landscape summary

## Prerequisites

- Completed literature survey with rated and read papers
- Prompt: `prompt/gap-discovery.md`

## Process

### 1. Organize Reading Notes

Gather all Pass 1-2-3 notes from the literature survey. Group papers by theme/cluster identified in the domain landscape.

### 2. Apply Gap Discovery

Apply `prompt/gap-discovery.md` to the full collection of notes. This produces:
- Method comparison matrix
- Contradiction detection
- Blank identification
- Trend analysis

### 3. Validate Gaps

For each identified gap, verify:
- Is this genuinely unexplored, or did we miss a paper? → Quick `acd_search` to check
- Is this gap because it's hard/impossible, or because nobody tried?
- Is there a reason this hasn't been done (data unavailable, compute prohibitive)?

Discard gaps that turn out to be already addressed or infeasible.

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
