import { CodeSymbolRecord } from '../types/agent';
import { EmbeddingProvider } from './embeddingProvider';

export interface SymbolExtractorOptions {
  repositoryPath: string;
  repositoryName: string;
  filePath: string;
  content: string;
}

interface RawSymbol {
  symbolName: string;
  symbolKind: CodeSymbolRecord['symbolKind'];
  startLine: number;
  endLine: number;
  signature: string;
  content: string;
}

export class SymbolExtractor {
  constructor(private readonly embeddingProvider: EmbeddingProvider) {}

  async extract(options: SymbolExtractorOptions): Promise<CodeSymbolRecord[]> {
    const rawSymbols = this.extractRawSymbols(options.content);

    const records: CodeSymbolRecord[] = [];

    for (const symbol of rawSymbols) {
      const embeddingText = [
        symbol.symbolName,
        symbol.symbolKind,
        symbol.signature,
        symbol.content,
      ].join('\n');

      records.push({
        id: `symbol-${options.repositoryName}-${options.filePath}-${symbol.symbolName}-${symbol.startLine}`,
        repositoryPath: options.repositoryPath,
        repositoryName: options.repositoryName,
        filePath: options.filePath,
        symbolName: symbol.symbolName,
        symbolKind: symbol.symbolKind,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
        signature: symbol.signature,
        content: symbol.content,
        embedding: await this.embeddingProvider.embedText(embeddingText),
        createdAt: Date.now(),
      });
    }

    return records;
  }

  private extractRawSymbols(content: string): RawSymbol[] {
    const lines = content.split(/\r?\n/);
    const symbols: RawSymbol[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      const functionMatch =
        line.match(/^\s*export\s+function\s+([A-Za-z0-9_]+)\s*\((.*)$/) ||
        line.match(/^\s*function\s+([A-Za-z0-9_]+)\s*\((.*)$/);

      const classMatch = line.match(/^\s*export\s+class\s+([A-Za-z0-9_]+)/) ||
        line.match(/^\s*class\s+([A-Za-z0-9_]+)/);

      const interfaceMatch = line.match(/^\s*export\s+interface\s+([A-Za-z0-9_]+)/) ||
        line.match(/^\s*interface\s+([A-Za-z0-9_]+)/);

      const methodMatch = line.match(/^\s*(async\s+)?([A-Za-z0-9_]+)\s*\((.*)$/);

      if (functionMatch) {
        symbols.push(this.buildSymbol(lines, index, functionMatch[1], 'function'));
        continue;
      }

      if (classMatch) {
        symbols.push(this.buildSymbol(lines, index, classMatch[1], 'class'));
        continue;
      }

      if (interfaceMatch) {
        symbols.push(this.buildSymbol(lines, index, interfaceMatch[1], 'interface'));
        continue;
      }

      if (methodMatch && !line.trim().startsWith('if ') && !line.trim().startsWith('for ')) {
        symbols.push(this.buildSymbol(lines, index, methodMatch[2], 'method'));
      }
    }

    return symbols;
  }

  private buildSymbol(
    lines: string[],
    startIndex: number,
    symbolName: string,
    symbolKind: CodeSymbolRecord['symbolKind'],
  ): RawSymbol {
    const endIndex = this.findBlockEnd(lines, startIndex);
    const content = lines.slice(startIndex, endIndex + 1).join('\n');

    return {
      symbolName,
      symbolKind,
      startLine: startIndex + 1,
      endLine: endIndex + 1,
      signature: lines[startIndex].trim(),
      content,
    };
  }

  private findBlockEnd(lines: string[], startIndex: number): number {
    let braceDepth = 0;
    let sawOpeningBrace = false;

    for (let index = startIndex; index < lines.length; index += 1) {
      const line = lines[index];

      for (const char of line) {
        if (char === '{') {
          braceDepth += 1;
          sawOpeningBrace = true;
        }

        if (char === '}') {
          braceDepth -= 1;
        }
      }

      if (sawOpeningBrace && braceDepth <= 0) {
        return index;
      }

      if (!sawOpeningBrace && index > startIndex && lines[index].trim() === '') {
        return index - 1;
      }
    }

    return lines.length - 1;
  }
}
