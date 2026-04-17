export type AgentRole = 'debugger' | 'critic' | 'tester';

export interface BugContext {
  repositoryPath: string;
  filePath?: string;
  language?: string;
  problemStatement: string;
  failingCommand?: string;
  failingTest?: string;
  errorOutput?: string;
  relevantCode?: string;
}

export interface PatchProposal {
  summary: string;
  diffText: string;
  candidateContent: string;
  rationale: string;
  confidence: number;
}

export interface AgentMessage {
  role: AgentRole;
  content: string;
  timestamp: number;
}

export interface CritiqueResult {
  approved: boolean;
  issues: string[];
  improvementSuggestions: string[];
}

export interface TestResult {
  passed: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface AgentDecision {
  patchProposal?: PatchProposal;
  critique?: CritiqueResult;
  testResult?: TestResult;
  nextAction: 'revise' | 'test' | 'accept' | 'reject';
}

export interface RetrievalRecord {
  id: string;
  repositoryPath: string;
  repositoryName: string;
  summary: string;
  problemStatement: string;
  errorOutput?: string;
  targetFilePath?: string;
  diffText: string;
  candidateContent: string;
  rationale: string;
  tags: string[];
  createdAt: number;
}

export interface EmbeddingRecord {
  id: string;
  sourceRecordId: string;
  text: string;
  embedding: number[];
  metadata: {
    summary: string;
    repositoryPath: string;
    repositoryName: string;
    problemStatement: string;
    errorOutput?: string;
    targetFilePath?: string;
    language?: string;
    tags: string[];
    createdAt: number;
  };
}

export interface LearningRecord {
  id: string;
  repositoryPath: string;
  repositoryName: string;
  sessionId: string;
  problemStatement: string;
  targetFilePath?: string;
  language?: string;
  finalAction: 'revise' | 'test' | 'accept' | 'reject';
  testPassed: boolean;
  criticApproved: boolean;
  roundsUsed: number;
  maxRounds: number;
  reward: number;
  rewardExplanation: string[];
  retrievedMemoryIds: string[];
  createdAt: number;
}
