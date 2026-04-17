import {
  ParsedFilePatch,
  ParsedPatch,
  ParsedPatchHunk,
  ParsedPatchLine,
} from '../types/agent';

export interface UnifiedDiffParseResult {
  ok: boolean;
  patch?: ParsedPatch;
  error?: string;
}

export class UnifiedDiffParser {
  parse(diffText: string): UnifiedDiffParseResult {
    const lines = diffText.split(/\r?\n/);
    const files: ParsedFilePatch[] = [];
    let currentFile: ParsedFilePatch | undefined;
    let currentHunk: ParsedPatchHunk | undefined;

    for (const line of lines) {
      if (line.startsWith('--- a/')) {
        currentFile = {
          oldFilePath: line.slice('--- a/'.length).trim(),
          newFilePath: '',
          hunks: [],
        };
        currentHunk = undefined;
        files.push(currentFile);
        continue;
      }

      if (line.startsWith('+++ b/')) {
        if (!currentFile) {
          return { ok: false, error: 'Found new file marker before old file marker.' };
        }

        currentFile.newFilePath = line.slice('+++ b/'.length).trim();
        continue;
      }

      if (line.startsWith('@@')) {
        if (!currentFile) {
          return { ok: false, error: 'Found hunk before file markers.' };
        }

        currentHunk = {
          header: line,
          lines: [],
        };
        currentFile.hunks.push(currentHunk);
        continue;
      }

      if (!currentHunk) {
        continue;
      }

      const parsedLine = this.parsePatchLine(line);

      if (parsedLine) {
        currentHunk.lines.push(parsedLine);
      }
    }

    const invalidFile = files.find((file) => !file.oldFilePath || !file.newFilePath);

    if (invalidFile) {
      return { ok: false, error: 'Parsed patch contains incomplete file markers.' };
    }

    if (files.length === 0) {
      return { ok: false, error: 'No file patches found in diff.' };
    }

    return {
      ok: true,
      patch: { files },
    };
  }

  private parsePatchLine(line: string): ParsedPatchLine | undefined {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return {
        type: 'add',
        content: line.slice(1),
      };
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      return {
        type: 'remove',
        content: line.slice(1),
      };
    }

    if (line.startsWith(' ')) {
      return {
        type: 'context',
        content: line.slice(1),
      };
    }

    return undefined;
  }
}
