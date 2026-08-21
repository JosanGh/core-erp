import { useEffect, useMemo, useState } from 'react';
import { Droplets, Factory, Plus, Search, Trash2, Truck } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../lib/auditLogger';
import { WaterFieldOperations } from './WaterFieldOperations';

interface ProductionRun {
  id: string;
  org_id: string;
  batch_number: string;
  product_name: string;
  quantity: number;
  produced_at: string;
}

const LOCAL_WATER_KEY = 'core-erp-water-production';

export const WaterOperations = () => {
  const { user, profile, organization } = useAuth();
  const [runs, setRuns] = useState<ProductionRun[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showFieldMode, setShowFieldMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ batchNumber: '', productName: 'Sachet water', quantity: '' });

  useEffect(() => {
    if (!organization) return;
    const loadRuns = async () => {
      if (isSupabaseConfigured) {
        const { data, error: queryError } = await supabase.from('water_production_runs').select('*').eq('org_id', organization.id).order('produced_at', { ascending: false });
        if (queryError) setError(queryError.message);
        else setRuns((data as ProductionRun[]) ?? []);
        return;
      }
      const local = JSON.parse(localStorage.getItem(LOCAL_WATER_KEY) || '[]') as ProductionRun[];
      setRuns(local.filter((run) => run.org_id === organization.id));
    };
    void loadRuns();
  }, [organization]);

  const filteredRuns = useMemo(() => runs.filter((run) => `${run.batch_number} ${run.product_name}`.toLowerCase().includes(search.toLowerCase())), [runs, search]);
  const totalUnits = runs.reduce((sum, run) => sum + run.quantity, 0);

  if (showFieldMode) return <WaterFieldOperations onBack={() => setShowFieldMode(false)} />;

  const addRun = async () => {
    if (!organization || !form.batchNumber.trim() || !form.productName.trim() || Number(form.quantity) <= 0) return;
    setError(null);
    const run: ProductionRun = { id: crypto.randomUUID(), org_id: organization.id, batch_number: form.batchNumber.trim(), product_name: form.productName.trim(), quantity: Number(form.quantity), produced_at: new Date().toISOString() };
    if (isSupabaseConfigured) {
      const { data, error: insertError } = await supabase.from('water_production_runs').insert({ ...run, id: undefined, created_by: user?.id }).select().single();
      if (insertError) { setError(insertError.message); return; }
      setRuns((current) => [data as ProductionRun, ...current]);
    } else {
      const existing = JSON.parse(localStorage.getItem(LOCAL_WATER_KEY) || '[]') as ProductionRun[];
      localStorage.setItem(LOCAL_WATER_KEY, JSON.stringify([run, ...existing]));
      setRuns((current) => [run, ...current]);
    }
    await logAuditEvent({ orgId: organization.id, module: 'water', action: 'PRODUCTION_RUN_ADDED', targetResource: run.batch_number, details: { product_name: run.product_name, quantity: run.quantity }, actorId: user?.id, actorEmail: user?.email ?? undefined, actorRole: profile?.role });
    setForm({ batchNumber: '', productName: 'Sachet water', quantity: '' });
    setShowForm(false);
  };

  const removeRun = async (run: ProductionRun) => {
    if (!organization || !window.confirm(`Remove production batch ${run.batch_number}?`)) return;
    if (isSupabaseConfigured) {
      const { error: deleteError } = await supabase.from('water_production_runs').delete().eq('id', run.id).eq('org_id', organization.id);
      if (deleteError) { setError(deleteError.message); return; }
    } else {
      const existing = JSON.parse(localStorage.getItem(LOCAL_WATER_KEY) || '[]') as ProductionRun[];
      localStorage.setItem(LOCAL_WATER_KEY, JSON.stringify(existing.filter((item) => item.id !== run.id)));
    }
    setRuns((current) => current.filter((item) => item.id !== run.id));
    await logAuditEvent({ orgId: organization.id, module: 'water', action: 'PRODUCTION_RUN_REMOVED', targetResource: run.batch_number, actorId: user?.id, actorEmail: user?.email ?? undefined, actorRole: profile?.role });
  };

  return <section className="workspace-content water-admin"><div className="section-heading"><div><span className="eyebrow">Production control</span><h2>Water operations</h2><p>Track sachet, bottled, and dispenser water production for {organization?.name}.</p></div><div className="section-actions"><button className="secondary-button" onClick={() => setShowFieldMode(true)}><Truck size={15} /> Field mode</button><button className="primary-button compact" onClick={() => setShowForm(true)}><Plus size={16} /> Log production</button></div></div><div className="school-stat-grid water-stat-grid"><div><Factory size={18} /><strong>{runs.length}</strong><span>Production batches</span></div><div><Droplets size={18} /><strong>{totalUnits.toLocaleString()}</strong><span>Total units produced</span></div><div><Truck size={18} /><strong>0</strong><span>Routes awaiting reconciliation</span></div></div><div className="school-toolbar"><div className="school-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search batch or product" /></div></div>{error && <p className="form-error">{error}</p>}<div className="learner-table"><div className="table-head"><span>Batch number</span><span>Product</span><span>Units</span><span>Produced</span><span /></div>{filteredRuns.length === 0 ? <div className="empty-state"><Droplets size={25} /><strong>No production batches</strong><p>Log your first production run to start the factory register.</p></div> : filteredRuns.map((run) => <div className="table-row" key={run.id}><strong>{run.batch_number}</strong><span>{run.product_name}</span><span className="role-pill">{run.quantity.toLocaleString()}</span><span className="muted-cell">{new Date(run.produced_at).toLocaleDateString()}</span><button className="remove-button" onClick={() => void removeRun(run)} aria-label={`Remove ${run.batch_number}`}><Trash2 size={15} /></button></div>)}</div>{showForm && <div className="modal-backdrop"><div className="dialog"><div className="dialog-header"><div><span className="eyebrow">Factory register</span><h2>Log production run</h2></div><button onClick={() => setShowForm(false)} aria-label="Close dialog">×</button></div><p className="dialog-copy">Record finished units from a production line for stock and accountability.</p><label>Batch number<input value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} placeholder="WTR-2026-001" /></label><label>Product name<input value={form.productName} onChange={(event) => setForm({ ...form, productName: event.target.value })} placeholder="Sachet water" /></label><label>Units produced<input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="500" /></label><button className="primary-button" onClick={() => void addRun()}><Plus size={16} /> Save production run</button></div></div>}</section>;
};
