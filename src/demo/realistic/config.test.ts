import * as assert from 'assert';
import { normalizeConfig } from './config';

assert.deepStrictEqual(normalizeConfig({}), {
  apiUrl: 'http://localhost:3000',
  timeoutMs: 5000,
});

console.log('Config tests passed.');
