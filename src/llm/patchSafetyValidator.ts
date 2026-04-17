import { UnifiedDiffParser } from '../sandbox/unifiedDiffParser';
import { BugContext, ParsedPatch, PatchProposal } from '../types/agent';

export interface PatchSafetyResult {
  safe: boolean;
  issues: string[];
  parsedPatch?: ParsedPatch;
}

export class PatchSafetyValidator {
  constructor(private readonly parser = new UnifiedDiffParser()) {}

  validate(bugContext: BugContext, proposal: PatchProposal): PatchSafetyResult {
    const issues: string[] = [];
    const targetFile = bugContext.filePath;
    const parseResult = this.parser.parse(proposal.diffText);

    if (!parseResult.ok || !parseResult.patch) {
      issues.push(`Patch diff failed parsing: ${parseResult.error ?? 'Unknown parse error.'}`);
    }

    if (targetFile && !proposal.diffText.includes(targetFile)) {
      issues.push('Patch diff does not reference the active target file.');
    }

    if (!proposal.candidateContent.trim()) {
      issues.push('Candidate content is empty.');
    }

    if (proposal.confidence < 0 || proposal.confidence > 1) {
      issues.push('Patch confidence is outside the valid range.');
    }

    return {
      safe: issues.length === 0,
      issues,
      parsedPatch: parseResult.patch,
    };
  }
}
