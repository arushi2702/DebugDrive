export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function unwrapResponse<T>(response: ApiResponse<T>): T {
  return response.data as T;
}
