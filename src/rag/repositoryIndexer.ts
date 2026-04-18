import * as fs from 'fs';
import * as path from 'path';
import { CodeChunkRecord, CodeSymbolRecord } from '../types/agent';
import { CodeChunker } from './codeChunker';
import { EmbeddingProvider } from './embeddingProvider';
import { SymbolExtractor } from './symbolExtractor';

export interface RepositoryIndexResult {
  chunks: CodeChunkRecord[];
  symbols: CodeSymbolRecord[];
}

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.cpp',
  '.c',
  '.h',
  '.cs',
]);

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'out',
  'dist',
  '.git',
  '.debug-drive',
  '.debug-drive-memory',
  '.debug-drive-sandboxes',
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'package.json',
  'tsconfig.json',
]);

export class RepositoryIndexer {
  constructor(
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly chunker = new CodeChunker(),
    private readonly symbolExtractor = new SymbolExtractor(embeddingProvider),
  ) {}

  async indexRepository(repositoryPath: string, repositoryName: string): Promise<RepositoryIndexResult> {
    const files = this.discoverSourceFiles(repositoryPath);
    const chunks: CodeChunkRecord[] = [];
    const symbols: CodeSymbolRecord[] = [];

    for (const filePath of files) {
      const relativeFilePath = path.relative(repositoryPath, filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const fileChunks = this.chunker.chunk(content);

      symbols.push(
        ...(await this.symbolExtractor.extract({
          repositoryPath,
          repositoryName,
          filePath: relativeFilePath,
          content,
        })),
      );

      for (const chunk of fileChunks) {
        const embeddingText = [
          `Repository: ${repositoryName}`,
          `File: ${relativeFilePath}`,
          chunk.content,
        ].join('\n');

        chunks.push({
          id: `${repositoryName}:${relativeFilePath}:chunk-${chunk.chunkIndex}`,
          repositoryPath,
          repositoryName,
          filePath: relativeFilePath,
          language: path.extname(filePath).replace('.', '') || undefined,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          embedding: await this.embeddingProvider.embedText(embeddingText),
          embeddingProvider: this.embeddingProvider.name,
          createdAt: Date.now(),
        });
      }
    }

    return {
      chunks,
      symbols,
    };
  }

  private discoverSourceFiles(repositoryPath: string): string[] {
    const discoveredFiles: string[] = [];

    const visit = (currentPath: string): void => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (!IGNORED_DIRECTORIES.has(entry.name)) {
            visit(entryPath);
          }

          continue;
        }

        if (
          entry.isFile() &&
          !IGNORED_FILES.has(entry.name) &&
          SUPPORTED_EXTENSIONS.has(path.extname(entry.name))
        ) {
          discoveredFiles.push(entryPath);
        }
      }
    };

    visit(repositoryPath);

    return discoveredFiles;
  }
}
