import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Pill, Plus, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../lib/auditLogger';

interface PharmacyBatch {
  id: string;
  org_id: string;
  medicine_name: string;
  active_ingredient?: string;
  batch_number: string;
  quantity_remaining: number;
  expiry_date: string;
  prescription_required: boolean;
}

const LOCAL_PHARMACY_KEY = 'core-erp-pharmacy-batches';
const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

export const PharmacyOperations = () => {
  const { user, profile, organization } = useAuth();
  const [batches, setBatches] = useState<PharmacyBatch[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'expiring' | 'expired'>('all');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ medicineName: '', activeIngredient: '', batchNumber: '', quantity: '', expiryDate: '', prescriptionRequired: false });

  useEffect(() => {
    if (!organization) return;
    const load = async () => {
      if (isSupabaseConfigured) {
        const { data, error: queryError } = await supabase.from('pharmacy_batches').select('*').eq('org_id', organization.id).order('expiry_date', { ascending: true });
        if (queryError) setError(queryError.message);
        else setBatches((data as PharmacyBatch[]) ?? []);
      } else {
        const local = JSON.parse(localStorage.getItem(LOCAL_PHARMACY_KEY) || '[]') as PharmacyBatch[];
        setBatches(local.filter((batch) => batch.org_id === organization.id));
      }
    };
    void load();
  }, [organization]);

  const filtered = useMemo(() => batches.filter((batch) => {
    const matchesSearch = `${batch.medicine_name} ${batch.active_ingredient ?? ''} ${batch.batch_number}`.toLowerCase().includes(search.toLowerCase());
    const days = daysUntil(batch.expiry_date);
    const matchesFilter = filter === 'all' || (filter === 'expired' && days <= 0) || (filter === 'expiring' && days > 0 && days <= 60);
    return matchesSearch && matchesFilter;
  }), [batches, filter, search]);
  const expired = batches.filter((batch) => daysUntil(batch.expiry_date) <= 0).length;
  const expiring = batches.filter((batch) => daysUntil(batch.expiry_date) > 0 && daysUntil(batch.expiry_date) <= 60).length;

  const addBatch = async () => {
    if (!organization || !form.medicineName.trim() || !form.batchNumber.trim() || !form.expiryDate || Number(form.quantity) < 0) return;
    setError(null);
    const batch: PharmacyBatch = { id: crypto.randomUUID(), org_id: organization.id, medicine_name: form.medicineName.trim(), active_ingredient: form.activeIngredient.trim() || undefined, batch_number: form.batchNumber.trim(), quantity_remaining: Number(form.quantity), expiry_date: form.expiryDate, prescription_required: form.prescriptionRequired };
    if (isSupabaseConfigured) {
      const { data, error: insertError } = await supabase.from('pharmacy_batches').insert({ ...batch, id: undefined }).select().single();
      if (insertError) { setError(insertError.message); return; }
      setBatches((current) => [data as PharmacyBatch, ...current]);
    } else {
      const existing = JSON.parse(localStorage.getItem(LOCAL_PHARMACY_KEY) || '[]') as PharmacyBatch[];
      localStorage.setItem(LOCAL_PHARMACY_KEY, JSON.stringify([batch, ...existing]));
      setBatches((current) => [batch, ...current]);
    }
    await logAuditEvent({ orgId: organization.id, module: 'pharmacy', action: 'MEDICINE_BATCH_ADDED', targetResource: batch.batch_number, details: { medicine: batch.medicine_name, expiry_date: batch.expiry_date }, actorId: user?.id, actorEmail: user?.email ?? undefined, actorRole: profile?.role });
    setForm({ medicineName: '', activeIngredient: '', batchNumber: '', quantity: '', expiryDate: '', prescriptionRequired: false });
    setShowForm(false);
  };

  const removeBatch = async (batch: PharmacyBatch) => {
    if (!organization || !window.confirm(`Remove batch ${batch.batch_number}?`)) return;
    if (isSupabaseConfigured) {
      const { error: deleteError } = await supabase.from('pharmacy_batches').delete().eq('id', batch.id).eq('org_id', organization.id);
      if (deleteError) { setError(deleteError.message); return; }
    } else {
      const existing = JSON.parse(localStorage.getItem(LOCAL_PHARMACY_KEY) || '[]') as PharmacyBatch[];
      localStorage.setItem(LOCAL_PHARMACY_KEY, JSON.stringify(existing.filter((item) => item.id !== batch.id)));
    }
    setBatches((current) => current.filter((item) => item.id !== batch.id));
    await logAuditEvent({ orgId: organization.id, module: 'pharmacy', action: 'MEDICINE_BATCH_REMOVED', targetResource: batch.batch_number, actorId: user?.id, actorEmail: user?.email ?? undefined, actorRole: profile?.role });
  };

  return <section className="workspace-content pharmacy-admin"><div className="section-heading"><div><span className="eyebrow">Medicine inventory control</span><h2>Pharmacy operations</h2><p>Track medicine batches, expiry risk, and prescription-controlled stock.</p></div><button className="primary-button compact" onClick={() => setShowForm(true)}><Plus size={16} /> Add medicine batch</button></div><div className="school-stat-grid pharmacy-stat-grid"><div><Pill size={18} /><strong>{batches.length}</strong><span>Active batches</span></div><div><AlertTriangle size={18} /><strong>{expiring}</strong><span>Expiring within 60 days</span></div><div><ShieldAlert size={18} /><strong>{expired}</strong><span>Expired batches</span></div></div><div className="school-toolbar"><div className="school-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search medicine or batch number" /></div><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All batches</option><option value="expiring">Expiring soon</option><option value="expired">Expired</option></select></div>{error && <p className="form-error">{error}</p>}<div className="learner-table"><div className="table-head"><span>Medicine</span><span>Batch</span><span>Stock</span><span>Expiry</span><span /></div>{filtered.length === 0 ? <div className="empty-state"><Pill size={25} /><strong>No medicine batches found</strong><p>Add a batch to begin expiry monitoring.</p></div> : filtered.map((batch) => { const days = daysUntil(batch.expiry_date); return <div className="table-row" key={batch.id}><div><strong>{batch.medicine_name}</strong>{batch.prescription_required && <span className="rx-badge">Rx</span>}<small>{batch.active_ingredient || 'Ingredient not recorded'}</small></div><span className="role-pill">{batch.batch_number}</span><span>{batch.quantity_remaining}</span><span className={days <= 0 ? 'expiry-danger' : days <= 60 ? 'expiry-warning' : 'muted-cell'}>{days <= 0 ? 'Expired' : `${days} days`}</span><button className="remove-button" onClick={() => void removeBatch(batch)} aria-label={`Remove ${batch.batch_number}`}><Trash2 size={15} /></button></div>; })}</div>{showForm && <div className="modal-backdrop"><div className="dialog"><div className="dialog-header"><div><span className="eyebrow">Pharmacy stock</span><h2>Add medicine batch</h2></div><button onClick={() => setShowForm(false)} aria-label="Close dialog">×</button></div><p className="dialog-copy">Capture batch details so the pharmacy can prevent expired stock from being dispensed.</p><label>Medicine name<input value={form.medicineName} onChange={(event) => setForm({ ...form, medicineName: event.target.value })} placeholder="Amoxicillin" /></label><label>Active ingredient<input value={form.activeIngredient} onChange={(event) => setForm({ ...form, activeIngredient: event.target.value })} placeholder="Amoxicillin trihydrate" /></label><label>Batch number<input value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} placeholder="AMX-2026-01" /></label><div className="form-two-column"><label>Quantity<input type="number" min="0" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="100" /></label><label>Expiry date<input type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} /></label></div><label className="checkbox-line"><input type="checkbox" checked={form.prescriptionRequired} onChange={(event) => setForm({ ...form, prescriptionRequired: event.target.checked })} /> Prescription required</label><button className="primary-button" onClick={() => void addBatch()}><Plus size={16} /> Save medicine batch</button></div></div>}</section>;
};
