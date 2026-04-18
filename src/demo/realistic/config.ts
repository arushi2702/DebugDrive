export interface AppConfig {
  apiUrl?: string;
  timeoutMs?: number;
}

export function normalizeConfig(config: AppConfig): Required<AppConfig> {
  return {
    apiUrl: config.apiUrl ?? '',
    timeoutMs: config.timeoutMs ?? 0,
  };
}
