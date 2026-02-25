# Implementation Plan: Research Workflow (Strategy-First)

Design: `docs/plans/2026-02-25-research-workflow-design.md`
Branch: `worktree-research-workflow`

## Steps

### Step 1: Create `src/utils/prompt.ts`

Single function: `load(name: string): string` — reads `prompt/<name>.md` from project root, returns content.
Use `fs.readFileSync`, resolve path relative to project root (use `import.meta.url` or `process.cwd()`).
No MCP tool registration needed — this is an internal util only.

### Step 2: Create `prompt/paper-reading.md`

Three-pass reading method based on Keshav 2007:
- Pass 1 (Bird's eye, ~1min): title, abstract, intro/conclusion, figures → category, context, contributions, quality
- Pass 2 (Detailed): key arguments, method core, experiment design, unknowns → method summary, results, related work
- Pass 3 (Reconstruct, High-rated only): rebuild reasoning, find assumptions, flaws, improvements → deep analysis

Output format: structured markdown with sections per pass.

### Step 3: Create `prompt/paper-rating.md`

Rating criteria and output format:
- Inputs: paper metadata (title, abstract, year, citations, venue) + research topic
- Criteria: relevance, citation-to-age ratio, venue quality, novelty, recency
- Output: Low / Medium / High with one-line justification
- Low = skip, Medium = Pass 1-2, High = Pass 1-2-3

### Step 4: Create `prompt/gap-discovery.md`

Cross-paper analysis prompt:
- Input: collection of reading notes from literature survey
- Tasks: method comparison matrix, contradiction detection, blank identification, trend analysis
- Each gap must cite specific papers as evidence
- Output: numbered gap list, ranked by research potential

### Step 5: Create `prompt/idea-scoring.md`

Five-dimension scoring prompt:
- Input: idea description + gap context + literature context
- Dimensions (1-10): Novelty, Feasibility, Impact, Clarity, Evidence
- Output: score card per idea + weighted total + ranking + Top 3 recommendation

### Step 6: Create `skill/literature-survey.md`

Stage 1 SOP. References prompt/paper-rating.md and prompt/paper-reading.md.
Steps: multi-angle acd_search → web_search → rate → read → dfs_search → compile notes.
Must specify: how to choose search angles, when to stop expanding, output structure.

### Step 7: Create `skill/gap-analysis.md`

Stage 2 SOP. References prompt/gap-discovery.md.
Steps: load reading notes → apply gap-discovery prompt → organize and rank gaps.
Must specify: input format expectations, how to handle sparse data.

### Step 8: Create `skill/idea-generation.md`

Stage 3 SOP. References prompt/idea-scoring.md.
Steps: load gaps → generate ideas per gap → score → rank → present Top 3.
Must specify: idea generation approach, scoring process, output format.

### Step 9: Create `skill/experiment-design.md` (skeleton)

Stage 4 SOP — minimal skeleton for future expansion.
Outline: select idea → design methodology → datasets/baselines/metrics → hardware estimate.
Mark as "future: Pod integration" for execution step.

### Step 10: Update `skill/prometheus.md` and `skill/research.md`

- prometheus.md: add new skills to the strategy table, link to literature-survey/gap-analysis/idea-generation
- research.md: add note about advanced workflow pointing to the new skills

### Step 11: Update CLAUDE.md and memory

- CLAUDE.md: add prompt/ directory to conventions, mention new skills
- Memory: update with new file structure

### Step 12: Commit and verify

Commit all changes on worktree branch. Verify files are correct.
