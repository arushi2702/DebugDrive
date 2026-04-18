export interface UserPreferences {
  theme?: string;
}

export function getTheme(preferences: UserPreferences): string {
  return preferences.theme ?? '';
}
