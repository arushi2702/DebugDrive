import * as assert from 'assert';
import { shouldRetry } from './retry';

assert.strictEqual(shouldRetry(500), true);
assert.strictEqual(shouldRetry(429), true);
assert.strictEqual(shouldRetry(404), false);
assert.strictEqual(shouldRetry(200), false);

console.log('Retry tests passed.');
