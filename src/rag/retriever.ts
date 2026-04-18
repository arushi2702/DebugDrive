import * as fs from 'fs';
import * as path from 'path';
import { CodeChunkRecord, CodeSymbolRecord, EmbeddingRecord, RetrievalRecord } from '../types/agent';

export interface RankedEmbeddingRecord {
  record: EmbeddingRecord;
  similarity: number;
}
export interface RankedCodeChunkRecord {
  record: CodeChunkRecord;
  similarity: number;
}

export interface RankedCodeSymbolRecord {
  record: CodeSymbolRecord;
  similarity: number;
}

export class RetrievalStore {
  constructor(private readonly storageDir: string) {}

    searchEmbeddingRecords(queryEmbedding: number[], topK = 3): RankedEmbeddingRecord[] {
    return this.loadEmbeddingRecords()
      .map((record) => ({
        record,
        similarity: this.cosineSimilarity(queryEmbedding, record.embedding),
      }))
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, topK);
  }

  private get codeSymbolRecordsPath(): string {
    return path.join(this.storageDir, 'code-symbol-records.json');
  }

    private get codeChunkFilePath(): string {
    return path.join(this.storageDir, 'code-chunk-records.json');
  }

    loadCodeChunkRecords(): CodeChunkRecord[] {
    if (!fs.existsSync(this.codeChunkFilePath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(this.codeChunkFilePath, 'utf8');
      const parsed = JSON.parse(raw) as CodeChunkRecord[];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

    loadCodeSymbolRecords(): CodeSymbolRecord[] {
    if (!fs.existsSync(this.codeSymbolRecordsPath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(this.codeSymbolRecordsPath, 'utf8');
      const parsed = JSON.parse(raw) as CodeSymbolRecord[];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveCodeSymbolRecords(records: CodeSymbolRecord[]): void {
    fs.mkdirSync(this.storageDir, { recursive: true });
    fs.writeFileSync(this.codeSymbolRecordsPath, JSON.stringify(records, null, 2), 'utf8');
  }

  replaceCodeSymbolsForRepository(repositoryPath: string, records: CodeSymbolRecord[]): void {
    const existing = this.loadCodeSymbolRecords().filter(
      (record) => record.repositoryPath !== repositoryPath,
    );

    this.saveCodeSymbolRecords([...existing, ...records]);
  }

  searchCodeSymbolRecords(
  queryEmbedding: number[],
  topK = 5,
  preferredFilePath?: string,
): RankedCodeSymbolRecord[] {
  return this.loadCodeSymbolRecords()
    .map((record) => {
      const baseSimilarity = this.cosineSimilarity(queryEmbedding, record.embedding);
      const preferredFileBoost = preferredFilePath && record.filePath === preferredFilePath ? 0.1 : 0;

      return {
        record,
        similarity: Math.min(baseSimilarity + preferredFileBoost, 1),
      };
    })
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, topK);
}

    searchCodeChunkRecords(queryEmbedding: number[], topK = 5): RankedCodeChunkRecord[] {
    return this.loadCodeChunkRecords()
      .map((record) => ({
        record,
        similarity: this.cosineSimilarity(queryEmbedding, record.embedding),
      }))
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, topK);
  }


  saveCodeChunkRecords(records: CodeChunkRecord[]): void {
    fs.mkdirSync(this.storageDir, { recursive: true });
    fs.writeFileSync(this.codeChunkFilePath, JSON.stringify(records, null, 2), 'utf8');
  }

  replaceCodeChunksForRepository(repositoryPath: string, records: CodeChunkRecord[]): void {
    const existing = this.loadCodeChunkRecords().filter(
      (record) => record.repositoryPath !== repositoryPath,
    );

    this.saveCodeChunkRecords([...existing, ...records]);
  }

  private cosineSimilarity(left: number[], right: number[]): number {
    if (left.length === 0 || right.length === 0 || left.length !== right.length) {
      return 0;
    }

    let dotProduct = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;

    for (let index = 0; index < left.length; index += 1) {
      dotProduct += left[index] * right[index];
      leftMagnitude += left[index] * left[index];
      rightMagnitude += right[index] * right[index];
    }

    if (leftMagnitude === 0 || rightMagnitude === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
  }

  private get retrievalFilePath(): string {
    return path.join(this.storageDir, 'retrieval-records.json');
  }

  private get embeddingFilePath(): string {
    return path.join(this.storageDir, 'embedding-records.json');
  }

  loadRecords(): RetrievalRecord[] {
    if (!fs.existsSync(this.retrievalFilePath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(this.retrievalFilePath, 'utf8');
      const parsed = JSON.parse(raw) as RetrievalRecord[];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveRecords(records: RetrievalRecord[]): void {
    fs.mkdirSync(this.storageDir, { recursive: true });
    fs.writeFileSync(this.retrievalFilePath, JSON.stringify(records, null, 2), 'utf8');
  }

    appendRecord(record: RetrievalRecord): boolean {
    const existing = this.loadRecords();
    const duplicate = existing.some(
      (existingRecord) =>
        existingRecord.repositoryName === record.repositoryName &&
        existingRecord.problemStatement === record.problemStatement &&
        existingRecord.targetFilePath === record.targetFilePath &&
        existingRecord.diffText === record.diffText,
    );

    if (duplicate) {
      return false;
    }

    existing.push(record);
    this.saveRecords(existing);
    return true;
  }

  loadEmbeddingRecords(): EmbeddingRecord[] {
    if (!fs.existsSync(this.embeddingFilePath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(this.embeddingFilePath, 'utf8');
      const parsed = JSON.parse(raw) as EmbeddingRecord[];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveEmbeddingRecords(records: EmbeddingRecord[]): void {
    fs.mkdirSync(this.storageDir, { recursive: true });
    fs.writeFileSync(this.embeddingFilePath, JSON.stringify(records, null, 2), 'utf8');
  }

    appendEmbeddingRecord(record: EmbeddingRecord): boolean {
    const existing = this.loadEmbeddingRecords();
    const duplicate = existing.some(
      (existingRecord) =>
        existingRecord.sourceRecordId === record.sourceRecordId ||
        existingRecord.text === record.text,
    );

    if (duplicate) {
      return false;
    }

    existing.push(record);
    this.saveEmbeddingRecords(existing);
    return true;
  }
}
