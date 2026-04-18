import * as assert from 'node:assert/strict';
import { isBetaEnabled } from './flags';

assert.equal(isBetaEnabled({}), false);
assert.equal(isBetaEnabled({ enableBeta: true }), true);

console.log('Demo flags tests passed.');
