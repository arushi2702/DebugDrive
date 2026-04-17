import { PatchProposal } from '../types/agent';

export interface PatchResponseParseResult {
  ok: boolean;
  proposal?: PatchProposal;
  error?: string;
}

export class PatchResponseParser {
  parse(rawContent: string): PatchResponseParseResult {
    try {
      const parsed = JSON.parse(rawContent) as Partial<PatchProposal>;

      if (!parsed.summary || typeof parsed.summary !== 'string') {
        return { ok: false, error: 'Model response is missing a string summary.' };
      }

      if (!parsed.rationale || typeof parsed.rationale !== 'string') {
        return { ok: false, error: 'Model response is missing a string rationale.' };
      }

      if (!parsed.diffText || typeof parsed.diffText !== 'string') {
        return { ok: false, error: 'Model response is missing string diffText.' };
      }

      if (!parsed.candidateContent || typeof parsed.candidateContent !== 'string') {
        return { ok: false, error: 'Model response is missing string candidateContent.' };
      }

      if (typeof parsed.confidence !== 'number') {
        return { ok: false, error: 'Model response is missing numeric confidence.' };
      }

      if (parsed.confidence < 0 || parsed.confidence > 1) {
        return { ok: false, error: 'Model confidence must be between 0 and 1.' };
      }

      return {
        ok: true,
        proposal: {
          summary: parsed.summary,
          rationale: parsed.rationale,
          diffText: parsed.diffText,
          candidateContent: parsed.candidateContent,
          confidence: parsed.confidence,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown JSON parse error.',
      };
    }
  }
}
