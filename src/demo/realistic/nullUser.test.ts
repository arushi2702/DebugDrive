import * as assert from 'assert';
import { getUserEmail } from './nullUser';

assert.strictEqual(getUserEmail(null), 'unknown@example.com');
assert.strictEqual(getUserEmail({ id: 'u1', email: null }), 'unknown@example.com');
assert.strictEqual(getUserEmail({ id: 'u2', email: 'a@example.com' }), 'a@example.com');

console.log('Null user tests passed.');
