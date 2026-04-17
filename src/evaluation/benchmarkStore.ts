import * as fs from 'fs';
import * as path from 'path';
import { BenchmarkCase, BenchmarkRunResult } from '../types/agent';
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
      return [];
    }

    try {
      const raw = fs.readFileSync(this.benchmarkCasesPath, 'utf8');
      const parsed = JSON.parse(raw) as BenchmarkCase[];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
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

  private formatEvaluationReport(summary: BenchmarkEvaluationSummary): string {
    const metrics = summary.metrics;
    const percentage = (value: number) => `${(value * 100).toFixed(1)}%`;

    const resultRows = summary.results.map((result) =>
      [
        result.benchmarkCaseId,
        result.mode,
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
      '## Run Results',
      '',
      'Benchmark Case | Mode | Final Action | Success | Test Passed | Critic Approved | Rounds | Reward | Memories | Code Chunks',
      '--- | --- | --- | --- | --- | --- | --- | --- | --- | ---',
      ...resultRows,
      '',
    ].join('\n');
  }
}
