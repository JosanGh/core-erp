import { useEffect, useMemo, useState } from 'react';
import {
  Activity, Building2, ChevronRight, ClipboardList, CreditCard, Droplets, GraduationCap,
  HeartPulse, KeyRound, LayoutDashboard, Lightbulb, LogOut, Menu, Pill, Plus,
  School, Settings2, ShieldCheck, ShoppingCart, Users, Wallet, X,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { ThemeToggle } from '../ThemeToggle';
import { logAuditEvent, getLocalAuditLogs } from '../../lib/auditLogger';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { AuditLogEntry } from '../../types/audit';
import type { IndustryType, SchoolLevel, UserRole } from '../../types/auth';
import { SchoolAdministration } from '../school/SchoolAdministration';
import { WaterOperations } from '../water/WaterOperations';
import { PharmacyOperations } from '../pharmacy/PharmacyOperations';
import { RetailCheckout } from '../pos/RetailCheckout';
import { ClinicOperations } from '../clinic/ClinicOperations';
import { SusuCollectorOperations } from '../susu/SusuCollectorOperations';
import { ElectricalOperations } from '../electricity/ElectricalOperations';
import { TrialNotice } from '../TrialNotice';
import SubscriptionCheckout from '../SubscriptionCheckout';

type WorkspaceView = 'overview' | 'people' | 'activity' | 'settings' | 'school' | 'water' | 'pharmacy' | 'pos' | 'clinic' | 'susu' | 'electrical';

interface ModuleDefinition {
  id: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  industries: IndustryType[];
  accent: string;
}

const MODULES: ModuleDefinition[] = [
  { id: 'water', label: 'Water production', description: 'Batches, inventory, dispatch, and truck reconciliation', icon: Droplets, industries: ['water_factory'], accent: 'cyan' },
  { id: 'clinic', label: 'Clinic operations', description: 'Patients, appointments, clinicians, and care records', icon: HeartPulse, industries: ['clinic'], accent: 'rose' },
  { id: 'electrical', label: 'Electrical shop', description: 'Stock, quotations, sales, and supplier management', icon: Lightbulb, industries: ['electrical_shop'], accent: 'amber' },
  { id: 'pharmacy', label: 'Pharmacy', description: 'Dispensing, batches, expiry, and prescriptions', icon: Pill, industries: ['pharmacy'], accent: 'emerald' },
  { id: 'pos', label: 'Retail POS', description: 'Fast checkout, products, stock, and daily sales', icon: ShoppingCart, industries: ['supermarket'], accent: 'blue' },
  { id: 'susu', label: 'Susu and loans', description: 'Contributions, collectors, loans, and repayments', icon: Wallet, industries: ['susu_finance'], accent: 'orange' },
  { id: 'school', label: 'School administration', description: 'Learners, classes, fees, attendance, and results', icon: GraduationCap, industries: ['school'], accent: 'violet' },
];

const SCHOOL_LEVELS: { value: SchoolLevel; label: string; detail: string }[] = [
  { value: 'primary', label: 'Primary only', detail: 'Basic 1 to Basic 6' },
  { value: 'junior_high', label: 'Junior high only', detail: 'JHS 1 to JHS 3' },
  { value: 'senior_high', label: 'Senior high only', detail: 'SHS 1 to SHS 3' },
  { value: 'primary_to_junior_high', label: 'Primary to junior high', detail: 'Basic 1 through JHS 3' },
];

const ROLE_OPTIONS: UserRole[] = ['admin', 'manager', 'front_desk', 'sales_person', 'cashier', 'teacher', 'collector', 'driver'];
const LOCAL_STAFF_KEY = 'core-erp-local-staff';

interface StaffMember {
  id: string;
  org_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

const accentClasses: Record<string, string> = {
  cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  blue: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  orange: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
};

export const TenantWorkspace = () => {
  const { user, profile, organization, signOut, updateOrganization } = useAuth();
  const [view, setView] = useState<WorkspaceView>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [newStaff, setNewStaff] = useState({ fullName: '', email: '', role: 'manager' as UserRole });

  const availableModules = useMemo(
    () => MODULES.filter((module) => organization && module.industries.includes(organization.industry_type)),
    [organization],
  );

  useEffect(() => {
    if (!organization) return;
    const savedStaff = JSON.parse(localStorage.getItem(LOCAL_STAFF_KEY) || '[]') as StaffMember[];
    setStaff(savedStaff.filter((member) => member.org_id === organization.id));
    setLogs(getLocalAuditLogs(organization.id));
  }, [organization]);

  const record = async (action: string, targetResource?: string, details?: Record<string, unknown>) => {
    if (!organization) return;
    await logAuditEvent({ orgId: organization.id, module: 'admin', action, targetResource, details, actorId: user?.id, actorEmail: user?.email ?? undefined, actorRole: profile?.role ?? undefined });
    setLogs(getLocalAuditLogs(organization.id));
  };

  const addStaff = async () => {
    if (!organization || !newStaff.fullName.trim() || !newStaff.email.trim()) return;
    setStaffError(null);
    try {
      let member: StaffMember;
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.functions.invoke('invite-subordinate', {
          body: { fullName: newStaff.fullName, email: newStaff.email, role: newStaff.role },
        });
        if (error) throw error;
        member = { id: data.userId, org_id: organization.id, full_name: newStaff.fullName.trim(), email: newStaff.email.trim(), role: newStaff.role, active: true };
      } else {
        member = { id: crypto.randomUUID(), org_id: organization.id, full_name: newStaff.fullName.trim(), email: newStaff.email.trim(), role: newStaff.role, active: true };
        const allStaff = JSON.parse(localStorage.getItem(LOCAL_STAFF_KEY) || '[]') as StaffMember[];
        localStorage.setItem(LOCAL_STAFF_KEY, JSON.stringify([...allStaff, member]));
      }
      setStaff((current) => [...current, member]);
      await record('SUBORDINATE_ADDED', member.email, { role: member.role });
      setNewStaff({ fullName: '', email: '', role: 'manager' });
      setShowAddStaff(false);
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : 'Unable to add subordinate');
    }
  };

  const removeStaff = async (member: StaffMember) => {
    const allStaff = JSON.parse(localStorage.getItem(LOCAL_STAFF_KEY) || '[]') as StaffMember[];
    localStorage.setItem(LOCAL_STAFF_KEY, JSON.stringify(allStaff.filter((item) => item.id !== member.id)));
    setStaff((current) => current.filter((item) => item.id !== member.id));
    await record('SUBORDINATE_REMOVED', member.email, { role: member.role });
  };

  const selectView = (nextView: WorkspaceView) => {
    setView(nextView);
    setMobileNavOpen(false);
  };

  return (
    <div className="tenant-app">
      <aside className={`tenant-sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        <div className="tenant-brand"><div className="brand-mark"><Building2 size={18} /></div><div><strong>Core ERP</strong><span>Ghana business suite</span></div><button className="sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
        <div className="tenant-switcher"><span className="eyebrow">Current workspace</span><strong>{organization?.name}</strong><span className="tenant-industry">{organization?.industry_type.replace('_', ' ')}</span></div>
        <nav className="tenant-nav" aria-label="Workspace navigation">
          <button className={view === 'overview' ? 'active' : ''} onClick={() => selectView('overview')}><LayoutDashboard size={17} /> Overview</button>
          <button className={view === 'people' ? 'active' : ''} onClick={() => selectView('people')}><Users size={17} /> People & access <span>{staff.length}</span></button>
          <button className={view === 'activity' ? 'active' : ''} onClick={() => selectView('activity')}><Activity size={17} /> Activity log</button>
          <button className={view === 'settings' ? 'active' : ''} onClick={() => selectView('settings')}><Settings2 size={17} /> Workspace settings</button>
        </nav>
        <div className="sidebar-footer"><div className="signed-in"><div className="avatar">{profile?.full_name.slice(0, 1).toUpperCase()}</div><div><strong>{profile?.full_name}</strong><span>{profile?.role}</span></div></div><button className="signout-link" onClick={signOut}><LogOut size={16} /> Sign out</button></div>
      </aside>

      <main className="tenant-main">
        <header className="tenant-topbar"><button className="mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div><span className="eyebrow">{view === 'overview' ? 'Operations control center' : view === 'school' ? 'Ghana education administration' : view === 'water' ? 'Production control' : view === 'pharmacy' ? 'Medicine inventory control' : view === 'pos' ? 'Supermarket checkout' : view === 'clinic' ? 'Patient care operations' : view === 'susu' ? 'Field collections' : view === 'electrical' ? 'Electrical inventory control' : view.replace('_', ' ')}</span><h1>{view === 'overview' ? 'Good morning, ' + profile?.full_name.split(' ')[0] : view === 'people' ? 'People & access' : view === 'activity' ? 'Activity log' : view === 'school' ? 'School administration' : view === 'water' ? 'Water operations' : view === 'pharmacy' ? 'Pharmacy operations' : view === 'pos' ? 'Retail POS' : view === 'clinic' ? 'Clinic operations' : view === 'susu' ? 'Susu collector' : view === 'electrical' ? 'Electrical shop' : 'Workspace settings'}</h1></div><div className="topbar-actions"><div className="live-status"><span /> All systems ready</div><ThemeToggle /></div></header>
        <TrialNotice />
        {view === 'overview' && <Overview organizationName={organization?.name ?? ''} industry={organization?.industry_type} modules={availableModules} schoolLevel={organization?.school_level} onOpenSettings={() => selectView('settings')} onOpenSchool={() => selectView('school')} onOpenWater={() => selectView('water')} onOpenPharmacy={() => selectView('pharmacy')} onOpenPos={() => selectView('pos')} onOpenClinic={() => selectView('clinic')} onOpenSusu={() => selectView('susu')} onOpenElectrical={() => selectView('electrical')} />}
        {view === 'people' && <PeopleView staff={staff} canManage={profile?.role === 'owner' || profile?.role === 'admin'} isElectrical={organization?.industry_type === 'electrical_shop'} onAdd={() => setShowAddStaff(true)} onRemove={removeStaff} />}
        {view === 'activity' && <ActivityView logs={logs} />}
        {view === 'settings' && <SettingsView organization={organization} canManage={profile?.role === 'owner' || profile?.role === 'admin'} userEmail={user?.email ?? undefined} onUpdate={updateOrganization} onRecord={record} />}
        {view === 'school' && organization?.industry_type === 'school' && <SchoolAdministration />}
        {view === 'water' && organization?.industry_type === 'water_factory' && <WaterOperations />}
        {view === 'pharmacy' && organization?.industry_type === 'pharmacy' && <PharmacyOperations />}
        {view === 'pos' && organization?.industry_type === 'supermarket' && <RetailCheckout />}
        {view === 'clinic' && organization?.industry_type === 'clinic' && <ClinicOperations />}
        {view === 'susu' && organization?.industry_type === 'susu_finance' && <SusuCollectorOperations />}
        {view === 'electrical' && organization?.industry_type === 'electrical_shop' && <ElectricalOperations />}
      </main>

      {showAddStaff && <div className="modal-backdrop"><div className="dialog"><div className="dialog-header"><div><span className="eyebrow">Access provisioning</span><h2>Add subordinate</h2></div><button onClick={() => setShowAddStaff(false)} aria-label="Close dialog"><X size={18} /></button></div><p className="dialog-copy">Create an access record for a team member in this workspace. Their permissions can be changed later.</p>{staffError && <p className="form-error">{staffError}</p>}<label>Full name<input value={newStaff.fullName} onChange={(event) => setNewStaff({ ...newStaff, fullName: event.target.value })} placeholder="e.g. Kwame Boateng" /></label><label>Work email<input type="email" value={newStaff.email} onChange={(event) => setNewStaff({ ...newStaff, email: event.target.value })} placeholder="staff@company.com" /></label><label>Role<select value={newStaff.role} onChange={(event) => setNewStaff({ ...newStaff, role: event.target.value as UserRole })}>{ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}</select></label><button className="primary-button" onClick={addStaff}><Plus size={16} /> Add subordinate</button></div></div>}
    </div>
  );
};

const Overview = ({ organizationName, industry, modules, schoolLevel, onOpenSettings, onOpenSchool, onOpenWater, onOpenPharmacy, onOpenPos, onOpenClinic, onOpenSusu, onOpenElectrical }: { organizationName: string; industry?: IndustryType; modules: ModuleDefinition[]; schoolLevel?: SchoolLevel; onOpenSettings: () => void; onOpenSchool: () => void; onOpenWater: () => void; onOpenPharmacy: () => void; onOpenPos: () => void; onOpenClinic: () => void; onOpenSusu: () => void; onOpenElectrical: () => void }) => (
  <section className="workspace-content">
    <div className="welcome-banner"><div><span className="eyebrow">{organizationName} / command center</span><h2>One clear view of today&apos;s work.</h2><p>Monitor your {industry?.replace('_', ' ')} operations, people, and audit trail from one tenant workspace.</p></div><div className="banner-icon"><ShieldCheck size={34} /></div></div>
    {industry === 'school' && <div className="school-callout"><div className="callout-icon"><School size={20} /></div><div><strong>{SCHOOL_LEVELS.find((level) => level.value === schoolLevel)?.label ?? 'Choose your school level'}</strong><span>{SCHOOL_LEVELS.find((level) => level.value === schoolLevel)?.detail ?? 'Configure the Ghana curriculum scope for this tenant.'}</span></div><button onClick={onOpenSettings}>Configure <ChevronRight size={15} /></button></div>}
    <div className="section-heading"><div><span className="eyebrow">Tenant modules</span><h2>Operational tools</h2></div><span className="section-count">{modules.length} enabled</span></div>
    <div className="module-grid">{modules.map((module) => { const Icon = module.icon; return <button className="module-card" key={module.id} onClick={module.id === 'school' ? onOpenSchool : module.id === 'water' ? onOpenWater : module.id === 'pharmacy' ? onOpenPharmacy : module.id === 'pos' ? onOpenPos : module.id === 'clinic' ? onOpenClinic : module.id === 'susu' ? onOpenSusu : module.id === 'electrical' ? onOpenElectrical : undefined}><div className={`module-icon ${accentClasses[module.accent]}`}><Icon size={21} /></div><div><strong>{module.label}</strong><p>{module.description}</p></div><ChevronRight size={17} className="module-arrow" /></button>; })}</div>
    <div className="overview-grid"><div className="metric-panel"><div className="panel-heading"><span><Activity size={17} /> Today&apos;s activity</span><button onClick={onOpenSettings}>View details</button></div><div className="metrics"><div><strong>0</strong><span>Transactions</span></div><div><strong>0</strong><span>Tasks pending</span></div><div><strong>0</strong><span>New people</span></div></div></div><div className="metric-panel"><div className="panel-heading"><span><ClipboardList size={17} /> Ghana-ready workspace</span></div><ul className="readiness-list"><li><span className="check">✓</span> Multi-tenant data boundary</li><li><span className="check">✓</span> Role-based access controls</li><li><span className="check">✓</span> Immutable activity tracking</li></ul></div></div>
  </section>
);

const PeopleView = ({ staff, canManage, isElectrical, onAdd, onRemove }: { staff: StaffMember[]; canManage: boolean; isElectrical: boolean; onAdd: () => void; onRemove: (member: StaffMember) => void }) => <section className="workspace-content"><div className="section-heading"><div><span className="eyebrow">Workspace administration</span><h2>People & access</h2><p>Control who can access this tenant and what they are responsible for.</p></div>{canManage && <button className="primary-button compact" onClick={onAdd}><Plus size={16} /> Add subordinate</button>}</div>{isElectrical && <div className="role-policy-banner"><strong>Electrical shop role policy</strong><span>Owners and admins can perform every operation. Add managers, front desk, cashiers, sales people, or other subordinates as the shop grows.</span></div>}<div className="people-table"><div className="table-head"><span>Person</span><span>Role</span><span>Status</span><span>Action</span></div>{staff.length === 0 ? <div className="empty-state"><Users size={25} /><strong>No subordinates yet</strong><p>{canManage ? 'You currently have full operational access. Add a subordinate when you need delegated access.' : 'Admins and owners can add the first team member.'}</p></div> : staff.map((member) => <div className="table-row" key={member.id}><div className="person-cell"><div className="avatar small">{member.full_name.slice(0, 1).toUpperCase()}</div><div><strong>{member.full_name}</strong><span>{member.email}</span></div></div><span className="role-pill">{member.role.replace('_', ' ')}</span><span className="status-pill"><i /> Active</span>{canManage ? <button className="remove-button" onClick={() => onRemove(member)}>Remove</button> : <span className="muted-cell">View only</span>}</div>)}</div></section>;

const ActivityView = ({ logs }: { logs: AuditLogEntry[] }) => <section className="workspace-content"><div className="section-heading"><div><span className="eyebrow">Security & accountability</span><h2>Activity log</h2><p>Every sign-in, sign-out, staff change, and workspace action is recorded.</p></div><span className="section-count">{logs.length} events</span></div><div className="activity-list">{logs.length === 0 ? <div className="empty-state"><Activity size={25} /><strong>No activity recorded yet</strong><p>Workspace actions will appear here as your team works.</p></div> : logs.map((log) => <div className="activity-item" key={log.id}><div className="activity-dot" /><div><strong>{log.action.replaceAll('_', ' ')}</strong><span>{log.actor_email ?? 'System'} · {new Date(log.created_at).toLocaleString()}</span></div><code>{log.module}</code></div>)}</div></section>;

const SettingsView = ({ organization, canManage, userEmail, onUpdate, onRecord }: { organization: ReturnType<typeof useAuth>['organization']; canManage: boolean; userEmail?: string; onUpdate: (updates: Partial<NonNullable<ReturnType<typeof useAuth>['organization']>>) => Promise<void>; onRecord: (action: string, target?: string, details?: Record<string, unknown>) => Promise<void> }) => {
  const [name, setName] = useState(organization?.name ?? '');
  const [address, setAddress] = useState(organization?.address ?? '');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  if (!organization) return null;
  const updateLevel = (level: SchoolLevel) => { void onUpdate({ school_level: level }); void onRecord('SCHOOL_LEVEL_UPDATED', organization.id, { school_level: level }); };
  const saveDetails = async () => {
    if (!canManage || name.trim().length < 2) return;
    setSaving(true); setSaveError(null); setSaveMessage(null);
    try { await onUpdate({ name: name.trim(), address: address.trim() }); await onRecord('BUSINESS_DETAILS_UPDATED', organization.id, { name: name.trim(), address: address.trim() }); setSaveMessage('Business details saved.'); } catch (error) { setSaveError(error instanceof Error ? error.message : 'Unable to save business details.'); } finally { setSaving(false); }
  };
  return <section className="workspace-content"><div className="section-heading"><div><span className="eyebrow">Tenant configuration</span><h2>Workspace settings</h2><p>Configure the operating scope and access rules for {organization.name}.</p></div><div className="settings-lock"><KeyRound size={15} /> {canManage ? 'Owner controls' : 'View only'}</div></div><div className="settings-grid"><div className="settings-card"><div className="settings-card-heading"><div className="module-icon blue"><Building2 size={19} /></div><div><strong>Business details</strong><span>Printed on receipts and invoices</span></div></div><label>Business name<input value={name} onChange={(event) => setName(event.target.value)} readOnly={!canManage} /></label><label>Business address<textarea value={address} onChange={(event) => setAddress(event.target.value)} readOnly={!canManage} rows={3} placeholder="Street, town, region" /></label><label>Industry<input value={organization.industry_type.replace('_', ' ')} readOnly /></label>{canManage && <button className="primary-button compact settings-save" onClick={() => void saveDetails()} disabled={saving}>{saving ? 'Saving...' : 'Save business details'}</button>}{saveMessage && <p className="success-message">{saveMessage}</p>}{saveError && <p className="form-error">{saveError}</p>}</div>{canManage && <div className="settings-card"><div className="settings-card-heading"><div className="module-icon amber"><CreditCard size={19} /></div><div><strong>Subscription payment</strong><span>Pay before the 15-day trial ends</span></div></div><p className="settings-help">Activate your workspace early with a live Paystack or Hubtel payment.</p><button className="secondary-button" onClick={() => setShowPayment((current) => !current)}>{showPayment ? 'Hide payment options' : 'Pay for workspace'}</button>{showPayment && <div className="settings-payment"><SubscriptionCheckout userEmail={userEmail} earlyPayment /></div>}</div>}{organization.industry_type === 'school' && <div className="settings-card"><div className="settings-card-heading"><div className="module-icon violet"><GraduationCap size={19} /></div><div><strong>School scope</strong><span>Ghana education levels enabled for this tenant</span></div></div><div className="level-options">{SCHOOL_LEVELS.map((level) => <button key={level.value} className={organization.school_level === level.value ? 'selected' : ''} onClick={() => updateLevel(level.value)}><span>{level.label}</span><small>{level.detail}</small></button>)}</div></div>}<div className="settings-card"><div className="settings-card-heading"><div className="module-icon emerald"><ShieldCheck size={19} /></div><div><strong>Access policy</strong><span>Tenant-wide security defaults</span></div></div><div className="policy-row"><Users size={17} /><span>Admin and owner can add or remove subordinates</span><strong>Enabled</strong></div><div className="policy-row"><Activity size={17} /><span>All authentication and staff actions are audited</span><strong>Enabled</strong></div></div></div></section>;
};