import * as assert from 'assert';
import { StrategySelector } from '../rag/strategySelector';
import { BugContext, LearningRecord } from '../types/agent';

const bugContext: BugContext = {
  repositoryPath: '.',
  filePath: 'src/demo/items.ts',
  language: 'typescript',
  problemStatement: 'empty array returns undefined',
  errorOutput: 'undefined !== []',
  relevantCode: 'return undefined as unknown as string[];',
};

const records: LearningRecord[] = [
  {
    id: 'l1',
    repositoryPath: '.',
    repositoryName: 'debug-drive',
    sessionId: 's1',
    problemStatement: 'empty array returns undefined',
    targetFilePath: 'src/demo/items.ts',
    language: 'typescript',
    finalAction: 'accept',
    testPassed: true,
    criticApproved: true,
    roundsUsed: 1,
    maxRounds: 3,
    reward: 1.8,
    rewardExplanation: [],
    strategy: 'test-guided-fix',
    strategyReason: 'test',
    strategyExploration: false,
    validationOutcome: 'passed',
    retrievedMemoryIds: [],
    createdAt: Date.now(),
  },
];

const selection = new StrategySelector().select(bugContext, records);

assert.ok(selection.strategy.length > 0);
assert.ok(selection.reason.length > 0);

console.log('StrategySelector tests passed.');
