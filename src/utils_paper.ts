import 'dotenv/config';
import { SingleStepReasoning } from 'alastor/completion';
import type { ResponseFormatJSONSchema } from 'openai/resources/shared';
import { arxivMarkdown, arxivTitle } from './utils_arxiv.js';
import { markdownFilename, markdownSave } from './utils_markdown.js';

// ── Types ───────────────────────────────────────────────────────────

export interface PaperInput {
  title:      string;
  year?:      number;
  citations?: number;
  arxiv_url:  string;
}

export type Tier           = 'frontier' | 'rising' | 'foundational';
export type Recommendation = 'low' | 'medium' | 'high';

export interface EvaluationResult {
  tier:               Tier;
  recommendation:     Recommendation;
  summary:            string;
  reasoning:          string;
  key_contributions:  string[];
}

export interface PaperResult {
  title:          string;
  arxiv_url:      string;
  markdown_path:  string | null;
  evaluation:     EvaluationResult | null;
  error?:         string;
}

// ── System Prompt ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert academic paper evaluator for an automated research (vibe researching) system. Your task is to assess a paper's value for a given research topic.

## Classification: Tier

Classify the paper into exactly one tier based on its characteristics:

- **frontier**: Recently published work (roughly within the last 6 months). These papers may have few or no citations yet, but they introduce novel ideas, methods, or directions. Look for: new architectures, fresh problem formulations, state-of-the-art results on recent benchmarks, or emerging research directions.

- **rising**: Published within roughly 1-2 years. These papers have begun accumulating citations and their methods are being adopted or validated by others. Look for: growing citation counts relative to age, methods referenced in subsequent work, reproducible results, solid experimental validation.

- **foundational**: Published more than ~2 years ago with significant citation impact. These are landmark or survey papers that define subfields, introduce widely-adopted methods, or provide comprehensive overviews. Look for: high citation counts, methods that became standard, papers frequently cited as baselines or references.

Use the provided metadata (year, citations) as signals, but apply judgment — a 1-year-old paper with unusually high citations may be foundational; a 3-year-old niche paper with moderate citations may be rising.

## Classification: Recommendation

Rate the paper's value for the given research topic:

- **high**: Core paper. Directly addresses the research topic with significant contributions. Essential reading — its methods, findings, or frameworks are likely to inform or inspire new research directions. Worth deep study and citation tracking.

- **medium**: Relevant paper. Provides useful context, related methods, or partial overlap with the research topic. Worth reading in full to understand the landscape, but not central to the research.

- **low**: Peripheral paper. Only tangentially related, or covers well-known ground without novel contribution to the specific topic. A brief summary suffices.

## Output

Respond with a JSON object (no markdown fences):
{
  "tier": "frontier" | "rising" | "foundational",
  "recommendation": "low" | "medium" | "high",
  "summary": "2-3 sentence summary of the paper's core contribution",
  "reasoning": "Why this tier and recommendation, given the research topic",
  "key_contributions": ["contribution 1", "contribution 2", ...]
}`;

// ── Output Schema ───────────────────────────────────────────────────

const OUTPUT_SCHEMA: ResponseFormatJSONSchema = {
  type: 'json_schema',
  json_schema: {
    name: 'paper_evaluation',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        tier:              { type: 'string', enum: ['frontier', 'rising', 'foundational'] },
        recommendation:    { type: 'string', enum: ['low', 'medium', 'high'] },
        summary:           { type: 'string' },
        reasoning:         { type: 'string' },
        key_contributions: { type: 'array', items: { type: 'string' } },
      },
      required: ['tier', 'recommendation', 'summary', 'reasoning', 'key_contributions'],
      additionalProperties: false,
    },
  },
};

// ── Evaluator ───────────────────────────────────────────────────────

function createEvaluator(): SingleStepReasoning {
  const baseUrl   = process.env['BASE_URL_CHAT'];
  const apiKey    = process.env['API_KEY_CHAT'];
  const modelName = process.env['MODEL_CHAT'];
  if (!baseUrl || !apiKey || !modelName) {
    throw new Error('Missing env: BASE_URL_CHAT, API_KEY_CHAT, MODEL_CHAT');
  }
  return new SingleStepReasoning({
    baseUrl,
    apiKey,
    modelName,
    systemPrompt: SYSTEM_PROMPT,
    outputSchema: OUTPUT_SCHEMA,
  });
}

function formatUserPrompt(paper: PaperInput, markdown: string, query: string): string {
  const meta = [
    `Title: ${paper.title}`,
    paper.year      != null ? `Year: ${paper.year}`           : null,
    paper.citations != null ? `Citations: ${paper.citations}` : null,
    `arXiv URL: ${paper.arxiv_url}`,
  ].filter(Boolean).join('\n');

  return `## Research Topic\n${query}\n\n## Paper Metadata\n${meta}\n\n## Full Paper Content\n${markdown}`;
}

/** Evaluate a single paper: download full text, save markdown, run AI evaluation. */
export async function evaluatePaper(
  paper: PaperInput,
  query: string,
  evaluator: SingleStepReasoning,
): Promise<PaperResult> {
  try {
    // 1. Download full text
    const markdown = await arxivMarkdown({ url: paper.arxiv_url });

    // 2. Save to local markdown
    const title = await arxivTitle({ url: paper.arxiv_url });
    const filename = markdownFilename(title);
    const mdPath = markdownSave(markdown, filename);

    // 3. AI evaluation
    const userPrompt = formatUserPrompt(paper, markdown, query);
    const raw = await evaluator.call(userPrompt);
    const evaluation: EvaluationResult = JSON.parse(raw);

    return { title: paper.title, arxiv_url: paper.arxiv_url, markdown_path: mdPath, evaluation };
  } catch (e: any) {
    return {
      title: paper.title,
      arxiv_url: paper.arxiv_url,
      markdown_path: null,
      evaluation: null,
      error: e.message,
    };
  }
}

// ── Batch Processing ────────────────────────────────────────────────

const BATCH_SIZE = 3;

export interface BatchProgress {
  message: string;
  current: number;
  total:   number;
}

/** Evaluate multiple papers in batches of 3. */
export async function evaluatePapers(
  papers: PaperInput[],
  query:  string,
  onProgress?: (p: BatchProgress) => Promise<void>,
): Promise<PaperResult[]> {
  const evaluator = createEvaluator();
  const results: PaperResult[] = [];
  const total = papers.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = papers.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((paper, j) => {
        const idx = i + j + 1;
        onProgress?.({ message: `Evaluating paper ${idx}/${total}: ${paper.title}`, current: idx, total });
        return evaluatePaper(paper, query, evaluator);
      }),
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value);
      } else {
        results.push({
          title: 'unknown',
          arxiv_url: '',
          markdown_path: null,
          evaluation: null,
          error: r.reason?.message ?? String(r.reason),
        });
      }
    }

    // Log batch completion
    const done = Math.min(i + BATCH_SIZE, total);
    await onProgress?.({ message: `Batch complete: ${done}/${total} papers processed`, current: done, total });
  }

  return results;
}
