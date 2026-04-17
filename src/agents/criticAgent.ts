import { BugContext, CritiqueResult, PatchProposal } from '../types/agent';

export class CriticAgent {
  reviewProposal(bugContext: BugContext, proposal: PatchProposal): CritiqueResult {
    const issues: string[] = [];
    const improvementSuggestions: string[] = [];

    if (!proposal.diffText || !proposal.diffText.includes('+++')) {
      issues.push('Patch proposal does not contain a valid diff structure.');
      improvementSuggestions.push('Generate a unified diff with before and after file markers.');
    }

    if (proposal.confidence < 0.5) {
      issues.push('Patch confidence is low.');
      improvementSuggestions.push('Strengthen the reasoning using failing test output and code context.');
    }

    const hasCodeContext = !!bugContext.relevantCode && bugContext.relevantCode.trim().length > 0;
    const hasExecutionFeedback = !!bugContext.errorOutput || !!bugContext.failingTest;

    if (!hasCodeContext) {
      issues.push('Patch is missing concrete code context from the target file.');
      improvementSuggestions.push('Open or select the relevant file so the debugger can ground the patch in real code.');
    }

    if (!hasExecutionFeedback) {
      issues.push('Patch is missing execution feedback from failing tests or runtime output.');
      improvementSuggestions.push('Provide failing test output or error logs to improve fix accuracy.');
    }

    const rationale = proposal.rationale.toLowerCase();
    const isRevision = proposal.summary.toLowerCase().includes('revised');
    if (isRevision && hasCodeContext && !rationale.includes('addressing critique') && proposal.confidence >= 0.5) {
      issues.push('Proposal confidence increased without clearly explaining what changed.');
      improvementSuggestions.push('Explain which critique points were incorporated into the revised patch.');
    }

    return {
      approved: issues.length === 0,
      issues,
      improvementSuggestions,
    };
  }
}
