import { CriticAgent } from '../agents/criticAgent';
import { DebuggerAgent } from '../agents/debuggerAgent';
import { LlmDebuggerAgent } from '../agents/llmDebuggerAgent';
import { TesterAgent } from '../agents/testerAgent';
import {
  AgentDecision,
  AgentMessage,
  BugContext,
  CodeChunkRecord,
  CritiqueResult,
  PatchProposal,
  RetrievalRecord,
  TestResult,
} from '../types/agent';
import { DebugSession } from '../types/session';
import { ModelProvider } from '../llm/modelProvider';
import { MockModelProvider } from '../llm/mockModelProvider';
import { PatchSafetyValidator } from '../llm/patchSafetyValidator';

export class DebugCoordinator {
    constructor(
    private readonly debuggerAgent = new DebuggerAgent(),
    modelProvider: ModelProvider = new MockModelProvider(),
    private readonly criticAgent = new CriticAgent(),
        private readonly testerAgent = new TesterAgent(),
    private readonly patchSafetyValidator = new PatchSafetyValidator(),
  ) {
    this.llmDebuggerAgent = new LlmDebuggerAgent(modelProvider);
  }

  private readonly llmDebuggerAgent: LlmDebuggerAgent;

  createSession(bugContext: BugContext, maxRounds = 3): DebugSession {
    const now = Date.now();

    return {
      id: `session-${now}`,
      bugContext,
      messages: [],
      modelTranscripts: [],
      currentRound: 0,
      maxRounds,
      patchWorkspace: {
        targetFilePath: bugContext.filePath,
        originalContent: bugContext.relevantCode,
        rollbackContent: bugContext.relevantCode,
        rollbackAvailable: false,
        candidateContent: undefined,
        candidateDiff: undefined,
        tempFilePath: undefined,
        materialized: false,
        validated: false,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

    async runSession(
    session: DebugSession,
    retrievedMemories: RetrievalRecord[] = [],
    retrievedCodeChunks: CodeChunkRecord[] = [],
  ): Promise<AgentDecision> {
    let latestDecision: AgentDecision = { nextAction: 'revise' };

    while (this.shouldContinue(session)) {
        latestDecision = await this.runSingleRound(session, retrievedMemories, retrievedCodeChunks);

      if (latestDecision.nextAction === 'accept' || latestDecision.nextAction === 'reject') {
        session.finalDecision = latestDecision;
        return latestDecision;
      }
    }

    session.finalDecision = latestDecision;
    return latestDecision;
  }

    async runSingleRound(
    session: DebugSession,
    retrievedMemories: RetrievalRecord[] = [],
    retrievedCodeChunks: CodeChunkRecord[] = [],
  ): Promise<AgentDecision> {
    this.advanceRound(session);

    const previousCritique = this.findLatestCritique(session);
    const fallbackProposal = this.debuggerAgent.proposeFix(
      session.bugContext,
      previousCritique,
      session.currentRound,
      retrievedMemories,
      retrievedCodeChunks,
    );
    const llmDebuggerResult = await this.llmDebuggerAgent.proposeFix(
      session.id,
      session.bugContext,
      previousCritique,
      session.currentRound,
      retrievedMemories,
      retrievedCodeChunks,
      fallbackProposal,
    );
      const safetyResult = this.patchSafetyValidator.validate(
      session.bugContext,
      llmDebuggerResult.proposal,
    );
    const patchProposal = safetyResult.safe ? llmDebuggerResult.proposal : fallbackProposal;

    session.modelTranscripts.push(...llmDebuggerResult.transcripts);
    if (!safetyResult.safe) {
      this.addMessage(session, {
        role: 'critic',
        content: `Safety pre-check rejected model patch: ${safetyResult.issues.join(' | ')}`,
        timestamp: Date.now(),
      });
    }
    this.recordPatch(session, patchProposal);
    this.updatePatchWorkspace(session, patchProposal);
    if (session.patchWorkspace) {
      session.patchWorkspace.parsedPatch = safetyResult.safe
        ? safetyResult.parsedPatch
        : undefined;
    }

    this.addMessage(session, {
      role: 'debugger',
      content: this.formatDebuggerMessage(session.bugContext, patchProposal),
      timestamp: Date.now(),
    });

    const critique = this.criticAgent.reviewProposal(session.bugContext, patchProposal);
    this.addMessage(session, {
      role: 'critic',
      content: this.formatCritiqueMessage(critique),
      timestamp: Date.now(),
    });

    const criticDecision = this.buildCriticDecision(critique);

    if (criticDecision.nextAction === 'revise') {
      this.addMessage(session, {
        role: 'debugger',
        content: this.formatRevisionResponse(critique, session.currentRound, session.maxRounds),
        timestamp: Date.now(),
      });

      session.finalDecision = {
        patchProposal,
        critique,
        nextAction: session.currentRound >= session.maxRounds ? 'reject' : 'revise',
      };
      session.updatedAt = Date.now();
      return session.finalDecision;
    }

    const testResult = await this.testerAgent.evaluatePatch(
      session.bugContext.failingCommand,
      session.bugContext.repositoryPath,
      session.patchWorkspace,
    );

    if (session.patchWorkspace) {
      session.patchWorkspace.validated = testResult.passed;
    }

    this.recordTestResult(session, testResult);
    this.addMessage(session, {
      role: 'tester',
      content: this.formatTestMessage(testResult),
      timestamp: Date.now(),
    });

    const testerDecision = this.buildTesterDecision(testResult);

    const canAccept =
      testerDecision.nextAction === 'accept' &&
      session.patchWorkspace?.materialized === true &&
      session.patchWorkspace?.validated === true;

    const nextAction = canAccept
      ? 'accept'
      : session.currentRound >= session.maxRounds
        ? 'reject'
        : 'revise';

    session.finalDecision = {
      patchProposal,
      critique,
      testResult,
      nextAction,
    };
    session.updatedAt = Date.now();

    return session.finalDecision;
  }

  recordPatch(session: DebugSession, patch: PatchProposal): DebugSession {
    session.latestPatch = patch;
    session.updatedAt = Date.now();
    return session;
  }

  recordTestResult(session: DebugSession, testResult: TestResult): DebugSession {
    session.latestTestResult = testResult;
    session.updatedAt = Date.now();
    return session;
  }

  buildCriticDecision(critique: CritiqueResult): AgentDecision {
    if (critique.approved) {
      return {
        critique,
        nextAction: 'test',
      };
    }

    return {
      critique,
      nextAction: 'revise',
    };
  }

  buildTesterDecision(testResult: TestResult): AgentDecision {
    if (testResult.passed) {
      return {
        testResult,
        nextAction: 'accept',
      };
    }

    return {
      testResult,
      nextAction: 'revise',
    };
  }

  shouldContinue(session: DebugSession): boolean {
    if (session.currentRound >= session.maxRounds) {
      return false;
    }

    if (!session.finalDecision) {
      return true;
    }

    return session.finalDecision.nextAction === 'revise';
  }

  advanceRound(session: DebugSession): DebugSession {
    session.currentRound += 1;
    session.updatedAt = Date.now();
    return session;
  }

  private updatePatchWorkspace(session: DebugSession, patch: PatchProposal): void {
    if (!session.patchWorkspace) {
      session.patchWorkspace = {
        targetFilePath: session.bugContext.filePath,
        originalContent: session.bugContext.relevantCode,
        rollbackContent: session.bugContext.relevantCode,
        rollbackAvailable: false,
        candidateContent: undefined,
        candidateDiff: undefined,
        tempFilePath: undefined,
        materialized: false,
        validated: false,
      };
    }

    session.patchWorkspace.targetFilePath = session.bugContext.filePath;
    session.patchWorkspace.originalContent = session.bugContext.relevantCode;
    session.patchWorkspace.rollbackContent = session.bugContext.relevantCode;
    session.patchWorkspace.rollbackAvailable = false;
    session.patchWorkspace.candidateDiff = patch.diffText;
    session.patchWorkspace.parsedPatch = undefined;
    session.patchWorkspace.candidateContent = patch.candidateContent;
    session.patchWorkspace.tempFilePath = undefined;
    session.patchWorkspace.materialized = false;
    session.patchWorkspace.validated = false;
    session.updatedAt = Date.now();
  }

  private addMessage(session: DebugSession, message: AgentMessage): void {
    session.messages.push(message);
    session.updatedAt = Date.now();
  }

  private findLatestCritique(session: DebugSession): CritiqueResult | undefined {
    const finalDecision = session.finalDecision;

    if (!finalDecision?.critique) {
      return undefined;
    }

    return finalDecision.critique;
  }

  private formatDebuggerMessage(bugContext: BugContext, proposal: PatchProposal): string {
    return [
      `I propose a patch for: ${bugContext.filePath ?? 'unknown-file'}`,
      `Summary: ${proposal.summary}`,
      `Rationale: ${proposal.rationale}`,
      `Confidence: ${proposal.confidence}`,
      'Argument: This patch addresses the stated bug using the currently available failing context.',
    ].join('\n');
  }

  private formatCritiqueMessage(critique: CritiqueResult): string {
    const issues = critique.issues.length > 0 ? critique.issues.join(' | ') : 'No blocking issues found.';
    const suggestions =
      critique.improvementSuggestions.length > 0
        ? critique.improvementSuggestions.join(' | ')
        : 'No additional suggestions.';

    return [
      `Approval Status: ${critique.approved}`,
      `Critic Argument: ${issues}`,
      `Requested Revisions: ${suggestions}`,
    ].join('\n');
  }

  private formatRevisionResponse(
    critique: CritiqueResult,
    currentRound: number,
    maxRounds: number,
  ): string {
    const suggestions =
      critique.improvementSuggestions.length > 0
        ? critique.improvementSuggestions.join(' | ')
        : 'No suggestions provided.';

    return [
      'Revision Response: I acknowledge the critique and will revise the patch in the next round.',
      `Round Status: ${currentRound}/${maxRounds}`,
      `Focus Areas: ${suggestions}`,
    ].join('\n');
  }

  private formatTestMessage(testResult: TestResult): string {
    return [
      `Passed: ${testResult.passed}`,
      `Command: ${testResult.command}`,
      `Exit Code: ${testResult.exitCode ?? 'null'}`,
      `Stdout: ${testResult.stdout || '(empty)'}`,
      `Stderr: ${testResult.stderr || '(empty)'}`,
      'Tester Verdict: Execution feedback has been recorded for the next decision.',
    ].join('\n');
  }
}
