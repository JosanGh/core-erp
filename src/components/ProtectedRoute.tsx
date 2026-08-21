import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import type { UserRole, IndustryType } from '../types/auth';
import Checkout from './SubscriptionCheckout';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  allowedIndustries?: IndustryType[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  allowedIndustries,
}) => {
  const { user, profile, organization, loading, accessState, tenantMembershipValid } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (!tenantMembershipValid || !organization || profile.org_id !== organization.id) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 p-6 text-white">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-bold text-red-400">Workspace access blocked</h2>
          <p className="mt-2 text-sm text-slate-400">Your account is not an active member of a registered business workspace.</p>
        </div>
      </div>
    );
  }

  if (accessState === 'expired' || accessState === 'suspended') {
    const isWorkspaceAdmin = profile.role === 'owner' || profile.role === 'admin';
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 p-6 text-white">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-bold text-amber-400">{isWorkspaceAdmin ? 'Workspace subscription required' : 'Workspace access paused'}</h2>
          <p className="mt-2 text-sm text-slate-400">
            {isWorkspaceAdmin ? `This workspace trial has ended. Complete a subscription payment to continue using ${organization?.name}.` : `The ${organization?.name} subscription has ended. Ask your workspace owner or admin to renew it.`}
          </p>
          {isWorkspaceAdmin && <div className="mt-6"><Checkout userEmail={user.email} userId={user.id} /></div>}
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white p-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-bold text-red-400">Access Restricted</h2>
          <p className="mt-2 text-sm text-slate-400">
            Your role (<span className="font-semibold">{profile.role}</span>) does not have permission to view this section.
          </p>
        </div>
      </div>
    );
  }

  if (allowedIndustries && organization && !allowedIndustries.includes(organization.industry_type)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white p-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-bold text-amber-400">Module Not Active</h2>
          <p className="mt-2 text-sm text-slate-400">
            This module is reserved for <span className="font-semibold">{allowedIndustries.join(', ')}</span> businesses.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
};
