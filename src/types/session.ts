import { AgentDecision, AgentMessage, BugContext, PatchProposal, TestResult } from './agent';

export interface PatchWorkspaceState {
  targetFilePath?: string;
  originalContent?: string;
  candidateContent?: string;
  candidateDiff?: string;
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
  latestTestResult?: TestResult;
  finalDecision?: AgentDecision;
  patchWorkspace?: PatchWorkspaceState;
  createdAt: number;
  updatedAt: number;
}
