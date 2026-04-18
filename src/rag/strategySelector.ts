import { BugContext, DebugStrategy, LearningRecord, StrategySelection } from '../types/agent';

export class StrategySelector {
  private readonly strategies: DebugStrategy[] = [
    'baseline',
    'rag-heavy',
    'minimal-patch',
    'test-focused',
    'symbol-aware',
  ];

  select(bugContext: BugContext, learningRecords: LearningRecord[]): StrategySelection {
    const explorationRate = 0.15;
    const shouldExplore = Math.random() < explorationRate;

    if (shouldExplore || learningRecords.length === 0) {
      const strategy = this.pickExplorationStrategy(bugContext);

      return {
        strategy,
        reason: learningRecords.length === 0
          ? 'No prior learning records were available, so Debug Drive selected an initial exploratory strategy.'
          : 'Exploration selected a non-greedy strategy to continue collecting reward feedback.',
        exploration: true,
      };
    }

    const rankedStrategies = this.rankStrategiesByReward(learningRecords);
    const bestStrategy = rankedStrategies[0]?.strategy ?? this.pickExplorationStrategy(bugContext);

    return {
      strategy: bestStrategy,
      reason: `Selected ${bestStrategy} because it has the highest historical average reward.`,
      exploration: false,
    };
  }

  private pickExplorationStrategy(bugContext: BugContext): DebugStrategy {
    const problem = bugContext.problemStatement.toLowerCase();

    if (bugContext.relevantCode && bugContext.relevantCode.trim().length > 0) {
      return 'symbol-aware';
    }

    if (problem.includes('test') || bugContext.errorOutput) {
      return 'test-focused';
    }

    return this.strategies[Math.floor(Math.random() * this.strategies.length)];
  }

  private rankStrategiesByReward(
    learningRecords: LearningRecord[],
  ): Array<{ strategy: DebugStrategy; averageReward: number }> {
    return this.strategies
      .map((strategy) => {
        const records = learningRecords.filter((record) => record.strategy === strategy);
        const averageReward =
          records.length === 0
            ? Number.NEGATIVE_INFINITY
            : records.reduce((sum, record) => sum + record.reward, 0) / records.length;

        return {
          strategy,
          averageReward,
        };
      })
      .sort((left, right) => right.averageReward - left.averageReward);
  }
}
