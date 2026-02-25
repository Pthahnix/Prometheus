# Idea Generation

Generate and evaluate research ideas from identified gaps. This is Stage 3 of the research pipeline.

## Input

- Ranked gap list from Stage 2 (Gap Analysis)
- Literature survey notes for context

## Prerequisites

- Completed gap analysis with ranked gaps
- Prompts: `prompt/idea-scoring.md`, `prompt/validate-idea.md`
- Tools: web_search, acd_search, pplx_ask (fallback), pplx_deep_research (validation)

## Process

### 1. Select Top Gaps

Focus on the top 3-5 gaps from the ranked list. Don't try to address every gap.

### 2. Generate Ideas

For each selected gap, generate 2-3 concrete research ideas:
- Each idea should be a specific, actionable research direction
- Not vague ("improve X") but concrete ("apply technique A to problem B using dataset C")
- Consider: can existing methods be combined in new ways? Can a method from domain X be transferred to domain Y? Can a limitation be turned into a feature?

Idea generation approaches:
- **Combination**: merge strengths of two existing methods
- **Transfer**: apply a technique from another field
- **Inversion**: challenge an assumption everyone makes
- **Scale**: apply existing method to new scale (bigger/smaller/different domain)
- **Simplification**: achieve similar results with a simpler approach

### 3. Novelty Pre-Check (per idea, before scoring)

For each generated idea:
a. `web_search`: search for the idea's core technique/combination — look for existing implementations
b. `acd_search`: search for papers with similar approach
c. **If either search finds a close match**: `pplx_ask` — "Does [specific paper/project] already implement [idea description]? What are the differences?"
d. If prior art confirmed: either discard the idea or reframe it as an extension (adjust novelty score accordingly)
e. If no prior art found: proceed to scoring

This step prevents the critical failure mode of claiming "first" when prior art exists.

### 4. Score Ideas

Apply `prompt/idea-scoring.md` to each idea:
- Novelty (1-10)
- Feasibility (1-10)
- Impact (1-10)
- Clarity (1-10)
- Evidence (1-10)

Be honest and critical. Most ideas should score 4-6 on most dimensions. A 9-10 on any dimension should be rare and well-justified.

### 5. Rank and Recommend

Sort by total score. Present Top 3 with detailed recommendation.

### 6. Compile Output

```
## Research Ideas: [topic]

### Ideas Generated
[total count] ideas from [N] gaps

### All Ideas (ranked)

#### Idea 1: [title] — Score: XX/50
- Addresses Gap: [gap number and title]
- Description: [2-3 sentences]
- Scores: N:X F:X I:X C:X E:X
- Key insight: [why this could work]

#### Idea 2: ...

### Top 3 Recommendations

#### Recommended #1: [title]
[2-3 sentences: why this is the best bet, what makes it promising, what the main risk is]

#### Recommended #2: ...
#### Recommended #3: ...

### Discarded Ideas
[Brief list of ideas that scored low, with one-line reason]
```

## Decision Points

- If all ideas score low (< 25/50) → gaps may be too hard, revisit gap analysis
- If ideas cluster around one gap → that gap is the most fertile, focus there
- If user has domain expertise → present ideas and ask for feedback before finalizing

## Next Stage

Pass selected idea to **Experiment Design** (skill/experiment-design.md).

## Validation Checkpoint (Mandatory)

After completing scored idea cards + Top 3 recommendations, run stage-end validation:

1. Load `prompt/validate-idea.md`, replace `{{IDEA_OUTPUT}}` with the full idea cards + scores + rationale
2. Call `pplx_deep_research` with the filled prompt
3. Parse the JSON response and process issues:
   - **CRITICAL**: HALT. A "novel" idea already has direct prior art, or a core feasibility assumption is wrong. Report to user.
   - **WARNING**: Auto-fix — adjust scores, reframe claims, add caveats. Re-check with `pplx_ask` (max 2 rounds).
   - **INFO**: Log and incorporate.
4. Only proceed to Stage 4 (Experiment Design) after all CRITICAL issues resolved.

## Tool Priority Reminder

```
Priority 1 (free):     web_search, acd_search — for novelty pre-check
Priority 2 (cheap):    pplx_ask — ONLY for ambiguous prior art matches
Priority 4 (expensive): pplx_deep_research — exactly 1x (mandatory validation)
```
