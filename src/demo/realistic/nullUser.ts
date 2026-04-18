export interface UserProfile {
  id: string;
  email?: string | null;
}

export function getUserEmail(profile: UserProfile | null): string {
  return profile!.email ?? '';
}
