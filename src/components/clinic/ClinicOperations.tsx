import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, HeartPulse, Plus, Search, Trash2, Users } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../lib/auditLogger';

interface Patient {
  id: string;
  org_id: string;
  patient_number: string;
  full_name: string;
  phone?: string;
  date_of_birth?: string;
  created_at?: string;
}

const LOCAL_CLINIC_KEY = 'core-erp-clinic-patients';

export const ClinicOperations = () => {
  const { user, profile, organization } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ patientNumber: '', fullName: '', phone: '', dateOfBirth: '' });

  useEffect(() => {
    if (!organization) return;
    const load = async () => {
      if (isSupabaseConfigured) {
        const { data, error: queryError } = await supabase.from('clinic_patients').select('*').eq('org_id', organization.id).order('created_at', { ascending: false });
        if (queryError) setError(queryError.message); else setPatients((data as Patient[]) ?? []);
      } else {
        const local = JSON.parse(localStorage.getItem(LOCAL_CLINIC_KEY) || '[]') as Patient[];
        setPatients(local.filter((patient) => patient.org_id === organization.id));
      }
    };
    void load();
  }, [organization]);

  const filtered = useMemo(() => patients.filter((patient) => `${patient.patient_number} ${patient.full_name} ${patient.phone ?? ''}`.toLowerCase().includes(search.toLowerCase())), [patients, search]);

  const addPatient = async () => {
    if (!organization || !form.patientNumber.trim() || !form.fullName.trim()) return;
    setError(null);
    const patient: Patient = { id: crypto.randomUUID(), org_id: organization.id, patient_number: form.patientNumber.trim(), full_name: form.fullName.trim(), phone: form.phone.trim() || undefined, date_of_birth: form.dateOfBirth || undefined, created_at: new Date().toISOString() };
    if (isSupabaseConfigured) {
      const { data, error: insertError } = await supabase.from('clinic_patients').insert({ ...patient, id: undefined }).select().single();
      if (insertError) { setError(insertError.message); return; }
      setPatients((current) => [data as Patient, ...current]);
    } else {
      const existing = JSON.parse(localStorage.getItem(LOCAL_CLINIC_KEY) || '[]') as Patient[];
      localStorage.setItem(LOCAL_CLINIC_KEY, JSON.stringify([patient, ...existing])); setPatients((current) => [patient, ...current]);
    }
    await logAuditEvent({ orgId: organization.id, module: 'clinic', action: 'PATIENT_REGISTERED', targetResource: patient.patient_number, details: { patient_name: patient.full_name }, actorId: user?.id, actorEmail: user?.email ?? undefined, actorRole: profile?.role });
    setForm({ patientNumber: '', fullName: '', phone: '', dateOfBirth: '' }); setShowForm(false);
  };

  const removePatient = async (patient: Patient) => {
    if (!organization || !window.confirm(`Remove patient ${patient.full_name}?`)) return;
    if (isSupabaseConfigured) {
      const { error: deleteError } = await supabase.from('clinic_patients').delete().eq('id', patient.id).eq('org_id', organization.id);
      if (deleteError) { setError(deleteError.message); return; }
    } else {
      const existing = JSON.parse(localStorage.getItem(LOCAL_CLINIC_KEY) || '[]') as Patient[];
      localStorage.setItem(LOCAL_CLINIC_KEY, JSON.stringify(existing.filter((item) => item.id !== patient.id)));
    }
    setPatients((current) => current.filter((item) => item.id !== patient.id));
    await logAuditEvent({ orgId: organization.id, module: 'clinic', action: 'PATIENT_REMOVED', targetResource: patient.patient_number, actorId: user?.id, actorEmail: user?.email ?? undefined, actorRole: profile?.role });
  };

  return <section className="workspace-content clinic-admin"><div className="section-heading"><div><span className="eyebrow">Patient care operations</span><h2>Clinic operations</h2><p>Maintain a secure patient register for {organization?.name}.</p></div><button className="primary-button compact" onClick={() => setShowForm(true)}><Plus size={16} /> Register patient</button></div><div className="school-stat-grid clinic-stat-grid"><div><Users size={18} /><strong>{patients.length}</strong><span>Registered patients</span></div><div><CalendarDays size={18} /><strong>0</strong><span>Appointments today</span></div><div><HeartPulse size={18} /><strong>0</strong><span>Open care records</span></div></div><div className="school-toolbar"><div className="school-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient name, number, or phone" /></div></div>{error && <p className="form-error">{error}</p>}<div className="learner-table"><div className="table-head"><span>Patient no.</span><span>Patient</span><span>Phone</span><span>Date of birth</span><span /></div>{filtered.length === 0 ? <div className="empty-state"><HeartPulse size={25} /><strong>No patients registered</strong><p>Register your first patient to begin the clinic register.</p></div> : filtered.map((patient) => <div className="table-row" key={patient.id}><strong>{patient.patient_number}</strong><span>{patient.full_name}</span><span className="muted-cell">{patient.phone || 'Not provided'}</span><span className="muted-cell">{patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'Not provided'}</span><button className="remove-button" onClick={() => void removePatient(patient)} aria-label={`Remove ${patient.full_name}`}><Trash2 size={15} /></button></div>)}</div>{showForm && <div className="modal-backdrop"><div className="dialog"><div className="dialog-header"><div><span className="eyebrow">Patient register</span><h2>Register patient</h2></div><button onClick={() => setShowForm(false)} aria-label="Close dialog">×</button></div><p className="dialog-copy">Capture the minimum identity details needed to begin a patient care record.</p><label>Patient number<input value={form.patientNumber} onChange={(event) => setForm({ ...form, patientNumber: event.target.value })} placeholder="PT-2026-001" /></label><label>Full name<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Patient full name" /></label><label>Phone number<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="024 000 0000" /></label><label>Date of birth<input type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} /></label><button className="primary-button" onClick={() => void addPatient()}><Plus size={16} /> Save patient</button></div></div>}</section>;
};
