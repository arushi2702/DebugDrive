import * as assert from 'node:assert/strict';
import { getTheme } from './defaults';

assert.equal(getTheme({}), 'light');
assert.equal(getTheme({ theme: 'dark' }), 'dark');

console.log('Demo defaults tests passed.');
