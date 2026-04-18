import * as assert from 'node:assert/strict';
import { parseTags } from './parser';

assert.deepEqual(parseTags('alpha, beta, ,gamma'), ['alpha', 'beta', 'gamma']);
assert.deepEqual(parseTags(''), []);

console.log('Demo parser tests passed.');
