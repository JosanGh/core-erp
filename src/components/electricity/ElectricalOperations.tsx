import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Lightbulb, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../lib/auditLogger';

interface StockItem { id: string; org_id: string; sku: string; name: string; category: string; quantity: number; reorder_level: number; unit_price: number; }
const LOCAL_ELECTRICAL_KEY = 'core-erp-electrical-stock';

export const ElectricalOperations = () => {
  const { user, profile, organization } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ sku: '', name: '', category: 'Electrical', quantity: '', reorderLevel: '', unitPrice: '' });

  useEffect(() => {
    if (!organization) return;
    const load = async () => {
      if (isSupabaseConfigured) {
        const { data, error: queryError } = await supabase.from('inventory_items').select('*').eq('org_id', organization.id).order('name');
        if (queryError) setError(queryError.message); else setItems((data as StockItem[]) ?? []);
      } else {
        const local = JSON.parse(localStorage.getItem(LOCAL_ELECTRICAL_KEY) || '[]') as StockItem[];
        setItems(local.filter((item) => item.org_id === organization.id));
      }
    };
    void load();
  }, [organization]);

  const filtered = useMemo(() => items.filter((item) => `${item.sku} ${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const lowStock = items.filter((item) => item.quantity <= item.reorder_level).length;

  const addItem = async () => {
    if (!organization || !form.sku.trim() || !form.name.trim() || Number(form.unitPrice) < 0) return;
    setError(null);
    const item: StockItem = { id: crypto.randomUUID(), org_id: organization.id, sku: form.sku.trim(), name: form.name.trim(), category: form.category.trim() || 'Electrical', quantity: Number(form.quantity) || 0, reorder_level: Number(form.reorderLevel) || 0, unit_price: Number(form.unitPrice) || 0 };
    if (isSupabaseConfigured) {
      const { data, error: insertError } = await supabase.from('inventory_items').insert({ ...item, id: undefined }).select().single();
      if (insertError) { setError(insertError.message); return; }
      setItems((current) => [...current, data as StockItem]);
    } else {
      const existing = JSON.parse(localStorage.getItem(LOCAL_ELECTRICAL_KEY) || '[]') as StockItem[];
      localStorage.setItem(LOCAL_ELECTRICAL_KEY, JSON.stringify([item, ...existing])); setItems((current) => [...current, item]);
    }
    await logAuditEvent({ orgId: organization.id, module: 'electrical', action: 'STOCK_ITEM_ADDED', targetResource: item.sku, details: { item: item.name, quantity: item.quantity }, actorId: user?.id, actorEmail: user?.email ?? undefined, actorRole: profile?.role });
    setForm({ sku: '', name: '', category: 'Electrical', quantity: '', reorderLevel: '', unitPrice: '' }); setShowForm(false);
  };

  const removeItem = async (item: StockItem) => {
    if (!organization || !window.confirm(`Remove ${item.name} from stock?`)) return;
    if (isSupabaseConfigured) {
      const { error: deleteError } = await supabase.from('inventory_items').delete().eq('id', item.id).eq('org_id', organization.id);
      if (deleteError) { setError(deleteError.message); return; }
    } else {
      const existing = JSON.parse(localStorage.getItem(LOCAL_ELECTRICAL_KEY) || '[]') as StockItem[];
      localStorage.setItem(LOCAL_ELECTRICAL_KEY, JSON.stringify(existing.filter((entry) => entry.id !== item.id)));
    }
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    await logAuditEvent({ orgId: organization.id, module: 'electrical', action: 'STOCK_ITEM_REMOVED', targetResource: item.sku, actorId: user?.id, actorEmail: user?.email ?? undefined, actorRole: profile?.role });
  };

  return <section className="workspace-content electrical-admin"><div className="section-heading"><div><span className="eyebrow">Electrical inventory control</span><h2>Electrical shop</h2><p>Manage cables, switches, bulbs, sockets, tools, and accessories for {organization?.name}.</p></div><button className="primary-button compact" onClick={() => setShowForm(true)}><Plus size={16} /> Add stock item</button></div><div className="school-stat-grid electrical-stat-grid"><div><Boxes size={18} /><strong>{items.length}</strong><span>Stock items</span></div><div><AlertTriangle size={18} /><strong>{lowStock}</strong><span>Below reorder level</span></div><div><Lightbulb size={18} /><strong>{new Set(items.map((item) => item.category)).size}</strong><span>Categories</span></div></div><div className="school-toolbar"><div className="school-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, SKU, or category" /></div></div>{error && <p className="form-error">{error}</p>}<div className="learner-table"><div className="table-head"><span>SKU</span><span>Item</span><span>Category</span><span>Stock / reorder</span><span /></div>{filtered.length === 0 ? <div className="empty-state"><Boxes size={25} /><strong>No stock items found</strong><p>Add your first electrical item to begin inventory control.</p></div> : filtered.map((item) => <div className="table-row" key={item.id}><strong>{item.sku}</strong><span>{item.name}</span><span className="role-pill">{item.category}</span><span className={item.quantity <= item.reorder_level ? 'expiry-warning' : 'muted-cell'}>{item.quantity} / {item.reorder_level}</span><button className="remove-button" onClick={() => void removeItem(item)} aria-label={`Remove ${item.name}`}><Trash2 size={15} /></button></div>)}</div>{showForm && <div className="modal-backdrop"><div className="dialog"><div className="dialog-header"><div><span className="eyebrow">Inventory register</span><h2>Add stock item</h2></div><button onClick={() => setShowForm(false)} aria-label="Close dialog">×</button></div><p className="dialog-copy">Capture pricing and reorder levels so the shop can avoid stock-outs.</p><label>SKU<input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="SW-001" /></label><label>Item name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="13A wall socket" /></label><label>Category<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Switches and sockets" /></label><div className="form-two-column"><label>Quantity<input type="number" min="0" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="50" /></label><label>Reorder level<input type="number" min="0" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })} placeholder="10" /></label></div><label>Unit price (GHS)<input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} placeholder="35.00" /></label><button className="primary-button" onClick={() => void addItem()}><Plus size={16} /> Save stock item</button></div></div>}</section>;
};
