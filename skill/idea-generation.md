# Idea Generation

Generate and evaluate research ideas from identified gaps. This is Stage 3 of the research pipeline.

## Input

- Ranked gap list from Stage 2 (Gap Analysis)
- Literature survey notes for context

## Prerequisites

- Completed gap analysis with ranked gaps
- Prompt: `prompt/idea-scoring.md`

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

### 3. Score Ideas

Apply `prompt/idea-scoring.md` to each idea:
- Novelty (1-10)
- Feasibility (1-10)
- Impact (1-10)
- Clarity (1-10)
- Evidence (1-10)

Be honest and critical. Most ideas should score 4-6 on most dimensions. A 9-10 on any dimension should be rare and well-justified.

### 4. Rank and Recommend

Sort by total score. Present Top 3 with detailed recommendation.

### 5. Compile Output

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
