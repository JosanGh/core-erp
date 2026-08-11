import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Product } from '../../types/inventory';
import { Droplet, Plus, AlertOctagon, CheckCircle2, Factory } from 'lucide-react';

export const ProductionRunLogger: React.FC = () => {
  const { user, organization } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [producedQty, setProducedQty] = useState('');
  const [damagedQty, setDamagedQty] = useState('0');
  const [line, setLine] = useState('Line 1');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!organization) return;
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('org_id', organization.id)
        .order('name', { ascending: true });

      if (data) {
        setProducts(data as Product[]);
        if (data.length > 0) setProductId(data[0].id);
      }
    };
    fetchProducts();
  }, [organization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !productId) return;

    setLoading(true);
    setMessage(null);

    try {
      const batchNum = `WTR-${Date.now().toString().slice(-6)}`;
      const prodQtyNum = parseInt(producedQty, 10);
      const damQtyNum = parseInt(damagedQty, 10) || 0;
      const netUsableQty = prodQtyNum - damQtyNum;

      // 1. Insert Production Log Entry
      const { error: prodErr } = await supabase.from('water_production_runs').insert({
        org_id: organization.id,
        batch_number: batchNum,
        product_id: productId,
        quantity_produced: prodQtyNum,
        quantity_rejected_damaged: damQtyNum,
        production_line: line,
        operator_id: user?.id,
        notes: notes || null,
      });

      if (prodErr) throw prodErr;

      // 2. Fetch current stock to increment usable inventory
      const { data: prodData } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single();

      if (prodData) {
        await supabase
          .from('products')
          .update({ stock_quantity: prodData.stock_quantity + netUsableQty })
          .eq('id', productId);
      }

      // 3. Log Damaged Goods if any
      if (damQtyNum > 0) {
        await supabase.from('water_container_damages_ledger').insert({
          org_id: organization.id,
          product_id: productId,
          item_type: 'damaged_sachet',
          quantity: damQtyNum,
          action_type: 'written_off_damage',
          notes: `Factory production defect - Batch ${batchNum}`,
        });
      }

      setMessage(`Logged batch ${batchNum}: Added ${netUsableQty} usable units to inventory.`);
      setProducedQty('');
      setDamagedQty('0');
      setNotes('');
    } catch (err: any) {
      alert(`Error logging batch: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-6">
        <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
          <Droplet className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Log Water Production Batch</h2>
          <p className="text-xs text-slate-400">Record sachet bags, bottled water, or dispenser runs</p>
        </div>
      </div>

      {message && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-950/80 border border-emerald-500/50 p-4 text-xs font-semibold text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
            Water Product
          </label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (Stock: {p.stock_quantity})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Total Units Produced
            </label>
            <input
              type="number"
              required
              min="1"
              value={producedQty}
              onChange={(e) => setProducedQty(e.target.value)}
              placeholder="e.g. 500 Bags"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Damaged / Burst Units
            </label>
            <input
              type="number"
              min="0"
              value={damagedQty}
              onChange={(e) => setDamagedQty(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
            Packaging Line / Machine No.
          </label>
          <input
            type="text"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            placeholder="Line 1 / Sachet Machine B"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
            Production Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Roll film changed at 10:30 AM..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-cyan-600 py-3 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors shadow-lg"
        >
          {loading ? 'Processing Batch...' : 'Confirm & Add to Inventory'}
        </button>
      </form>
    </div>
  );
};