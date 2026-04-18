import * as assert from 'assert';
import { MetricsCalculator } from '../evaluation/metrics';
import { BenchmarkRunResult } from '../types/agent';

const results: BenchmarkRunResult[] = [
  {
    id: 'r1',
    benchmarkCaseId: 'c1',
    mode: 'normal',
    difficulty: 'easy',
    category: 'edge-case',
    finalAction: 'accept',
    testPassed: true,
    criticApproved: true,
    roundsUsed: 1,
    maxRounds: 3,
    reward: 1.8,
    retrievedMemoryCount: 1,
    retrievedCodeChunkCount: 1,
    success: true,
    createdAt: Date.now(),
  },
  {
    id: 'r2',
    benchmarkCaseId: 'c2',
    mode: 'normal',
    difficulty: 'hard',
    category: 'api-misuse',
    finalAction: 'reject',
    testPassed: false,
    criticApproved: true,
    roundsUsed: 3,
    maxRounds: 3,
    reward: -0.3,
    retrievedMemoryCount: 0,
    retrievedCodeChunkCount: 0,
    success: false,
    createdAt: Date.now(),
  },
];

const metrics = new MetricsCalculator().calculate(results);

assert.strictEqual(metrics.totalRuns, 2);
assert.strictEqual(metrics.successfulRuns, 1);
assert.strictEqual(metrics.byDifficulty.length, 2);
assert.strictEqual(metrics.byCategory.length, 2);

console.log('Metrics tests passed.');
