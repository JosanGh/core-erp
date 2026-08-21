import React, { useCallback, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Profile, Organization, IndustryType, UserRole, SchoolLevel } from '../types/auth';
import { logAuditEvent } from '../lib/auditLogger';
import { AuthContext } from './AuthContextStore';
import type { SignUpParams } from './AuthContextStore';
import { isStandardPassword } from '../utils/authValidation';
const DEMO_ACCOUNT_KEY = 'core-erp-demo-account';

interface DemoAccount extends SignUpParams {
  id: string;
  verified?: boolean;
  trialStartedAt?: string;
  trialEndsAt?: string;
  businessAddress?: string;
}

const createDemoSession = (account: DemoAccount) => {
  const trialStartedAt = account.trialStartedAt ?? new Date().toISOString();
  const trialEndsAt = account.trialEndsAt ?? new Date(Date.parse(trialStartedAt) + 15 * 86400000).toISOString();
  const demoUser = {
    id: account.id,
    email: account.email,
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: { full_name: account.fullName, org_name: account.orgName, industry_type: account.industryType, role: 'owner' },
  } as User;
  const profile: Profile = {
    id: account.id,
    org_id: `${account.id}-org`,
    email: account.email,
    full_name: account.fullName,
    role: 'owner',
    created_at: new Date().toISOString(),
  };
  const organization: Organization = {
    id: profile.org_id,
    name: account.orgName,
    address: account.businessAddress,
    industry_type: account.industryType,
    created_at: profile.created_at,
    school_level: account.schoolLevel,
    trial_started_at: trialStartedAt,
    trial_ends_at: trialEndsAt,
    subscription_status: 'trial',
  };
  return { user: demoUser, profile, organization };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessState, setAccessState] = useState<'trial' | 'active' | 'expired' | 'suspended'>('trial');
  const [accessEndsAt, setAccessEndsAt] = useState<string | null>(null);
  const [tenantMembershipValid, setTenantMembershipValid] = useState(false);

  const fetchUserData = useCallback(async (userId: string, authUser: User) => {
    try {
      // 1. Fetch user profile
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileErr) throw profileErr;
      setProfile(profileData as Profile);

      // 2. Fetch organization details
      if (profileData?.org_id) {
        const { data: orgData, error: orgErr } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profileData.org_id)
          .single();

        if (orgErr) throw orgErr;
        setOrganization(orgData as Organization);
        setTenantMembershipValid(profileData.org_id === orgData.id && Boolean(profileData.is_active ?? true));
        const { data: accessData, error: accessError } = await supabase.rpc('workspace_access_state', { p_org_id: profileData.org_id });
        if (accessError) throw accessError;
        const access = Array.isArray(accessData) ? accessData[0] : accessData;
        const nextAccess = access?.access_state === 'active' || access?.access_state === 'trial' || access?.access_state === 'suspended' ? access.access_state : 'expired';
        setAccessState(nextAccess);
        setAccessEndsAt(nextAccess === 'trial' ? access?.trial_ends_at ?? null : access?.subscription_ends_at ?? null);
      }
    } catch (err) {
      console.error('Error fetching user context:', err);
      setProfile(null);
      setOrganization(null);
      setTenantMembershipValid(false);
      if (!isSupabaseConfigured) {
        const metadata = authUser.user_metadata;
        if (metadata?.full_name && metadata?.org_name && metadata?.industry_type) {
        const fallback = createDemoSession({
          id: userId,
          email: authUser.email ?? '',
          password: '',
          fullName: String(metadata.full_name),
          orgName: String(metadata.org_name),
          industryType: metadata.industry_type as IndustryType,
          schoolLevel: metadata.school_level as SchoolLevel | undefined,
        });
        setProfile(fallback.profile);
        setOrganization(fallback.organization);
        setAccessState('trial');
        setAccessEndsAt(fallback.organization.trial_ends_at ?? null);
        setTenantMembershipValid(true);
        }
      }
    }
  }, []);

  useEffect(() => {
    // Check initial auth session
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (!session.user.email_confirmed_at) {
          await supabase.auth.signOut();
          setTenantMembershipValid(false);
          setLoading(false);
          return;
        }
        fetchUserData(session.user.id, session.user).finally(() => setLoading(false));
      } else {
        const savedAccount = localStorage.getItem(DEMO_ACCOUNT_KEY);
        if (savedAccount && !isSupabaseConfigured) {
          const fallback = createDemoSession(JSON.parse(savedAccount) as DemoAccount);
          setUser(fallback.user);
          setProfile(fallback.profile);
          setOrganization(fallback.organization);
          setAccessState('trial');
          setAccessEndsAt(fallback.organization.trial_ends_at ?? null);
          setTenantMembershipValid(true);
        }
        setLoading(false);
      }
    });

    // Listen to real-time auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (!session.user.email_confirmed_at) {
          setTenantMembershipValid(false);
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
        await fetchUserData(session.user.id, session.user);
      } else {
        setProfile(null);
        setOrganization(null);
        setAccessState('trial');
        setAccessEndsAt(null);
        setTenantMembershipValid(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signIn = async (email: string, password: string) => {
    if (!isStandardPassword(password)) return { error: new Error('Invalid password format. Use at least 8 characters with uppercase, lowercase, number, and special character.') };
    if (!isSupabaseConfigured) {
      const savedAccount = localStorage.getItem(DEMO_ACCOUNT_KEY);
      if (!savedAccount) return { error: new Error('No local workspace exists yet. Create an account first.') };
      const account = JSON.parse(savedAccount) as DemoAccount;
      if (account.verified === false) return { error: new Error('Verify your email before signing in.') };
      if (account.email.toLowerCase() !== email.trim().toLowerCase() || account.password !== password) {
        return { error: new Error('Incorrect email or password.') };
      }
      const fallback = createDemoSession(account);
      setUser(fallback.user);
      setProfile(fallback.profile);
      setOrganization(fallback.organization);
      const nextAccess = fallback.organization.trial_ends_at && new Date(fallback.organization.trial_ends_at) > new Date() ? 'trial' : 'expired';
      setAccessState(nextAccess);
      setAccessEndsAt(nextAccess === 'trial' ? fallback.organization.trial_ends_at ?? null : null);
      await logAuditEvent({ orgId: fallback.organization.id, module: 'auth', action: 'SIGN_IN', actorId: fallback.user.id, actorEmail: fallback.user.email ?? undefined, actorRole: fallback.profile.role });
      return { error: null };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && !data.user?.email_confirmed_at) return { error: new Error('Verify your email before signing in.') };
    return { error };
  };

  const signUp = async ({ email, password, fullName, orgName, industryType, schoolLevel }: SignUpParams) => {
    if (!isStandardPassword(password)) return { error: new Error('Invalid password format. Use at least 8 characters with uppercase, lowercase, number, and special character.'), needsConfirmation: false };
    if (!isSupabaseConfigured) {
      const trialStartedAt = new Date().toISOString();
      const account = { id: crypto.randomUUID(), email, password, fullName, orgName, industryType, schoolLevel, verified: true, trialStartedAt, trialEndsAt: new Date(Date.now() + 15 * 86400000).toISOString() };
      localStorage.setItem(DEMO_ACCOUNT_KEY, JSON.stringify(account));
      const fallback = createDemoSession(account);
      setUser(fallback.user);
      setProfile(fallback.profile);
      setOrganization(fallback.organization);
      setAccessState('trial');
      setAccessEndsAt(fallback.organization.trial_ends_at ?? null);
      await logAuditEvent({ orgId: fallback.organization.id, module: 'auth', action: 'ACCOUNT_CREATED', actorId: fallback.user.id, actorEmail: fallback.user.email ?? undefined, actorRole: fallback.profile.role });
      return { error: null, needsConfirmation: false };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          org_name: orgName,
          industry_type: industryType,
          school_level: schoolLevel,
          role: 'owner' as UserRole,
        },
      },
    });
    return { error, needsConfirmation: !error };
  };

  const signOut = async () => {
    if (organization && user) {
      await logAuditEvent({ orgId: organization.id, module: 'auth', action: 'SIGN_OUT', actorId: user.id, actorEmail: user.email ?? undefined, actorRole: profile?.role });
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setOrganization(null);
    setAccessState('trial');
    setAccessEndsAt(null);
    setTenantMembershipValid(false);
  };

  const updateOrganization = async (updates: Partial<Organization>) => {
    setOrganization((current) => (current ? { ...current, ...updates } : current));
    if (isSupabaseConfigured && organization) {
      if (updates.name !== undefined || updates.address !== undefined) {
        const { data, error } = await supabase.rpc('update_organization_details', { p_org_id: organization.id, p_name: updates.name ?? organization.name, p_address: updates.address ?? organization.address ?? '' });
        if (error) throw error;
        if (data) setOrganization(data as Organization);
      }
      if (updates.school_level !== undefined) {
        const { error } = await supabase.from('organizations').update({ school_level: updates.school_level }).eq('id', organization.id);
        if (error) throw error;
      }
    } else {
      const savedAccount = localStorage.getItem(DEMO_ACCOUNT_KEY);
      if (savedAccount) {
        const account = JSON.parse(savedAccount) as DemoAccount;
        localStorage.setItem(DEMO_ACCOUNT_KEY, JSON.stringify({ ...account, orgName: updates.name ?? account.orgName, businessAddress: updates.address ?? account.businessAddress, schoolLevel: updates.school_level ?? account.schoolLevel }));
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, organization, session, loading, signIn, signUp, signOut, updateOrganization, accessState, accessEndsAt, tenantMembershipValid }}
    >
      {children}
    </AuthContext.Provider>
  );
};
