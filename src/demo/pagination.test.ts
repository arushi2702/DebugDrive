import * as assert from 'node:assert/strict';
import { getPageStart } from './pagination';

assert.equal(getPageStart(1, 10), 0);
assert.equal(getPageStart(3, 25), 50);

console.log('Demo pagination tests passed.');
