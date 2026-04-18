import { BugContext, DebugStrategy, LearningRecord, StrategySelection } from '../types/agent';

interface RankedStrategy {
  strategy: DebugStrategy;
  score: number;
  supportingRuns: number;
}

export class StrategySelector {
  private readonly strategies: DebugStrategy[] = [
    'minimal-local-fix',
    'retrieval-augmented-fix',
    'test-guided-fix',
    'conservative-no-refactor',
    'symbol-aware',
    'broader-refactor',
  ];

  select(bugContext: BugContext, learningRecords: LearningRecord[]): StrategySelection {
    const explorationRate = 0.12;
    const shouldExplore = Math.random() < explorationRate;

    if (shouldExplore || learningRecords.length === 0) {
      const strategy = this.pickExplorationStrategy(bugContext);

      return {
        strategy,
        reason: learningRecords.length === 0
          ? 'No prior learning records were available, so Debug Drive selected an initial exploratory strategy.'
          : `Exploration selected ${strategy} to continue collecting reward feedback.`,
        exploration: true,
      };
    }

    const rankedStrategies = this.rankStrategiesBySimilarityWeightedReward(bugContext, learningRecords);
    const bestStrategy = rankedStrategies[0]?.strategy ?? this.pickExplorationStrategy(bugContext);
    const bestScore = rankedStrategies[0]?.score ?? 0;
    const supportingRuns = rankedStrategies[0]?.supportingRuns ?? 0;

    return {
      strategy: bestStrategy,
      reason: `Selected ${bestStrategy} using similarity-weighted reward from ${supportingRuns} prior runs (score ${bestScore.toFixed(3)}).`,
      exploration: false,
    };
  }

  private pickExplorationStrategy(bugContext: BugContext): DebugStrategy {
    const problem = bugContext.problemStatement.toLowerCase();

    if (problem.includes('test') || bugContext.errorOutput) {
      return 'test-guided-fix';
    }

    if (bugContext.relevantCode && bugContext.relevantCode.trim().length > 0) {
      return 'symbol-aware';
    }

    return this.strategies[Math.floor(Math.random() * this.strategies.length)];
  }

  private rankStrategiesBySimilarityWeightedReward(
    bugContext: BugContext,
    learningRecords: LearningRecord[],
  ): RankedStrategy[] {
    return this.strategies
      .map((strategy) => {
        const records = learningRecords.filter((record) => record.strategy === strategy);
        const weighted = records.map((record) => {
          const similarity = this.similarityToRecord(bugContext, record);
          return {
            reward: record.reward,
            weight: Math.max(similarity, 0.05),
          };
        });
        const weightTotal = weighted.reduce((sum, item) => sum + item.weight, 0);
        const score =
          weightTotal === 0
            ? Number.NEGATIVE_INFINITY
            : weighted.reduce((sum, item) => sum + item.reward * item.weight, 0) / weightTotal;

        return {
          strategy,
          score,
          supportingRuns: records.length,
        };
      })
      .sort((left, right) => right.score - left.score);
  }

  private similarityToRecord(bugContext: BugContext, record: LearningRecord): number {
    let score = 0;

    if (record.language && bugContext.language && record.language === bugContext.language) {
      score += 0.2;
    }

    if (record.targetFilePath && bugContext.filePath && record.targetFilePath === bugContext.filePath) {
      score += 0.25;
    }

    score += this.jaccardSimilarity(
      this.tokenize(bugContext.problemStatement),
      this.tokenize(record.problemStatement),
    ) * 0.45;

    if (bugContext.errorOutput && record.validationOutcome === 'passed') {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2),
    );
  }

  private jaccardSimilarity(left: Set<string>, right: Set<string>): number {
    if (left.size === 0 || right.size === 0) {
      return 0;
    }

    const intersection = [...left].filter((token) => right.has(token)).length;
    const union = new Set([...left, ...right]).size;

    return intersection / union;
  }
}
