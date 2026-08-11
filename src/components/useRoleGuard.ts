import { useAuth } from '../context/AuthContext';

export type UserRole = 'admin' | 'manager' | 'cashier' | 'pharmacist' | 'collector' | 'driver';

export const useRoleGuard = (allowedRoles: UserRole[]) => {
  const { user } = useAuth();
  
  // Extract role from metadata or user object
  const currentRole = (user?.app_metadata?.role || user?.user_metadata?.role || 'cashier') as UserRole;
  
  const isAuthorized = allowedRoles.includes(currentRole) || currentRole === 'admin';

  return { isAuthorized, currentRole };
};