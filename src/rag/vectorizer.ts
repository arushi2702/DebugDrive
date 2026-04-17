export class SimpleVectorizer {
  constructor(private readonly dimensions = 16) {}

  embedText(text: string): number[] {
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
