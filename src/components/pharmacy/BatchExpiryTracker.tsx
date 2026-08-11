import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Product } from '../../types/inventory';
import type { InventoryBatch, DrugMetadata } from '../../types/pharmacy';
import { Pill, AlertTriangle, Clock, ShieldAlert, Plus, Calendar } from 'lucide-react';

interface BatchWithProduct extends InventoryBatch {
  product?: Product;
}

export const BatchExpiryTracker: React.FC = () => {
  const [batches, setBatches] = useState<BatchWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'expiring' | 'expired'>('all');

  const fetchBatches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_batches')
      .select('*, product:products(*)')
      .gt('quantity_remaining', 0)
      .order('expiry_date', { ascending: true });

    if (!error && data) {
      setBatches(data as BatchWithProduct[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const getDaysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const filteredBatches = batches.filter((batch) => {
    const days = getDaysUntilExpiry(batch.expiry_date);
    if (filter === 'expired') return days <= 0;
    if (filter === 'expiring') return days > 0 && days <= 60;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Pill className="h-6 w-6 text-emerald-400" />
            Pharmacy Batch & Expiration Tracker
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            FIFO Inventory Dispatch & Active Expiry Alerts
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Batches ({batches.length})
          </button>
          <button
            onClick={() => setFilter('expiring')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'expiring' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Expiring &lt; 60 Days
          </button>
          <button
            onClick={() => setFilter('expired')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'expired' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Expired
          </button>
        </div>
      </div>

      {/* Batches Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Drug Name</th>
                <th className="px-4 py-3">Active Ingredient</th>
                <th className="px-4 py-3">Batch No</th>
                <th className="px-4 py-3">Stock Left</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredBatches.map((batch) => {
                const daysLeft = getDaysUntilExpiry(batch.expiry_date);
                const metadata = (batch.product?.metadata as DrugMetadata) || {};

                return (
                  <tr key={batch.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-semibold text-white">
                      {batch.product?.name || 'Unknown Drug'}
                      {metadata.prescription_required && (
                        <span className="ml-2 rounded bg-amber-950 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-800">
                          Rx
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {metadata.active_ingredient || 'N/A'} {metadata.strength ? `(${metadata.strength})` : ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-400">{batch.batch_number}</td>
                    <td className="px-4 py-3 font-bold text-white">
                      {batch.quantity_remaining} {batch.product?.unit_of_measure}
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono">
                      {new Date(batch.expiry_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {daysLeft <= 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-950/80 px-2 py-1 text-xs font-bold text-red-400 border border-red-800">
                          <ShieldAlert className="h-3.5 w-3.5" /> EXPIRED
                        </span>
                      ) : daysLeft <= 60 ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-950/80 px-2 py-1 text-xs font-bold text-amber-400 border border-amber-800">
                          <AlertTriangle className="h-3.5 w-3.5" /> {daysLeft} Days Left
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950/80 px-2 py-1 text-xs font-bold text-emerald-400 border border-emerald-800">
                          <Clock className="h-3.5 w-3.5" /> Valid
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};