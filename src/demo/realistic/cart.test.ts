import * as assert from 'assert';
import { calculateCartTotal } from './cart';

assert.strictEqual(
  calculateCartTotal([
    { quantity: 2, price: 10 },
    { quantity: 3, price: 4 },
  ]),
  32,
);

console.log('Cart total tests passed.');
