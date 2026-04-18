export function shouldRetry(statusCode: number): boolean {
  return statusCode >= 400;
}
