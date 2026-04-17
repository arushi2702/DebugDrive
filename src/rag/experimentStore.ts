import * as fs from 'fs';
import * as path from 'path';
import { AgentDecision, BugContext, RetrievalRecord } from '../types/agent';
import { DebugSession } from '../types/session';

export interface ExperimentSummary {
  id: string;
  sessionId: string;
  repositoryPath: string;
  repositoryName: string;
  bugContext: BugContext;
  finalDecision: AgentDecision;
  retrievedMemoryIds: string[];
  retrievedMemorySummaries: string[];
  reward: number;
  success: boolean;
  createdAt: number;
}

export class ExperimentStore {
  constructor(private readonly storageDir: string) {}

  saveSummary(
    session: DebugSession,
    decision: AgentDecision,
    retrievedMemories: RetrievalRecord[],
    reward: number,
    repositoryName: string,
  ): string {
    const experimentsDir = path.join(this.storageDir, 'experiments');
    fs.mkdirSync(experimentsDir, { recursive: true });

    const summary: ExperimentSummary = {
      id: `experiment-${session.id}`,
      sessionId: session.id,
      repositoryPath: session.bugContext.repositoryPath,
      repositoryName,
      bugContext: session.bugContext,
      finalDecision: decision,
      retrievedMemoryIds: retrievedMemories.map((record) => record.id),
      retrievedMemorySummaries: retrievedMemories.map((record) => record.summary),
      reward,
      success: decision.nextAction === 'accept',
      createdAt: Date.now(),
    };

    const summaryPath = path.join(experimentsDir, `${summary.id}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

    return summaryPath;
  }
}
