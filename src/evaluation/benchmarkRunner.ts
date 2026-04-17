import * as fs from 'fs';
import * as path from 'path';
import { DebugCoordinator } from '../core/coordinator';
import { RewardCalculator } from '../rag/reward';
import { RetrievalStore } from '../rag/retriever';
import { SimpleVectorizer } from '../rag/vectorizer';
import { BenchmarkCase, BenchmarkRunResult, BugContext } from '../types/agent';

export interface BenchmarkRunnerOptions {
  repositoryPath: string;
  mode?: BenchmarkRunResult['mode'];
  topK?: number;
  similarityThreshold?: number;
}

export class BenchmarkRunner {
  constructor(
    private readonly rewardCalculator = new RewardCalculator(),
    private readonly vectorizer = new SimpleVectorizer(),
  ) {}

  async runCase(benchmarkCase: BenchmarkCase, options: BenchmarkRunnerOptions): Promise<BenchmarkRunResult> {
    const mode = options.mode ?? 'normal';
    const topK = options.topK ?? 3;
    const similarityThreshold = options.similarityThreshold ?? 0.75;
    const repositoryName = path.basename(options.repositoryPath);
    const retrievalStore = new RetrievalStore(path.join(options.repositoryPath, '.debug-drive-memory'));
    const targetFileAbsolutePath = path.join(options.repositoryPath, benchmarkCase.targetFilePath);
    const relevantCode = fs.existsSync(targetFileAbsolutePath)
      ? fs.readFileSync(targetFileAbsolutePath, 'utf8')
      : undefined;

    const queryEmbeddingText = [
      benchmarkCase.problemStatement,
      benchmarkCase.errorOutput ?? '',
      relevantCode ?? '',
    ].join('\n');

    const queryEmbedding = await this.vectorizer.embedText(queryEmbeddingText);
    const rankedEmbeddingRecords =
      mode === 'no-rag'
        ? []
        : retrievalStore
            .searchEmbeddingRecords(queryEmbedding, topK)
            .filter((rankedRecord) => rankedRecord.similarity >= similarityThreshold);
    const rankedCodeChunkRecords =
      mode === 'no-rag'
        ? []
        : retrievalStore
            .searchCodeChunkRecords(queryEmbedding, topK)
            .filter((rankedRecord) => rankedRecord.similarity >= similarityThreshold);

    const rankedSourceIds = new Set(
      rankedEmbeddingRecords.map((rankedRecord) => rankedRecord.record.sourceRecordId),
    );
    const retrievalRecords = retrievalStore
      .loadRecords()
      .filter((record) => rankedSourceIds.has(record.id));

    const bugContext: BugContext = {
      repositoryPath: options.repositoryPath,
      filePath: benchmarkCase.targetFilePath,
      language: benchmarkCase.language,
      problemStatement: benchmarkCase.problemStatement,
      failingCommand: benchmarkCase.failingCommand,
      errorOutput: benchmarkCase.errorOutput,
      relevantCode,
    };

    const coordinator = new DebugCoordinator();
    const session = coordinator.createSession(bugContext);
    const decision = await coordinator.runSession(
      session,
      retrievalRecords,
      rankedCodeChunkRecords.map((rankedRecord) => rankedRecord.record),
    );
    const rewardResult = this.rewardCalculator.calculate(session, decision);

    return {
      id: `benchmark-result-${benchmarkCase.id}-${Date.now()}`,
      benchmarkCaseId: benchmarkCase.id,
      mode,
      finalAction: decision.nextAction,
      testPassed: decision.testResult?.passed ?? false,
      criticApproved: decision.critique?.approved ?? false,
      roundsUsed: session.currentRound,
      maxRounds: session.maxRounds,
      reward: rewardResult.reward,
      retrievedMemoryCount: retrievalRecords.length,
      retrievedCodeChunkCount: rankedCodeChunkRecords.length,
      success: decision.nextAction === benchmarkCase.expectedFinalAction,
      createdAt: Date.now(),
    };
  }
}
