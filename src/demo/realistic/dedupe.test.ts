import * as assert from 'assert';
import { uniqueIds } from './dedupe';

assert.deepStrictEqual(uniqueIds(['a', 'b', 'a', 'c', 'b']), ['a', 'b', 'c']);

console.log('Dedupe tests passed.');
