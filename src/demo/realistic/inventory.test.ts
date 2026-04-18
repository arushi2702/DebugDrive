import * as assert from 'assert';
import { hasStock } from './inventory';

assert.strictEqual(hasStock([{ sku: 'book', count: 0 }], 'book'), false);
assert.strictEqual(hasStock([{ sku: 'pen', count: 2 }], 'pen'), true);

console.log('Inventory tests passed.');
