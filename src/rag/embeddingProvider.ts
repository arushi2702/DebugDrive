export interface EmbeddingProvider {
  readonly name: string;
  embedText(text: string): Promise<number[]>;
}
