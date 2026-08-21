import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Cloud, CloudOff, RefreshCw, Truck, Wallet, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../lib/auditLogger';

interface PendingWaterEntry { id: string; org_id: string; actor_id: string; type: 'cash_sale' | 'delivery_reconciliation'; amount: number; units_loaded: number; units_sold: number; units_returned: number; units_damaged: number; reference: string; recorded_at: string; synced: boolean; }
const QUEUE_KEY = 'core-erp-water-field-queue';

export const WaterFieldOperations = ({ onBack }: { onBack: () => void }) => {
  const { user, profile, organization } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<PendingWaterEntry[]>([]);
  const [mode, setMode] = useState<'cash_sale' | 'delivery_reconciliation'>('cash_sale');
  const [form, setForm] = useState({ reference: '', amount: '', loaded: '', sold: '', returned: '', damaged: '' });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    const all = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') as PendingWaterEntry[];
    setQueue(all.filter((entry) => entry.org_id === organization?.id && !entry.synced));
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, [organization]);

  const syncQueue = async () => {
    if (!online || !isSupabaseConfigured || !organization || !user) return;
    const all = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') as PendingWaterEntry[];
    for (const entry of all.filter((item) => item.org_id === organization.id && !item.synced)) {
      const { error } = await supabase.from('water_field_transactions').insert({ id: entry.id, org_id: entry.org_id, actor_id: entry.actor_id, transaction_type: entry.type, amount: entry.amount, units_loaded: entry.units_loaded, units_sold: entry.units_sold, units_returned: entry.units_returned, units_damaged: entry.units_damaged, reference: entry.reference, client_recorded_at: entry.recorded_at });
      if (!error) entry.synced = true;
    }
    localStorage.setItem(QUEUE_KEY, JSON.stringify(all));
    setQueue(all.filter((entry) => entry.org_id === organization.id && !entry.synced));
  };

  const submit = async () => {
    if (!organization || !user || !form.reference.trim()) return;
    const entry: PendingWaterEntry = { id: crypto.randomUUID(), org_id: organization.id, actor_id: user.id, type: mode, amount: Number(form.amount) || 0, units_loaded: Number(form.loaded) || 0, units_sold: Number(form.sold) || 0, units_returned: Number(form.returned) || 0, units_damaged: Number(form.damaged) || 0, reference: form.reference.trim(), recorded_at: new Date().toISOString(), synced: false };
    if (mode === 'delivery_reconciliation' && entry.units_sold + entry.units_returned + entry.units_damaged !== entry.units_loaded) { setMessage('Loaded units must equal sold + returned + damaged.'); return; }
    const all = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') as PendingWaterEntry[];
    localStorage.setItem(QUEUE_KEY, JSON.stringify([...all, entry])); setQueue((current) => [...current, entry]);
    if (online && isSupabaseConfigured) await syncQueue();
    await logAuditEvent({ orgId: organization.id, module: 'water', action: mode === 'cash_sale' ? 'WATER_CASH_SALE_RECORDED' : 'WATER_DELIVERY_RECONCILED', targetResource: entry.reference, details: { offline: !online || !isSupabaseConfigured, amount: entry.amount, units: entry.units_loaded }, actorId: user.id, actorEmail: user.email ?? undefined, actorRole: profile?.role });
    setMessage(`${mode === 'cash_sale' ? 'Cash sale' : 'Delivery reconciliation'} saved${!online ? ' offline' : ''}.`); setForm({ reference: '', amount: '', loaded: '', sold: '', returned: '', damaged: '' });
  };

  const canUseBoth = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'manager';
  const isDriver = profile?.role === 'driver';
  return <section className="workspace-content water-field"><div className="section-heading"><div><button className="back-button" onClick={onBack}><ArrowLeft size={15} /> Factory register</button><span className="eyebrow">Offline field operations</span><h2>Water cashier & delivery</h2><p>Role: {profile?.role?.replace('_', ' ')}. Record sales and route counts without connectivity.</p></div><div className={`connection-status ${online ? 'connected' : 'disconnected'}`}>{online ? <Wifi size={15} /> : <WifiOff size={15} />}{online ? 'Online' : 'Offline'} · {queue.length} queued</div></div><div className="collector-banner"><div className="collector-banner-icon">{online ? <Cloud size={20} /> : <CloudOff size={20} />}</div><div><strong>{online ? 'Ready to sync' : 'Offline-first mode active'}</strong><span>Saved field records stay on this device until synchronized.</span></div><button onClick={() => void syncQueue()}><RefreshCw size={15} /> Sync now</button></div><div className="transaction-tabs">{!isDriver && <button className={mode === 'cash_sale' ? 'selected' : ''} onClick={() => setMode('cash_sale')}><Wallet size={15} /> Cashier sale</button>}{(canUseBoth || isDriver) && <button className={mode === 'delivery_reconciliation' ? 'selected' : ''} onClick={() => setMode('delivery_reconciliation')}><Truck size={15} /> Driver reconciliation</button>}</div><div className="field-form"><label>Reference<input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder={mode === 'cash_sale' ? 'Receipt or route reference' : 'Truck or route number'} /></label>{mode === 'cash_sale' ? <label>Amount received (GHS)<input type="number" min="0" step="0.5" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="250.00" /></label> : <div className="form-two-column"><label>Units loaded<input type="number" min="0" value={form.loaded} onChange={(event) => setForm({ ...form, loaded: event.target.value })} /></label><label>Units sold<input type="number" min="0" value={form.sold} onChange={(event) => setForm({ ...form, sold: event.target.value })} /></label><label>Units returned<input type="number" min="0" value={form.returned} onChange={(event) => setForm({ ...form, returned: event.target.value })} /></label><label>Units damaged<input type="number" min="0" value={form.damaged} onChange={(event) => setForm({ ...form, damaged: event.target.value })} /></label></div>}<button className="primary-button" onClick={() => void submit()}><CheckCircle2 size={16} /> Save field record</button></div>{message && <p className="success-message">{message}</p>}</section>;
};
