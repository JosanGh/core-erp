import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/useAuth';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import type { UserRole } from '../../types/auth';
import {
  Users,
  UserPlus,
  ShieldAlert,
  KeyRound,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UserCheck,
} from 'lucide-react';

interface Profile {
  id: string;
  org_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone?: string;
  created_at: string;
}

const ROLE_BADGES: Partial<Record<UserRole, { label: string; color: string }>> = {
  admin: { label: 'Admin', color: 'bg-purple-950/80 text-purple-300 border-purple-500/30' },
  manager: { label: 'Manager', color: 'bg-blue-950/80 text-blue-300 border-blue-500/30' },
  cashier: { label: 'Cashier', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30' },
  pharmacist: { label: 'Pharmacist', color: 'bg-teal-950/80 text-teal-300 border-teal-500/30' },
  collector: { label: 'Susu Collector', color: 'bg-amber-950/80 text-amber-300 border-amber-500/30' },
  driver: { label: 'Delivery Driver', color: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/30' },
};

export const UserManagement: React.FC = () => {
  const { organization } = useAuth();
  const { isAuthorized } = useRoleGuard(['admin', 'manager']);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  // New employee form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [assignedRole, setAssignedRole] = useState<UserRole>('cashier');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    setStatusMessage(null);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('org_id', organization.id)
      .order('created_at', { ascending: false });

    if (error) {
      setStatusMessage({ type: 'error', text: `Failed to load staff: ${error.message}` });
    } else if (data) {
      setProfiles(data as Profile[]);
    }
    setLoading(false);
  }, [organization]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle creating a new employee profile and credentials
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    setSubmitting(true);
    setStatusMessage(null);

    try {
      // 1. Sign up user using Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            org_id: organization.id,
            role: assignedRole,
          },
        },
      });

      if (authErr) throw authErr;

      if (authData.user) {
        // 2. Insert or update record in public.profiles table
        const { error: profileErr } = await supabase.from('profiles').upsert({
          id: authData.user.id,
          org_id: organization.id,
          full_name: fullName,
          email,
          phone: phone || null,
          role: assignedRole,
        });

        if (profileErr) throw profileErr;
      }

      setStatusMessage({ type: 'success', text: `Employee profile created for ${fullName} (${assignedRole.toUpperCase()}).` });
      setIsCreateOpen(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `User creation failed: ${err.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Role Assignment change inline
  const handleRoleUpdate = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p))
      );
      setStatusMessage({ type: 'success', text: 'User role updated successfully.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to update role: ${err.message}` });
    }
  };

  // Handle password reset request
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);

    try {
      // Sends a password reset email to the employee's registered email
      const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setStatusMessage({
        type: 'success',
        text: `Password reset email dispatched to ${selectedUser.email}.`,
      });
      setIsResetOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Password reset failed: ${err.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setAssignedRole('cashier');
  };

  if (!isAuthorized) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-100">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          You must have Administrator or Manager privileges to manage staff accounts and role permissions.
        </p>
      </div>
    );
  }

  const filteredProfiles = profiles.filter(
    (p) =>
      p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-cyan-400" />
            Staff & Access Role Management
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Provision employee credentials, assign role-based access controls (RBAC), and manage security keys
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 shadow-lg transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Provision Employee
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`mb-6 flex items-center gap-3 rounded-xl border p-4 text-xs font-semibold ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : 'bg-red-950/80 border-red-500/50 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6 relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search employees by name, email, or role..."
          className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
        />
      </div>

      {/* Staff Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/50 uppercase text-slate-400">
            <tr>
              <th className="px-5 py-3.5">Employee Name</th>
              <th className="px-5 py-3.5">Email / Contact</th>
              <th className="px-5 py-3.5">Assigned Role</th>
              <th className="px-5 py-3.5">Role Authorization</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {filteredProfiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  {loading ? 'Loading employee profiles...' : 'No employees found.'}
                </td>
              </tr>
            ) : (
              filteredProfiles.map((user) => (
                <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-4 font-bold text-white flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-cyan-400 shrink-0" />
                    {user.full_name || 'Unnamed Employee'}
                  </td>
                  <td className="px-5 py-4 text-slate-300">
                    <div>{user.email}</div>
                    {user.phone && <div className="text-[10px] text-slate-500">{user.phone}</div>}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[10px] font-bold ${
                        ROLE_BADGES[user.role]?.color || 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {ROLE_BADGES[user.role]?.label || user.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleUpdate(user.id, e.target.value as UserRole)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="cashier">Cashier (POS)</option>
                      <option value="pharmacist">Pharmacist</option>
                      <option value="collector">Susu Collector</option>
                      <option value="driver">Delivery Driver</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setIsResetOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                      Reset Credentials
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-cyan-400" /> Provision New Staff Account
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Create employee credentials and assign RBAC permissions
            </p>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Kwame Mensah"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kwame@company.com"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+233 24 000 0000"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">System Role</label>
                <select
                  value={assignedRole}
                  onChange={(e) => setAssignedRole(e.target.value as UserRole)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="cashier">Cashier (POS Checkout)</option>
                  <option value="pharmacist">Pharmacist (Drugs & Batches)</option>
                  <option value="collector">Susu Collector (Field Micro-Finance)</option>
                  <option value="driver">Delivery Driver (Water Route Truck)</option>
                  <option value="manager">Manager (Full Ops Access)</option>
                  <option value="admin">Administrator (System & Security)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {submitting ? 'Provisioning...' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET CREDENTIALS MODAL */}
      {isResetOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-400" /> Reset Password & Credentials
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Send a secure password reset link to <strong className="text-white">{selectedUser.email}</strong>
            </p>

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                Clicking confirm will send an automated password reset recovery link to the user's primary email address.
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetOpen(false);
                    setSelectedUser(null);
                  }}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {submitting ? 'Dispatching...' : 'Send Recovery Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};