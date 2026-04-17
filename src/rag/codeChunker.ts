export interface SourceCodeChunk {
  chunkIndex: number;
  content: string;
  startLine: number;
  endLine: number;
}

export class CodeChunker {
  constructor(private readonly maxLinesPerChunk = 80) {}

  chunk(content: string): SourceCodeChunk[] {
    const lines = content.split(/\r?\n/);
    const chunks: SourceCodeChunk[] = [];

    for (let index = 0; index < lines.length; index += this.maxLinesPerChunk) {
      const chunkLines = lines.slice(index, index + this.maxLinesPerChunk);

      chunks.push({
        chunkIndex: chunks.length,
        content: chunkLines.join('\n'),
        startLine: index + 1,
        endLine: index + chunkLines.length,
      });
    }

    return chunks;
  }
}
