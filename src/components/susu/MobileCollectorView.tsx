import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { SusuAccount } from '../../types/susu';
import { Wallet, Search, CheckCircle, ArrowUpRight, Smartphone, RefreshCw } from 'lucide-react';

export const MobileCollectorView: React.FC = () => {
  const { user, organization } = useAuth();
  const [accounts, setAccounts] = useState<SusuAccount[]>([]);
  const [search, setSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<SusuAccount | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchAssignedAccounts = async () => {
    if (!organization) return;
    setLoading(true);
    const { data } = await supabase
      .from('susu_accounts')
      .select('*')
      .eq('org_id', organization.id)
      .eq('status', 'active')
      .order('customer_name', { ascending: true });

    if (data) setAccounts(data as SusuAccount[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAssignedAccounts();
  }, [organization]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !user || !organization) return;

    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setLoading(true);
    try {
      const newBalance = Number(selectedAccount.current_balance) + amountNum;

      // 1. Insert Ledger Transaction
      const { error: ledgerErr } = await supabase.from('susu_ledger').insert({
        org_id: organization.id,
        account_id: selectedAccount.id,
        collector_id: user.id,
        transaction_type: 'deposit',
        amount: amountNum,
        balance_after: newBalance,
        notes: 'Field mobile collection',
      });

      if (ledgerErr) throw ledgerErr;

      // 2. Update Account Balance
      const { error: accErr } = await supabase
        .from('susu_accounts')
        .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', selectedAccount.id);

      if (accErr) throw accErr;

      setSuccessMsg(`Collected GHS ${amountNum.toFixed(2)} from ${selectedAccount.customer_name}`);
      setSelectedAccount(null);
      setDepositAmount('');
      fetchAssignedAccounts();
    } catch (err: any) {
      alert(`Transaction failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filtered = accounts.filter(
    (a) =>
      a.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      a.account_number.toLowerCase().includes(search.toLowerCase()) ||
      a.customer_phone.includes(search)
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 p-4 text-slate-100 max-w-md mx-auto">
      {/* Field Collector Top Bar */}
      <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
            <Smartphone className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Daily Field Collector</h2>
            <p className="text-xs text-slate-400">Mobile Savings Portal</p>
          </div>
        </div>
        <button
          onClick={fetchAssignedAccounts}
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-950/80 border border-emerald-500/50 p-3 text-xs font-semibold text-emerald-300">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Quick Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search client name, phone, or account..."
          className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* Account List */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {filtered.map((acc) => (
          <div
            key={acc.id}
            onClick={() => {
              setSelectedAccount(acc);
              setDepositAmount(acc.daily_target_amount.toString());
              setSuccessMsg(null);
            }}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              selectedAccount?.id === acc.id
                ? 'bg-emerald-950/40 border-emerald-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-white text-sm">{acc.customer_name}</p>
                <p className="text-xs font-mono text-slate-400">{acc.account_number} • {acc.customer_phone}</p>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-1 rounded-md border border-emerald-800">
                GHS {Number(acc.current_balance).toFixed(2)}
              </span>
            </div>

            <div className="mt-3 flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-800/60">
              <span>Target: GHS {Number(acc.daily_target_amount).toFixed(2)}/day</span>
              <span className="text-emerald-400 flex items-center gap-0.5 font-semibold">
                Collect <ArrowUpRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Deposit Modal / Sheet */}
      {selectedAccount && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              Record Collection
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Client: <span className="text-emerald-400 font-semibold">{selectedAccount.customer_name}</span>
            </p>

            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Amount Received (GHS)
                </label>
                <input
                  type="number"
                  step="0.50"
                  required
                  autoFocus
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full text-center text-2xl font-bold rounded-xl border border-slate-800 bg-slate-950 py-3 text-emerald-400 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedAccount(null)}
                  className="flex-1 py-3 text-xs font-semibold text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};