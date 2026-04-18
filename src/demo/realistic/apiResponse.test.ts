import * as assert from 'assert';
import { unwrapResponse } from './apiResponse';

assert.deepStrictEqual(unwrapResponse({ ok: true, data: { id: 1 } }), { id: 1 });
assert.throws(() => unwrapResponse({ ok: false, error: 'Not found' }), /Not found/);

console.log('API response tests passed.');
