import * as fs from 'fs';
import * as path from 'path';
import { BenchmarkCase, BenchmarkRunResult } from '../types/agent';
import { builtinBenchmarkCases } from './builtinBenchmarkCases';
import { EvaluationMetrics } from './metrics';

export interface BenchmarkEvaluationSummary {
  id: string;
  repositoryPath: string;
  repositoryName: string;
  mode: BenchmarkRunResult['mode'] | 'ablation';
  benchmarkCaseCount: number;
  results: BenchmarkRunResult[];
  metrics: EvaluationMetrics;
  createdAt: number;
}

export class BenchmarkStore {
  constructor(private readonly storageDir: string) {}

  private get benchmarkSummariesDir(): string {
    return path.join(this.storageDir, 'benchmark-summaries');
  }

  private get benchmarkCasesPath(): string {
    return path.join(this.storageDir, 'benchmark-cases.json');
  }

  private get benchmarkResultsPath(): string {
    return path.join(this.storageDir, 'benchmark-results.json');
  }

  saveEvaluationSummary(summary: BenchmarkEvaluationSummary): string {
    fs.mkdirSync(this.benchmarkSummariesDir, { recursive: true });

    const summaryPath = path.join(this.benchmarkSummariesDir, `${summary.id}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

    return summaryPath;
  }

  saveEvaluationReport(summary: BenchmarkEvaluationSummary): string {
    fs.mkdirSync(this.benchmarkSummariesDir, { recursive: true });

    const reportPath = path.join(this.benchmarkSummariesDir, `${summary.id}.md`);
    fs.writeFileSync(reportPath, this.formatEvaluationReport(summary), 'utf8');

    return reportPath;
  }

  loadCases(): BenchmarkCase[] {
    if (!fs.existsSync(this.benchmarkCasesPath)) {
      return builtinBenchmarkCases;
    }

    try {
      const raw = fs.readFileSync(this.benchmarkCasesPath, 'utf8');
      const parsed = JSON.parse(raw) as BenchmarkCase[];

      return this.mergeBuiltinCases(
        Array.isArray(parsed) ? parsed.map((benchmarkCase) => this.withMetadata(benchmarkCase)) : [],
      );
    } catch {
      return builtinBenchmarkCases;
    }
  }

  saveCases(cases: BenchmarkCase[]): void {
    fs.mkdirSync(this.storageDir, { recursive: true });
    fs.writeFileSync(this.benchmarkCasesPath, JSON.stringify(cases, null, 2), 'utf8');
  }

  loadResults(): BenchmarkRunResult[] {
    if (!fs.existsSync(this.benchmarkResultsPath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(this.benchmarkResultsPath, 'utf8');
      const parsed = JSON.parse(raw) as BenchmarkRunResult[];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  appendResult(result: BenchmarkRunResult): void {
    const existing = this.loadResults();
    existing.push(result);

    fs.mkdirSync(this.storageDir, { recursive: true });
    fs.writeFileSync(this.benchmarkResultsPath, JSON.stringify(existing, null, 2), 'utf8');
  }

  private withMetadata(benchmarkCase: BenchmarkCase): BenchmarkCase {
    return {
      ...benchmarkCase,
      difficulty: benchmarkCase.difficulty ?? this.inferDifficulty(benchmarkCase),
      category: benchmarkCase.category ?? this.inferCategory(benchmarkCase),
    };
  }

  private mergeBuiltinCases(userCases: BenchmarkCase[]): BenchmarkCase[] {
    const merged = new Map<string, BenchmarkCase>();

    for (const benchmarkCase of builtinBenchmarkCases) {
      merged.set(benchmarkCase.id, benchmarkCase);
    }

    for (const benchmarkCase of userCases) {
      merged.set(benchmarkCase.id, benchmarkCase);
    }

    return Array.from(merged.values());
  }

  private inferDifficulty(benchmarkCase: BenchmarkCase): BenchmarkCase['difficulty'] {
    const text = `${benchmarkCase.problemStatement} ${benchmarkCase.targetFilePath}`.toLowerCase();

    if (text.includes('pagination') || text.includes('page')) {
      return 'hard';
    }

    if (text.includes('parse') || text.includes('flag')) {
      return 'medium';
    }

    return 'easy';
  }

  private inferCategory(benchmarkCase: BenchmarkCase): BenchmarkCase['category'] {
    const text = `${benchmarkCase.problemStatement} ${benchmarkCase.targetFilePath} ${benchmarkCase.tags.join(' ')}`.toLowerCase();

    if (text.includes('parse') || text.includes('tag')) {
      return 'parsing';
    }

    if (text.includes('null')) {
      return 'null-handling';
    }

    if (text.includes('api') || text.includes('retry') || text.includes('response')) {
      return 'api-misuse';
    }

    if (text.includes('off-by-one') || text.includes('boundary') || text.includes('expiry')) {
      return 'off-by-one';
    }

    if (text.includes('theme') || text.includes('default') || text.includes('missing')) {
      return 'defaults';
    }

    if (text.includes('page') || text.includes('pagination')) {
      return 'validation';
    }

    if (text.includes('flag') || text.includes('beta')) {
      return 'state';
    }

    if (text.includes('cart') || text.includes('total') || text.includes('stock') || text.includes('dedupe')) {
      return 'logic';
    }

    if (text.includes('empty') || text.includes('array')) {
      return 'edge-case';
    }

    return 'other';
  }

  private formatEvaluationReport(summary: BenchmarkEvaluationSummary): string {
    const metrics = summary.metrics;
    const percentage = (value: number) => `${(value * 100).toFixed(1)}%`;

    const resultRows = summary.results.map((result) =>
      [
        result.benchmarkCaseId,
        result.mode,
        result.difficulty ?? 'uncategorized',
        result.category ?? 'uncategorized',
        result.finalAction,
        result.success ? 'yes' : 'no',
        result.testPassed ? 'yes' : 'no',
        result.criticApproved ? 'yes' : 'no',
        result.roundsUsed.toString(),
        result.reward.toFixed(3),
        result.retrievedMemoryCount.toString(),
        result.retrievedCodeChunkCount.toString(),
      ].join(' | '),
    );
    const difficultyRows = metrics.byDifficulty.map((groupedMetric) =>
      [
        groupedMetric.group,
        groupedMetric.totalRuns.toString(),
        groupedMetric.successfulRuns.toString(),
        percentage(groupedMetric.successRate),
        percentage(groupedMetric.validationPassRate),
        groupedMetric.averageReward.toFixed(3),
        groupedMetric.averageRoundsUsed.toFixed(2),
      ].join(' | '),
    );
    const categoryRows = metrics.byCategory.map((groupedMetric) =>
      [
        groupedMetric.group,
        groupedMetric.totalRuns.toString(),
        groupedMetric.successfulRuns.toString(),
        percentage(groupedMetric.successRate),
        percentage(groupedMetric.validationPassRate),
        groupedMetric.averageReward.toFixed(3),
        groupedMetric.averageRoundsUsed.toFixed(2),
      ].join(' | '),
    );
    const failedRows = summary.results
      .filter((result) => !result.success || !result.testPassed)
      .map((result) =>
        [
          result.benchmarkCaseId,
          result.mode,
          result.difficulty ?? 'uncategorized',
          result.category ?? 'uncategorized',
          result.finalAction,
          result.testPassed ? 'yes' : 'no',
          result.roundsUsed.toString(),
          result.reward.toFixed(3),
        ].join(' | '),
      );

    return [
      `# Debug Drive Evaluation Report`,
      '',
      `- Summary ID: ${summary.id}`,
      `- Repository: ${summary.repositoryName}`,
      `- Repository Path: ${summary.repositoryPath}`,
      `- Mode: ${summary.mode}`,
      `- Benchmark Cases: ${summary.benchmarkCaseCount}`,
      `- Created At: ${new Date(summary.createdAt).toISOString()}`,
      '',
      '## Metrics',
      '',
      `- Total Runs: ${metrics.totalRuns}`,
      `- Successful Runs: ${metrics.successfulRuns}`,
      `- Success Rate: ${percentage(metrics.successRate)}`,
      `- Validation Pass Rate: ${percentage(metrics.validationPassRate)}`,
      `- pass@k: ${percentage(metrics.passAtK)}`,
      `- fix@k: ${percentage(metrics.fixAtK)}`,
      `- Average Reward: ${metrics.averageReward.toFixed(3)}`,
      `- Average Rounds Used: ${metrics.averageRoundsUsed.toFixed(2)}`,
      `- Average Retrieved Memories: ${metrics.averageRetrievedMemoryCount.toFixed(2)}`,
      `- Average Retrieved Code Chunks: ${metrics.averageRetrievedCodeChunkCount.toFixed(2)}`,
      `- Retrieval Used Runs: ${metrics.retrievalUsedRuns}`,
      `- Retrieval Success Rate: ${percentage(metrics.retrievalSuccessRate)}`,
      `- No-Retrieval Success Rate: ${percentage(metrics.noRetrievalSuccessRate)}`,
      '',
      '## Difficulty Breakdown',
      '',
      'Difficulty | Runs | Successful | Success Rate | Validation Pass Rate | Avg Reward | Avg Rounds',
      '--- | --- | --- | --- | --- | --- | ---',
      ...(difficultyRows.length > 0 ? difficultyRows : ['No difficulty metadata recorded.']),
      '',
      '## Category Breakdown',
      '',
      'Category | Runs | Successful | Success Rate | Validation Pass Rate | Avg Reward | Avg Rounds',
      '--- | --- | --- | --- | --- | --- | ---',
      ...(categoryRows.length > 0 ? categoryRows : ['No category metadata recorded.']),
      '',
      '## Failure Analysis',
      '',
      failedRows.length > 0
        ? 'Benchmark Case | Mode | Difficulty | Category | Final Action | Test Passed | Rounds | Reward'
        : 'No failures were recorded in this run.',
      ...(failedRows.length > 0
        ? ['--- | --- | --- | --- | --- | --- | --- | ---', ...failedRows]
        : []),
      '',
      '## Run Results',
      '',
      'Benchmark Case | Mode | Difficulty | Category | Final Action | Success | Test Passed | Critic Approved | Rounds | Reward | Memories | Code Chunks',
      '--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---',
      ...resultRows,
      '',
    ].join('\n');
  }
}
