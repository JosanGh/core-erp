import { useEffect, useMemo, useState } from 'react';
import { BookOpen, GraduationCap, Plus, Search, Trash2, Users } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../lib/auditLogger';
import type { SchoolLevel } from '../../types/auth';

interface Learner {
  id: string;
  org_id: string;
  admission_number: string;
  full_name: string;
  level: string;
  guardian_name?: string;
  guardian_phone?: string;
  created_at?: string;
}

const LOCAL_LEARNERS_KEY = 'core-erp-school-learners';

const levelOptions = (schoolLevel?: SchoolLevel) => {
  if (schoolLevel === 'primary') return ['Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6'];
  if (schoolLevel === 'junior_high') return ['JHS 1', 'JHS 2', 'JHS 3'];
  if (schoolLevel === 'senior_high') return ['SHS 1', 'SHS 2', 'SHS 3'];
  return ['Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6', 'JHS 1', 'JHS 2', 'JHS 3'];
};

export const SchoolAdministration = () => {
  const { user, profile, organization } = useAuth();
  const levels = levelOptions(organization?.school_level);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ admissionNumber: '', fullName: '', level: levels[0] ?? 'Basic 1', guardianName: '', guardianPhone: '' });

  useEffect(() => {
    if (!organization) return;
    const loadLearners = async () => {
      if (isSupabaseConfigured) {
        const { data, error: queryError } = await supabase.from('school_learners').select('*').eq('org_id', organization.id).order('created_at', { ascending: false });
        if (queryError) setError(queryError.message);
        else setLearners((data as Learner[]) ?? []);
        return;
      }
      const local = JSON.parse(localStorage.getItem(LOCAL_LEARNERS_KEY) || '[]') as Learner[];
      setLearners(local.filter((learner) => learner.org_id === organization.id));
    };
    void loadLearners();
  }, [organization]);

  const filteredLearners = useMemo(() => learners.filter((learner) => {
    const matchesSearch = `${learner.full_name} ${learner.admission_number}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (selectedLevel === 'all' || learner.level === selectedLevel);
  }), [learners, search, selectedLevel]);

  const addLearner = async () => {
    if (!organization || !form.admissionNumber.trim() || !form.fullName.trim()) return;
    setError(null);
    const learner: Learner = {
      id: crypto.randomUUID(),
      org_id: organization.id,
      admission_number: form.admissionNumber.trim(),
      full_name: form.fullName.trim(),
      level: form.level,
      guardian_name: form.guardianName.trim() || undefined,
      guardian_phone: form.guardianPhone.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data, error: insertError } = await supabase.from('school_learners').insert({ ...learner, id: undefined }).select().single();
      if (insertError) { setError(insertError.message); return; }
      setLearners((current) => [data as Learner, ...current]);
    } else {
      const allLearners = JSON.parse(localStorage.getItem(LOCAL_LEARNERS_KEY) || '[]') as Learner[];
      localStorage.setItem(LOCAL_LEARNERS_KEY, JSON.stringify([learner, ...allLearners]));
      setLearners((current) => [learner, ...current]);
    }
    await logAuditEvent({ orgId: organization.id, module: 'school', action: 'LEARNER_ADDED', targetResource: learner.admission_number, details: { level: learner.level }, actorId: user?.id, actorEmail: user?.email ?? undefined, actorRole: profile?.role });
    setForm({ admissionNumber: '', fullName: '', level: levels[0] ?? 'Basic 1', guardianName: '', guardianPhone: '' });
    setShowForm(false);
  };

  const removeLearner = async (learner: Learner) => {
    if (!organization || !window.confirm(`Remove ${learner.full_name} from this learner register?`)) return;
    if (isSupabaseConfigured) {
      const { error: deleteError } = await supabase.from('school_learners').delete().eq('id', learner.id).eq('org_id', organization.id);
      if (deleteError) { setError(deleteError.message); return; }
    } else {
      const allLearners = JSON.parse(localStorage.getItem(LOCAL_LEARNERS_KEY) || '[]') as Learner[];
      localStorage.setItem(LOCAL_LEARNERS_KEY, JSON.stringify(allLearners.filter((item) => item.id !== learner.id)));
    }
    setLearners((current) => current.filter((item) => item.id !== learner.id));
    await logAuditEvent({ orgId: organization.id, module: 'school', action: 'LEARNER_REMOVED', targetResource: learner.admission_number, actorId: user?.id, actorEmail: user?.email ?? undefined, actorRole: profile?.role });
  };

  return <section className="workspace-content school-admin"><div className="section-heading"><div><span className="eyebrow">Ghana education administration</span><h2>School administration</h2><p>Manage the learner register for {organization?.school_level?.replaceAll('_', ' ') ?? 'this school'}.</p></div><button className="primary-button compact" onClick={() => setShowForm(true)}><Plus size={16} /> Register learner</button></div><div className="school-stat-grid"><div><Users size={18} /><strong>{learners.length}</strong><span>Registered learners</span></div><div><BookOpen size={18} /><strong>{levels.length}</strong><span>Levels enabled</span></div><div><GraduationCap size={18} /><strong>{new Set(learners.map((learner) => learner.level)).size}</strong><span>Active classes</span></div></div><div className="school-toolbar"><div className="school-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search learners or admission number" /></div><select value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)}><option value="all">All levels</option>{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></div>{error && <p className="form-error">{error}</p>}<div className="learner-table"><div className="table-head"><span>Admission no.</span><span>Learner</span><span>Level</span><span>Guardian</span><span /></div>{filteredLearners.length === 0 ? <div className="empty-state"><GraduationCap size={25} /><strong>No learners found</strong><p>Register your first learner to begin the school register.</p></div> : filteredLearners.map((learner) => <div className="table-row" key={learner.id}><strong>{learner.admission_number}</strong><span>{learner.full_name}</span><span className="role-pill">{learner.level}</span><span className="muted-cell">{learner.guardian_name || 'Not provided'}</span><button className="remove-button" onClick={() => void removeLearner(learner)} aria-label={`Remove ${learner.full_name}`}><Trash2 size={15} /></button></div>)}</div>{showForm && <div className="modal-backdrop"><div className="dialog"><div className="dialog-header"><div><span className="eyebrow">Learner register</span><h2>Register learner</h2></div><button onClick={() => setShowForm(false)} aria-label="Close dialog">×</button></div><p className="dialog-copy">Capture the learner identity and guardian contact for the school register.</p><label>Admission number<input value={form.admissionNumber} onChange={(event) => setForm({ ...form, admissionNumber: event.target.value })} placeholder="e.g. ACC-2026-001" /></label><label>Full name<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Learner full name" /></label><label>Level<select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label><label>Guardian name<input value={form.guardianName} onChange={(event) => setForm({ ...form, guardianName: event.target.value })} placeholder="Parent or guardian" /></label><label>Guardian phone<input value={form.guardianPhone} onChange={(event) => setForm({ ...form, guardianPhone: event.target.value })} placeholder="024 000 0000" /></label><button className="primary-button" onClick={() => void addLearner()}><Plus size={16} /> Save learner</button></div></div>}</section>;
};
