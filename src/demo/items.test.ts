import * as assert from 'node:assert/strict';
import { getItems } from './items';

assert.deepEqual(getItems([]), []);
assert.deepEqual(getItems(['alpha', 'beta']), ['alpha', 'beta']);

console.log('Demo item tests passed.');
