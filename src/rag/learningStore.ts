import * as fs from 'fs';
import * as path from 'path';
import { LearningRecord } from '../types/agent';

export class LearningStore {
  constructor(private readonly storageDir: string) {}

  private get learningFilePath(): string {
    return path.join(this.storageDir, 'learning-records.json');
  }

  loadRecords(): LearningRecord[] {
    if (!fs.existsSync(this.learningFilePath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(this.learningFilePath, 'utf8');
      const parsed = JSON.parse(raw) as LearningRecord[];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveRecords(records: LearningRecord[]): void {
    fs.mkdirSync(this.storageDir, { recursive: true });
    fs.writeFileSync(this.learningFilePath, JSON.stringify(records, null, 2), 'utf8');
  }

  appendRecord(record: LearningRecord): void {
    const existing = this.loadRecords();
    existing.push(record);
    this.saveRecords(existing);
  }
}
