export interface UserAccess {
  role: 'admin' | 'editor' | 'viewer';
  suspended?: boolean;
}

export function canEdit(user: UserAccess): boolean {
  return user.role === 'admin' || user.role === 'editor';
}
