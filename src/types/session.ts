import { AgentDecision, AgentMessage, BugContext, ModelTranscript, ParsedPatch, PatchProposal, StrategySelection, TestResult } from './agent';

export interface PatchWorkspaceState {
  targetFilePath?: string;
  originalContent?: string;
  rollbackContent?: string;
  rollbackAvailable: boolean;
  candidateContent?: string;
  candidateDiff?: string;
  parsedPatch?: ParsedPatch;
  acceptedPatchPath?: string;
  tempFilePath?: string;
  tempPatchedFilePath?: string;
  sandboxRootPath?: string;
  sandboxProjectRootPath?: string;
  materialized: boolean;
  validated: boolean;
}

export interface DebugSession {
  id: string;
  bugContext: BugContext;
  messages: AgentMessage[];
  currentRound: number;
  maxRounds: number;
  latestPatch?: PatchProposal;
  modelTranscripts: ModelTranscript[];
  strategySelection?: StrategySelection;
  latestTestResult?: TestResult;
  finalDecision?: AgentDecision;
  patchWorkspace?: PatchWorkspaceState;
  createdAt: number;
  updatedAt: number;
}
