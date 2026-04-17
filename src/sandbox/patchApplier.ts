import { ParsedFilePatch } from '../types/agent';

export interface PatchApplyResult {
  ok: boolean;
  updatedContent?: string;
  error?: string;
}

export class PatchApplier {
  applyToContent(originalContent: string, filePatch: ParsedFilePatch): PatchApplyResult {
    const originalLines = originalContent.split(/\r?\n/);
    const updatedLines: string[] = [];
    let originalIndex = 0;

    for (const hunk of filePatch.hunks) {
      const hunkStartIndex = this.findHunkStart(originalLines, hunk.lines, originalIndex);

      if (hunkStartIndex === -1) {
        const expected = hunk.lines
          .filter((line) => line.type !== 'add')
          .map((line) => line.content)
          .join(' | ');

        return {
          ok: false,
          error: `Unable to locate hunk in original content. Expected sequence: ${expected}`,
        };
      }

      updatedLines.push(...originalLines.slice(originalIndex, hunkStartIndex));
      originalIndex = hunkStartIndex;

      for (const line of hunk.lines) {
        if (line.type === 'context') {
          if (originalLines[originalIndex] !== line.content) {
            return {
              ok: false,
              error: `Context mismatch while applying patch. Expected "${line.content}" but found "${originalLines[originalIndex] ?? '(end of file)'}".`,
            };
          }

          updatedLines.push(originalLines[originalIndex]);
          originalIndex += 1;
          continue;
        }

        if (line.type === 'remove') {
          if (originalLines[originalIndex] !== line.content) {
            return {
              ok: false,
              error: `Remove mismatch while applying patch. Expected "${line.content}" but found "${originalLines[originalIndex] ?? '(end of file)'}".`,
            };
          }

          originalIndex += 1;
          continue;
        }

        if (line.type === 'add') {
          updatedLines.push(line.content);
        }
      }
    }

    updatedLines.push(...originalLines.slice(originalIndex));

    return {
      ok: true,
      updatedContent: updatedLines.join('\n'),
    };
  }

  private findHunkStart(
    originalLines: string[],
    hunkLines: ParsedFilePatch['hunks'][number]['lines'],
    searchStartIndex: number,
  ): number {
    const matchLines = hunkLines
      .filter((line) => line.type !== 'add')
      .map((line) => line.content);

    if (matchLines.length === 0) {
      return searchStartIndex;
    }

    for (let index = searchStartIndex; index <= originalLines.length - matchLines.length; index += 1) {
      const matches = matchLines.every((line, offset) => originalLines[index + offset] === line);

      if (matches) {
        return index;
      }
    }

    return -1;
  }
}
