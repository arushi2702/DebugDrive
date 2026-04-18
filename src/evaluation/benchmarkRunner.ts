import * as fs from 'fs';
import * as path from 'path';
import { DebugCoordinator } from '../core/coordinator';
import { ModelProvider } from '../llm/modelProvider';
import { MockModelProvider } from '../llm/mockModelProvider';
import { LearningStore } from '../rag/learningStore';
import { RewardCalculator } from '../rag/reward';
import { RetrievalStore } from '../rag/retriever';
import { StrategySelector } from '../rag/strategySelector';
import { SimpleVectorizer } from '../rag/vectorizer';
import { BenchmarkCase, BenchmarkRunResult, BugContext } from '../types/agent';

export interface BenchmarkRunnerOptions {
  repositoryPath: string;
  mode?: BenchmarkRunResult['mode'];
  topK?: number;
  similarityThreshold?: number;
  modelProvider?: ModelProvider;
  providerMode?: string;
  providerFallback?: string;
}

export class BenchmarkRunner {
  constructor(
    private readonly rewardCalculator = new RewardCalculator(),
    private readonly vectorizer = new SimpleVectorizer(),
    private readonly strategySelector = new StrategySelector(),
  ) {}

  async runCase(benchmarkCase: BenchmarkCase, options: BenchmarkRunnerOptions): Promise<BenchmarkRunResult> {
    const mode = options.mode ?? 'normal';
    const modelProvider = options.modelProvider ?? new MockModelProvider();
    const topK = options.topK ?? 3;
    const similarityThreshold = options.similarityThreshold ?? 0.75;
    const repositoryName = path.basename(options.repositoryPath);
    const memoryPath = path.join(options.repositoryPath, '.debug-drive-memory');
    const retrievalStore = new RetrievalStore(memoryPath);
    const learningStore = new LearningStore(memoryPath);
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
      failingCommand: this.resolveValidationCommand(benchmarkCase),
      errorOutput: benchmarkCase.errorOutput,
      relevantCode,
    };
    const strategySelection = this.strategySelector.select(bugContext, learningStore.loadRecords());
    bugContext.strategyHint = `${strategySelection.strategy}: ${strategySelection.reason}`;

    const coordinator = new DebugCoordinator(undefined, modelProvider);
    const session = coordinator.createSession(bugContext);
    session.strategySelection = strategySelection;
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
      providerName: options.providerMode ?? modelProvider.providerName,
      modelName: modelProvider.modelName,
      providerFallback: options.providerFallback,
      difficulty: benchmarkCase.difficulty ?? 'medium',
      category: benchmarkCase.category ?? this.inferCategory(benchmarkCase),
      strategy: session.strategySelection?.strategy,
      strategyExploration: session.strategySelection?.exploration,
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

  private inferCategory(benchmarkCase: BenchmarkCase): BenchmarkCase['category'] {
    const text = [
      benchmarkCase.problemStatement,
      benchmarkCase.name,
      benchmarkCase.targetFilePath,
      benchmarkCase.tags.join(' '),
    ].join(' ').toLowerCase();

    if (text.includes('parse') || text.includes('tag')) {
      return 'parsing';
    }

    if (text.includes('default') || text.includes('empty string') || text.includes('missing')) {
      return 'defaults';
    }

    if (text.includes('empty') || text.includes('edge')) {
      return 'edge-case';
    }

    if (text.includes('page') || text.includes('offset')) {
      return 'validation';
    }

    return 'other';
  }

  private resolveValidationCommand(benchmarkCase: BenchmarkCase): string {
    if (benchmarkCase.failingCommand !== 'npm run demo:test') {
      return benchmarkCase.failingCommand;
    }

    const demoTestCommands: Record<string, string> = {
      [path.join('src', 'demo', 'items.ts')]: 'npm run compile && node ./out/demo/items.test.js',
      [path.join('src', 'demo', 'defaults.ts')]: 'npm run compile && node ./out/demo/defaults.test.js',
      [path.join('src', 'demo', 'parser.ts')]: 'npm run compile && node ./out/demo/parser.test.js',
      [path.join('src', 'demo', 'pagination.ts')]: 'npm run compile && node ./out/demo/pagination.test.js',
      [path.join('src', 'demo', 'flags.ts')]: 'npm run compile && node ./out/demo/flags.test.js',
    };

    return demoTestCommands[benchmarkCase.targetFilePath] ?? benchmarkCase.failingCommand;
  }
}
