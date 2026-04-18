import * as assert from 'assert';
import { canEdit } from './permissions';

assert.strictEqual(canEdit({ role: 'admin' }), true);
assert.strictEqual(canEdit({ role: 'editor' }), true);
assert.strictEqual(canEdit({ role: 'editor', suspended: true }), false);
assert.strictEqual(canEdit({ role: 'viewer' }), false);

console.log('Permission tests passed.');
