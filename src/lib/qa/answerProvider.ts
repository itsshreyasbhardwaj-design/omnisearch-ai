import type { SearchResult } from '@/lib/search/types';

export interface AnswerResult {
  /** True only if an LLM actually generated `summary`; false means "here is the evidence, unsynthesized." */
  synthesized: boolean;
  summary: string;
  citations: SearchResult[];
  insufficientEvidence: boolean;
}

export interface AnswerProvider {
  readonly name: string;
  answer(question: string, evidence: SearchResult[]): Promise<AnswerResult>;
}

function citationLine(result: SearchResult, index: number): string {
  const range =
    result.startLine === result.endLine
      ? `L${result.startLine}`
      : `L${result.startLine}-${result.endLine}`;
  return `[${index + 1}] ${result.repoName}/${result.filePath}:${range}`;
}

/**
 * Default provider: no generation, no hallucination risk. The "answer" is
 * literally the retrieved evidence, ranked and cited — every claim traces
 * to a real file/line because nothing is claimed beyond what retrieval
 * found. This is what ships with an empty `.env`.
 */
export const extractiveAnswerProvider: AnswerProvider = {
  name: 'extractive',
  async answer(question, evidence) {
    if (evidence.length === 0) {
      return {
        synthesized: false,
        summary: `No indexed content matches "${question}" closely enough to answer from. Try rephrasing, or index the relevant repository first.`,
        citations: [],
        insufficientEvidence: true,
      };
    }

    const summary = [
      `No AI synthesis is configured — showing the ${evidence.length} most relevant location${evidence.length === 1 ? '' : 's'} for "${question}":`,
      ...evidence.map(citationLine),
    ].join('\n');

    return { synthesized: false, summary, citations: evidence, insufficientEvidence: false };
  },
};

/**
 * Real, but inert without OPENROUTER_API_KEY — never called unless a key is
 * configured (see getAnswerProvider()). Grounds the model strictly in the
 * retrieved evidence and instructs it to say so rather than guess when the
 * evidence doesn't answer the question, per the "never fabricate repository
 * evidence" requirement.
 */
export const openRouterAnswerProvider: AnswerProvider = {
  name: 'openrouter',
  async answer(question, evidence) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return extractiveAnswerProvider.answer(question, evidence);
    }
    if (evidence.length === 0) {
      return extractiveAnswerProvider.answer(question, evidence);
    }

    const model = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-3.5-haiku';
    const baseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';

    const context = evidence
      .map((r, i) => `${citationLine(r, i)}\n${r.snippetHtml.replace(/<[^>]+>/g, '')}`)
      .join('\n\n');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Answer strictly from the provided repository evidence, citing sources by their [N] number. If the evidence does not answer the question, say so explicitly instead of guessing. Never invent file paths, line numbers, or code that is not in the evidence.',
          },
          { role: 'user', content: `Question: ${question}\n\nEvidence:\n${context}` },
        ],
      }),
    });

    if (!response.ok) {
      return extractiveAnswerProvider.answer(question, evidence);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return extractiveAnswerProvider.answer(question, evidence);
    }

    return { synthesized: true, summary: text, citations: evidence, insufficientEvidence: false };
  },
};

export function getAnswerProvider(): AnswerProvider {
  return process.env.OPENROUTER_API_KEY ? openRouterAnswerProvider : extractiveAnswerProvider;
}
