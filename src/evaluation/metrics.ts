import { BenchmarkRunResult } from '../types/agent';

export interface GroupedEvaluationMetric {
  group: string;
  totalRuns: number;
  successfulRuns: number;
  successRate: number;
  validationPassRate: number;
  averageReward: number;
  averageRoundsUsed: number;
}

export interface EvaluationMetrics {
  totalRuns: number;
  successfulRuns: number;
  successRate: number;
  validationPassRate: number;
  averageReward: number;
  averageRoundsUsed: number;
  averageRetrievedMemoryCount: number;
  averageRetrievedCodeChunkCount: number;
  passAtK: number;
  fixAtK: number;
  retrievalUsedRuns: number;
  retrievalSuccessRate: number;
  noRetrievalSuccessRate: number;
  byDifficulty: GroupedEvaluationMetric[];
  byCategory: GroupedEvaluationMetric[];

}

export class MetricsCalculator {
  calculate(results: BenchmarkRunResult[]): EvaluationMetrics {
    if (results.length === 0) {
      return {
        totalRuns: 0,
        successfulRuns: 0,
        successRate: 0,
        validationPassRate: 0,
        averageReward: 0,
        averageRoundsUsed: 0,
        averageRetrievedMemoryCount: 0,
        averageRetrievedCodeChunkCount: 0,
        passAtK: 0,
        fixAtK: 0,
        retrievalUsedRuns: 0,
        retrievalSuccessRate: 0,
        noRetrievalSuccessRate: 0,
        byDifficulty: [],
        byCategory: [],

      };
    }

    const totalRuns = results.length;
    const successfulRuns = results.filter((result) => result.success).length;
    const validationPassedRuns = results.filter((result) => result.testPassed).length;
    const groupedByCase = this.groupByBenchmarkCase(results);
    const cases = Array.from(groupedByCase.values());
        const retrievalUsedResults = results.filter(
      (result) => result.retrievedMemoryCount > 0 || result.retrievedCodeChunkCount > 0,
    );
    const noRetrievalResults = results.filter(
      (result) => result.retrievedMemoryCount === 0 && result.retrievedCodeChunkCount === 0,
    );

    return {
      totalRuns,
      successfulRuns,
      successRate: successfulRuns / totalRuns,
      validationPassRate: validationPassedRuns / totalRuns,
      averageReward: this.average(results.map((result) => result.reward)),
      averageRoundsUsed: this.average(results.map((result) => result.roundsUsed)),
      averageRetrievedMemoryCount: this.average(results.map((result) => result.retrievedMemoryCount)),
      averageRetrievedCodeChunkCount: this.average(results.map((result) => result.retrievedCodeChunkCount)),
      passAtK: cases.filter((caseResults) => caseResults.some((result) => result.testPassed)).length / cases.length,
      fixAtK: cases.filter((caseResults) => caseResults.some((result) => result.success)).length / cases.length,
            retrievalUsedRuns: retrievalUsedResults.length,
      retrievalSuccessRate: this.successRateFor(retrievalUsedResults),
      noRetrievalSuccessRate: this.successRateFor(noRetrievalResults),
      byDifficulty: this.calculateGroupedMetrics(results, (result) => result.difficulty ?? 'uncategorized'),
      byCategory: this.calculateGroupedMetrics(results, (result) => result.category ?? 'uncategorized'),
    };
  }

    private successRateFor(results: BenchmarkRunResult[]): number {
    if (results.length === 0) {
      return 0;
    }

    return results.filter((result) => result.success).length / results.length;
  }

  private calculateGroupedMetrics(
    results: BenchmarkRunResult[],
    getGroup: (result: BenchmarkRunResult) => string,
  ): GroupedEvaluationMetric[] {
    const grouped = new Map<string, BenchmarkRunResult[]>();

    for (const result of results) {
      const group = getGroup(result);
      const existing = grouped.get(group) ?? [];
      existing.push(result);
      grouped.set(group, existing);
    }

    return Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([group, groupResults]) => {
        const totalRuns = groupResults.length;
        const successfulRuns = groupResults.filter((result) => result.success).length;
        const validationPassedRuns = groupResults.filter((result) => result.testPassed).length;

        return {
          group,
          totalRuns,
          successfulRuns,
          successRate: successfulRuns / totalRuns,
          validationPassRate: validationPassedRuns / totalRuns,
          averageReward: this.average(groupResults.map((result) => result.reward)),
          averageRoundsUsed: this.average(groupResults.map((result) => result.roundsUsed)),
        };
      });
  }

  private groupByBenchmarkCase(results: BenchmarkRunResult[]): Map<string, BenchmarkRunResult[]> {
    const grouped = new Map<string, BenchmarkRunResult[]>();

    for (const result of results) {
      const existing = grouped.get(result.benchmarkCaseId) ?? [];
      existing.push(result);
      grouped.set(result.benchmarkCaseId, existing);
    }

    return grouped;
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}
