import * as fs from 'fs';
import * as path from 'path';
import { CodeChunkRecord } from '../types/agent';
import { CodeChunker } from './codeChunker';
import { EmbeddingProvider } from './embeddingProvider';

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
  ) {}

  async indexRepository(repositoryPath: string, repositoryName: string): Promise<CodeChunkRecord[]> {
    const files = this.discoverSourceFiles(repositoryPath);
    const records: CodeChunkRecord[] = [];

    for (const filePath of files) {
      const relativeFilePath = path.relative(repositoryPath, filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const chunks = this.chunker.chunk(content);

      for (const chunk of chunks) {
        const embeddingText = [
          `Repository: ${repositoryName}`,
          `File: ${relativeFilePath}`,
          content,
        ].join('\n');

        records.push({
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

    return records;
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
