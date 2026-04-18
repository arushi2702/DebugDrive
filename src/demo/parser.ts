export function parseTags(input: string): string[] {
  return input.split(',').map((tag) => tag);
}
