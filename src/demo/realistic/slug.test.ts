import * as assert from 'assert';
import { slugify } from './slug';

assert.strictEqual(slugify(' Hello, Debug Drive! '), 'hello-debug-drive');

console.log('Slug tests passed.');
