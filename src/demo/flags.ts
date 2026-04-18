export interface FeatureFlags {
  enableBeta?: boolean;
}

export function isBetaEnabled(flags: FeatureFlags): boolean {
  return flags.enableBeta ?? true;
}
