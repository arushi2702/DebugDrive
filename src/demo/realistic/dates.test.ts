import * as assert from 'assert';
import { isExpired } from './dates';

assert.strictEqual(isExpired(1000, 1000), true);
assert.strictEqual(isExpired(999, 1000), true);
assert.strictEqual(isExpired(1001, 1000), false);

console.log('Date expiry tests passed.');
