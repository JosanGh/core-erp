import { useAuth } from '../context/useAuth';
import type { UserRole } from '../types/auth';

export type { UserRole };

export const useRoleGuard = (allowedRoles: UserRole[]) => {
  const { profile } = useAuth();

  const currentRole = profile?.role || 'cashier';
  const isAuthorized = allowedRoles.includes(currentRole) || currentRole === 'admin';

  return { isAuthorized, currentRole };
};
