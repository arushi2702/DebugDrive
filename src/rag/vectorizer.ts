import { EmbeddingProvider } from './embeddingProvider';

export class SimpleVectorizer implements EmbeddingProvider {
  readonly name = 'simple-deterministic-vectorizer';

  constructor(private readonly dimensions = 16) {}

  async embedText(text: string): Promise<number[]> {
    const vector = new Array<number>(this.dimensions).fill(0);

    for (let index = 0; index < text.length; index += 1) {
      const charCode = text.charCodeAt(index);
      vector[index % this.dimensions] += charCode;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

    if (magnitude === 0) {
      return vector;
    }

    return vector.map((value) => value / magnitude);
  }
}
