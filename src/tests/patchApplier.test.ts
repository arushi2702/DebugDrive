import * as assert from 'assert';
import { PatchApplier } from '../sandbox/patchApplier';
import { ParsedFilePatch } from '../types/agent';

const patch: ParsedFilePatch = {
  oldFilePath: 'src/demo/items.ts',
  newFilePath: 'src/demo/items.ts',
  hunks: [
    {
      header: '@@',
      lines: [
        { type: 'context', content: 'export function getItems(items: string[]): string[] {' },
        { type: 'context', content: '  if (items.length === 0) {' },
        { type: 'remove', content: '    return undefined as unknown as string[];' },
        { type: 'add', content: '    return [];' },
        { type: 'context', content: '  }' },
      ],
    },
  ],
};

const original = [
  'export function getItems(items: string[]): string[] {',
  '  if (items.length === 0) {',
  '    return undefined as unknown as string[];',
  '  }',
  '',
  '  return items;',
  '}',
].join('\n');

const result = new PatchApplier().applyToContent(original, patch);

assert.strictEqual(result.ok, true);
assert.ok(result.updatedContent?.includes('return [];'));

console.log('PatchApplier tests passed.');
