import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { MicrofinanceLoan, LoanScheduleItem } from '../../types/susu';
import { BadgePercent, Calendar, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';

export const LoanScheduleTracker: React.FC<{ loanId: string }> = ({ loanId }) => {
  const [loan, setLoan] = useState<MicrofinanceLoan | null>(null);
  const [schedules, setSchedules] = useState<LoanScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoanDetails = async () => {
      setLoading(true);
      const { data: loanData } = await supabase
        .from('microfinance_loans')
        .select('*, account:susu_accounts(*)')
        .eq('id', loanId)
        .single();

      const { data: scheduleData } = await supabase
        .from('microfinance_loan_schedules')
        .select('*')
        .eq('loan_id', loanId)
        .order('due_date', { ascending: true });

      if (loanData) setLoan(loanData as MicrofinanceLoan);
      if (scheduleData) setSchedules(scheduleData as LoanScheduleItem[]);
      setLoading(false);
    };

    if (loanId) fetchLoanDetails();
  }, [loanId]);

  if (loading) {
    return <div className="p-6 text-center text-xs text-slate-400">Loading loan schedule...</div>;
  }

  if (!loan) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-xl">
      {/* Summary Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 mb-6 gap-4">
        <div>
          <span className="text-xs font-mono text-emerald-400">{loan.loan_number}</span>
          <h3 className="text-lg font-bold text-white">{loan.account?.customer_name}</h3>
          <p className="text-xs text-slate-400">Phone: {loan.account?.customer_phone}</p>
        </div>

        <div className="flex gap-4 text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block">Principal</span>
            <span className="font-bold text-white text-sm">GHS {Number(loan.principal_amount).toFixed(2)}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block">Interest ({loan.interest_rate_percentage}%)</span>
            <span className="font-bold text-amber-400 text-sm">
              GHS {(Number(loan.total_repayment_amount) - Number(loan.principal_amount)).toFixed(2)}
            </span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block">Paid Balance</span>
            <span className="font-bold text-emerald-400 text-sm">
              GHS {Number(loan.amount_paid).toFixed(2)} / {Number(loan.total_repayment_amount).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Schedule Table */}
      <h4 className="text-xs font-semibold uppercase text-slate-400 mb-3">Repayment Schedule Breakdown</h4>
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase">
            <tr>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Expected</th>
              <th className="px-4 py-3">Amount Paid</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {schedules.map((item) => (
              <tr key={item.id} className="hover:bg-slate-900/50">
                <td className="px-4 py-3 font-mono">{new Date(item.due_date).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-semibold text-white">GHS {Number(item.expected_amount).toFixed(2)}</td>
                <td className="px-4 py-3 font-semibold text-emerald-400">GHS {Number(item.paid_amount).toFixed(2)}</td>
                <td className="px-4 py-3">
                  {item.status === 'paid' ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-950 px-2 py-0.5 font-bold text-emerald-400 border border-emerald-800">
                      <CheckCircle2 className="h-3 w-3" /> Paid
                    </span>
                  ) : item.status === 'overdue' ? (
                    <span className="inline-flex items-center gap-1 rounded bg-red-950 px-2 py-0.5 font-bold text-red-400 border border-red-800">
                      <AlertCircle className="h-3 w-3" /> Overdue
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-950 px-2 py-0.5 font-bold text-amber-400 border border-amber-800">
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};