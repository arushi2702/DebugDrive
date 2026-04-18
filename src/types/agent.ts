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
  strategyHint?: string;
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
    embeddingProvider: string;
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
  strategy?: DebugStrategy;
  strategyReason?: string;
  strategyExploration?: boolean;
  bugCategory?: BenchmarkCase['category'];
  difficulty?: BenchmarkCase['difficulty'];
  patchStyle?: DebugStrategy;
  retrievalUsed?: boolean;
  validationOutcome?: 'passed' | 'failed' | 'not-run';
  retrievedMemoryIds: string[];
  createdAt: number;
}

export interface PatchRiskAssessment {
  level: 'low' | 'medium' | 'high';
  reasons: string[];
  changedFiles: number;
  changedLines: number;
}
export interface CodeChunkRecord {
  id: string;
  repositoryPath: string;
  repositoryName: string;
  filePath: string;
  language?: string;
  chunkIndex: number;
  content: string;
  startLine: number;
  endLine: number;
  imports?: string[];
  relatedTestPath?: string;
  embedding: number[];
  embeddingProvider: string;
  createdAt: number;
}

export interface CodeSymbolRecord {
  id: string;
  repositoryPath: string;
  repositoryName: string;
  filePath: string;
  symbolName: string;
  symbolKind: 'function' | 'class' | 'interface' | 'method' | 'unknown';
  startLine: number;
  endLine: number;
  signature: string;
  content: string;
  imports?: string[];
  relatedTestPath?: string;
  embedding: number[];
  createdAt: number;
}
export interface ModelTranscript {
  id: string;
  sessionId: string;
  agentRole: AgentRole;
  providerName: string;
  modelName: string;
  promptMessages: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[];
  responseContent: string;
  parsedSuccessfully: boolean;
  parseError?: string;
  createdAt: number;
}

export interface ParsedPatchLine {
  type: 'context' | 'add' | 'remove';
  content: string;
}

export interface ParsedPatchHunk {
  header: string;
  lines: ParsedPatchLine[];
}

export interface ParsedFilePatch {
  oldFilePath: string;
  newFilePath: string;
  hunks: ParsedPatchHunk[];
}

export interface ParsedPatch {
  files: ParsedFilePatch[];
}

export interface BenchmarkCase {
  id: string;
  name: string;
  repositoryName: string;
  targetFilePath: string;
  language?: string;
  problemStatement: string;
  failingCommand: string;
  errorOutput?: string;
  expectedFinalAction: 'accept' | 'reject';
  difficulty?: 'easy' | 'medium' | 'hard';
  category?:
    | 'edge-case'
    | 'parsing'
    | 'defaults'
    | 'state'
    | 'validation'
    | 'null-handling'
    | 'logic'
    | 'off-by-one'
    | 'api-misuse'
    | 'other';
  tags: string[];
}

export interface BenchmarkRunResult {
  id: string;
  benchmarkCaseId: string;
  mode: 'normal' | 'no-rag' | 'no-critic';
  providerName?: string;
  modelName?: string;
  providerFallback?: string;
  difficulty?: BenchmarkCase['difficulty'];
  category?: BenchmarkCase['category'];
  finalAction: 'revise' | 'test' | 'accept' | 'reject';
  testPassed: boolean;
  criticApproved: boolean;
  roundsUsed: number;
  maxRounds: number;
  reward: number;
  retrievedMemoryCount: number;
  retrievedCodeChunkCount: number;
  strategy?: DebugStrategy;
  strategyExploration?: boolean;
  success: boolean;
  createdAt: number;
}

export type DebugStrategy =
  | 'baseline'
  | 'rag-heavy'
  | 'minimal-patch'
  | 'test-focused'
  | 'symbol-aware'
  | 'minimal-local-fix'
  | 'retrieval-augmented-fix'
  | 'test-guided-fix'
  | 'conservative-no-refactor'
  | 'broader-refactor';

export interface StrategySelection {
  strategy: DebugStrategy;
  reason: string;
  exploration: boolean;
}

