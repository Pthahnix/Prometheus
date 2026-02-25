# Research Workflow Design — Strategy-First

Date: 2026-02-25
Status: Approved

## Overview

Extend Prometheus from a retrieval toolkit into a scientific research workflow system.
Add structured Skills (SOPs) and Prompts that orchestrate existing MCP tools to enable:
**Topic → Literature Survey → Gap Analysis → Idea Generation → Experiment Design**

No new MCP tools. All new capability via skill/ and prompt/ files, plus one tiny util.

## Architecture

Three-concept system:

- **Tools** (src/) — MCP weapons. Already built: paper_content, acd_search, dfs_search, web_search, web_content
- **Strategies** (skill/) — SOPs that tell the Agent how to combine tools for research tasks
- **Prompts** (prompt/) — LLM prompt templates loaded at runtime via utils/prompt.ts

```
prometheus/
├── src/utils/prompt.ts      # load(name) → reads prompt/*.md
├── prompt/
│   ├── paper-reading.md     # Three-pass reading method (Keshav)
│   ├── paper-rating.md      # Low/Medium/High rating criteria
│   ├── gap-discovery.md     # Cross-paper gap analysis
│   └── idea-scoring.md      # 5-dimension idea scoring
├── skill/
│   ├── prometheus.md         # Master entry (updated)
│   ├── literature-survey.md  # Stage 1 SOP
│   ├── gap-analysis.md       # Stage 2 SOP
│   ├── idea-generation.md    # Stage 3 SOP
│   └── experiment-design.md  # Stage 4 SOP (skeleton)
```

## Four-Stage Research Pipeline

### Stage 1: Literature Survey (skill/literature-survey.md)

Input: Research topic
Process:
1. acd_search × 3 angles (core topic, methods, applications)
2. web_search × 1 (non-paper sources: blogs, workshops, GitHub)
3. Rate each paper (prompt/paper-rating.md) → Low/Medium/High
4. Read Medium+High papers with three-pass method (prompt/paper-reading.md)
5. dfs_search on top-cited papers to expand coverage
6. Compile structured reading notes + field map

Output: Reading notes per paper + domain landscape summary

### Stage 2: Gap Analysis (skill/gap-analysis.md)

Input: Reading notes from Stage 1
Process:
1. Build method comparison matrix (method × dataset × metric)
2. Detect contradictions between papers
3. Identify blanks: mentioned-but-unexplored directions, missing datasets/scenarios
4. Analyze trends: hot topics shifting in last 1-2 years

Output: Ranked gap list with evidence chains (citing specific papers)

### Stage 3: Idea Generation (skill/idea-generation.md)

Input: Gap list from Stage 2
Process:
1. Generate 2-3 ideas per gap
2. Score each idea on 5 dimensions (prompt/idea-scoring.md):
   Novelty, Feasibility, Impact, Clarity, Evidence (1-10 each)
3. Rank and recommend Top 3

Output: Idea cards with scores + recommendation rationale

### Stage 4: Experiment Design (skill/experiment-design.md) — skeleton

Input: Selected idea from Stage 3
Process:
1. Design experiment methodology
2. Identify datasets, baselines, metrics
3. Estimate hardware requirements (prep for future Pod integration)

Output: Experiment plan document

## Prompt Design

### paper-reading.md
Three-pass method (Keshav 2007):
- Pass 1 (Bird's eye): Title, abstract, intro/conclusion, scan figures. Output: category, context, contributions, quality.
- Pass 2 (Detailed): Key arguments, method core, experiment design, mark unknowns. Output: method summary, key results, related work connections.
- Pass 3 (Reconstruct, High-rated only): Rebuild paper's reasoning from scratch, find hidden assumptions, flaws, improvements.

### paper-rating.md
Criteria: relevance to topic, citation count, venue quality, recency, method novelty.
Output: Low (skip) / Medium (Pass 1-2) / High (Pass 1-2-3).

### gap-discovery.md
Cross-paper analysis: method comparison matrix, contradiction detection, blank identification, trend analysis.
Each gap backed by evidence citing specific papers and passages.

### idea-scoring.md
Five dimensions (1-10): Novelty, Feasibility, Impact, Clarity, Evidence.
Weighted total with justification per dimension.

## Implementation Scope

**Code:** `src/utils/prompt.ts` — single function `load(name: string): string`
**Prompts:** 4 markdown files in `prompt/`
**Skills:** 4 new + 2 updated in `skill/`
**Not doing:** No new MCP tools, no Pod, no .cache/research/ automation

## Future: Pod Integration (next phase)

- `utils/runpod.ts` — RunPod API wrapper
- `tools/pod.ts` — pod_create, pod_status, pod_destroy MCP tools
- Prometheus evaluates hardware needs → auto-provisions GPU → returns SSH → Agent executes
- Connects to Stage 4 experiment execution
