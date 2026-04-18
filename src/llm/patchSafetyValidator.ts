import { UnifiedDiffParser } from '../sandbox/unifiedDiffParser';
import { BugContext, ParsedPatch, PatchProposal, PatchRiskAssessment } from '../types/agent';

export interface PatchSafetyResult {
  safe: boolean;
  issues: string[];
  parsedPatch?: ParsedPatch;
  risk: PatchRiskAssessment;
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

    const risk = this.assessRisk(parseResult.patch);

    return {
      safe: issues.length === 0,
      issues,
      parsedPatch: parseResult.patch,
      risk,
    };
  }

  private assessRisk(parsedPatch: ParsedPatch | undefined): PatchRiskAssessment {
    if (!parsedPatch) {
      return {
        level: 'high',
        reasons: ['Patch could not be parsed, so risk cannot be bounded.'],
        changedFiles: 0,
        changedLines: 0,
      };
    }

    const reasons: string[] = [];
    const changedFiles = parsedPatch.files.length;
    const changedLines = parsedPatch.files.flatMap((file) => file.hunks)
      .flatMap((hunk) => hunk.lines)
      .filter((line) => line.type === 'add' || line.type === 'remove').length;
    const sensitiveFile = parsedPatch.files.some((file) =>
      /(^|[\\/])(package\.json|package-lock\.json|tsconfig\.json|\.env|\.github)([\\/]|$)/.test(file.newFilePath),
    );

    if (changedFiles > 1) {
      reasons.push('Patch changes multiple files.');
    }

    if (changedLines > 20) {
      reasons.push('Patch changes more than 20 lines.');
    }

    if (sensitiveFile) {
      reasons.push('Patch touches configuration, dependency, environment, or workflow files.');
    }

    if (reasons.length === 0) {
      reasons.push('Patch is a small single-file change.');
    }

    return {
      level: sensitiveFile || changedFiles > 2 || changedLines > 40
        ? 'high'
        : changedFiles > 1 || changedLines > 20
          ? 'medium'
          : 'low',
      reasons,
      changedFiles,
      changedLines,
    };
  }
}
