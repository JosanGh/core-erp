import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

export type { UserRole };

export const useRoleGuard = (allowedRoles: UserRole[]) => {
  const { user } = useAuth();

  const currentRole = (user?.app_metadata?.role || user?.user_metadata?.role || 'cashier') as UserRole;
  const isAuthorized = allowedRoles.includes(currentRole) || currentRole === 'admin';

  return { isAuthorized, currentRole };
};
