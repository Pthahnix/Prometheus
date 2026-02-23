# Deep Research Workflow — Recursive Paper Exploration

## Problem

Current research workflow is single-layer: Google Scholar → arXiv filter → AI evaluation. High-recommended papers' references are not explored, missing important foundational and related work.

## Solution

Add recursive DFS-style exploration: after evaluation, extract references from high-rated papers, filter to arXiv-only, evaluate them, and repeat until depth/width thresholds are met.

## Architecture

### New Module: `src/utils_reference.ts`

```typescript
interface Reference {
  title: string;
  arxivId?: string;
  doi?: string;
  year?: number;
}

async function extractReferences(arxivId: string): Promise<Reference[]>
```

Multi-source reference extraction with priority fallback:
1. Semantic Scholar API: `GET /graph/v1/paper/ARXIV:{id}/references?fields=title,externalIds,year`
2. Crossref fallback: get DOI from arXiv metadata → `GET /works/{doi}` for reference list
3. Filter: only return entries with arXiv IDs (consistent with existing arXiv-only strategy)

No API keys required. Semantic Scholar rate limit: 100 req/5min (sufficient for our use case).

### New MCP Tool: `extract_references`

```
name: extract_references
input: { arxiv_id: string }
output: Reference[] — arXiv-only references with title, arxivId, doi?, year?
```

### Recursive Flow (SOP-driven)

```
Layer 0 (initial search)
  Google Scholar → arXiv filter → evaluate_papers
  → high papers [P1, P2, P3...]

Layer 1 (first recursion)
  For each high paper: extract_references(arxivId)
  → merge all refs, deduplicate via global visited set
  → evaluate_papers(new refs)
  → new high papers [R1, R2...]

Layer N
  Repeat until depth >= maxDepth or no new high papers
```

### Control Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxDepth` | 2 | Max recursion depth (0 = initial search only) |
| `maxWidth` | 10 | Max high papers to expand per layer |

Global `visited: Set<string>` (arXiv IDs) shared across all layers to prevent duplicate evaluation.

### Output Format Update

Result JSON in `.assets/paper/` gains layer structure:

```json
{
  "query": "...",
  "config": { "maxDepth": 2, "maxWidth": 10 },
  "layers": [
    {
      "depth": 0,
      "source": "google_scholar",
      "papers": [...]
    },
    {
      "depth": 1,
      "source": "references_of_high_papers",
      "parent_papers": ["2301.00001", "2305.12345"],
      "papers": [...]
    }
  ],
  "stats": {
    "total_evaluated": 45,
    "by_depth": [30, 12, 3],
    "unique_high": 8
  }
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/utils_reference.ts` | **Create** — multi-source reference extraction |
| `src/mcp_server.ts` | **Update** — add `extract_references` tool |
| `.context/XX_apify.md` | **Update** — add recursive deep research steps to SOP |
| `CLAUDE.md` | **Update** — add new tool to table |
| `.test/test-reference.ts` | **Create** — test reference extraction |

## Design Decisions

- **Multi-source over single-source**: Semantic Scholar has good coverage but not 100%. Crossref fallback catches papers S2 misses.
- **arXiv-only filter**: Consistent with existing pipeline. Non-arXiv papers can't be processed by `arxiv2markdown` or `evaluate_papers`.
- **SOP-driven recursion**: Keeps the recursive logic in the skill prompt rather than hardcoded, allowing Claude to adapt (e.g., skip recursion for narrow queries, go deeper for survey-style research).
- **Global visited set**: Prevents wasted API calls and duplicate evaluations across layers.
