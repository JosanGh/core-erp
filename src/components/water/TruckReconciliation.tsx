import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { WaterDispatch } from '../../types/water';
import { Truck, CheckSquare, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';

export const TruckReconciliation: React.FC = () => {
  const [dispatches, setDispatches] = useState<WaterDispatch[]>([]);
  const [selectedDispatch, setSelectedDispatch] = useState<WaterDispatch | null>(null);
  const [soldQty, setSoldQty] = useState<number>(0);
  const [returnedQty, setReturnedQty] = useState<number>(0);
  const [damagedQty, setDamagedQty] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchActiveDispatches = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('water_dispatches')
      .select('*, items:water_dispatch_items(*, product:products(*))')
      .eq('status', 'out_for_delivery')
      .order('created_at', { ascending: false });

    if (data) setDispatches(data as WaterDispatch[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchActiveDispatches();
  }, []);

  const handleReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispatch) return;

    const totalLoaded = selectedDispatch.total_loaded_qty;
    if (soldQty + returnedQty + damagedQty !== totalLoaded) {
      alert(`Mismatch! Sold (${soldQty}) + Returned (${returnedQty}) + Damaged (${damagedQty}) must equal Loaded (${totalLoaded}).`);
      return;
    }

    setLoading(true);
    try {
      // 1. Mark Dispatch as Reconciled
      const { error: dispErr } = await supabase
        .from('water_dispatches')
        .update({
          status: 'reconciled',
          total_sold_qty: soldQty,
          total_returned_qty: returnedQty,
          total_damaged_qty: damagedQty,
          reconciled_at: new Date().toISOString(),
        })
        .eq('id', selectedDispatch.id);

      if (dispErr) throw dispErr;

      // 2. Return unsold stock back to inventory
      if (returnedQty > 0 && selectedDispatch.items && selectedDispatch.items.length > 0) {
        const item = selectedDispatch.items[0];
        const { data: prodData } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single();

        if (prodData) {
          await supabase
            .from('products')
            .update({ stock_quantity: prodData.stock_quantity + returnedQty })
            .eq('id', item.product_id);
        }
      }

      // 3. Log Damaged Stock from Delivery Route
      if (damagedQty > 0 && selectedDispatch.items && selectedDispatch.items.length > 0) {
        await supabase.from('water_container_damages_ledger').insert({
          org_id: selectedDispatch.org_id,
          dispatch_id: selectedDispatch.id,
          product_id: selectedDispatch.items[0].product_id,
          item_type: 'damaged_sachet',
          quantity: damagedQty,
          action_type: 'written_off_damage',
          notes: `Delivery route loss - Dispatch ${selectedDispatch.dispatch_number}`,
        });
      }

      alert('Truck trip reconciled successfully.');
      setSelectedDispatch(null);
      fetchActiveDispatches();
    } catch (err: any) {
      alert(`Reconciliation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="h-6 w-6 text-cyan-400" />
            Route Delivery & Truck Reconciliation
          </h2>
          <p className="text-xs text-slate-400 mt-1">Reconcile driver stock, sales, and damaged returns</p>
        </div>
        <button
          onClick={fetchActiveDispatches}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Dispatches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dispatches.map((dispatch) => (
          <div
            key={dispatch.id}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-mono text-cyan-400 font-bold">{dispatch.dispatch_number}</span>
                <span className="rounded-md bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-800">
                  Out for Delivery
                </span>
              </div>
              <p className="text-sm font-bold text-white mb-1">Vehicle: {dispatch.vehicle_registration}</p>
              <p className="text-xs text-slate-400">Total Loaded Stock: <strong className="text-white">{dispatch.total_loaded_qty} units</strong></p>
            </div>

            <button
              onClick={() => {
                setSelectedDispatch(dispatch);
                setSoldQty(dispatch.total_loaded_qty);
                setReturnedQty(0);
                setDamagedQty(0);
              }}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-600 py-2.5 text-xs font-bold text-white hover:bg-cyan-500"
            >
              Reconcile Trip <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Modal Reconcile Sheet */}
      {selectedDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">
              Reconcile Truck {selectedDispatch.vehicle_registration}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Total Stock Loaded: <span className="font-bold text-cyan-400">{selectedDispatch.total_loaded_qty} units</span>
            </p>

            <form onSubmit={handleReconcile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Units Sold & Paid
                </label>
                <input
                  type="number"
                  min="0"
                  max={selectedDispatch.total_loaded_qty}
                  value={soldQty}
                  onChange={(e) => setSoldQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-emerald-400 font-bold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Returned Intact
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={returnedQty}
                    onChange={(e) => setReturnedQty(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Damaged / Burst
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={damagedQty}
                    onChange={(e) => setDamagedQty(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-red-400 font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedDispatch(null)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Finalize Trip Reconciliation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};