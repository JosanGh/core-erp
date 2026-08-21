import { useEffect, useMemo, useState } from 'react';
import { Banknote, CheckCircle2, Cloud, CloudOff, RefreshCw, Search, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../lib/auditLogger';

interface Account { id: string; org_id: string; account_number: string; customer_name: string; phone?: string; balance: number; }
interface Loan { id: string; account_id: string; loan_number: string; total_repayment_amount: number; amount_paid: number; due_date: string; status: string; }
interface PendingEntry { id: string; org_id: string; account_id: string; collector_id: string; loan_id?: string; type: 'deposit' | 'loan_repayment'; amount: number; recorded_at: string; synced: boolean; }
const LOCAL_ACCOUNTS_KEY = 'core-erp-susu-accounts';
const LOCAL_LOANS_KEY = 'core-erp-susu-loans';
const LOCAL_QUEUE_KEY = 'core-erp-susu-offline-queue';

export const SusuCollectorOperations = () => {
  const { user, profile, organization } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [queue, setQueue] = useState<PendingEntry[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Account | null>(null);
  const [amount, setAmount] = useState('');
  const [entryType, setEntryType] = useState<'deposit' | 'loan_repayment'>('deposit');
  const [selectedLoan, setSelectedLoan] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!organization) return;
    setError(null);
    if (isSupabaseConfigured) {
      const [{ data: accountData, error: accountError }, { data: loanData, error: loanError }] = await Promise.all([
        supabase.from('susu_accounts').select('id, org_id, account_number, customer_name, phone, balance').eq('org_id', organization.id).order('customer_name'),
        supabase.from('susu_loans').select('*').eq('org_id', organization.id).eq('status', 'active').order('due_date'),
      ]);
      if (accountError || loanError) setError(accountError?.message || loanError?.message || 'Unable to load susu accounts');
      setAccounts((accountData as Account[]) ?? []);
      setLoans((loanData as Loan[]) ?? []);
    } else {
      const localAccounts = JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) || '[]') as Account[];
      const localLoans = JSON.parse(localStorage.getItem(LOCAL_LOANS_KEY) || '[]') as Loan[];
      setAccounts(localAccounts.filter((account) => account.org_id === organization.id));
      setLoans(localLoans.filter((loan) => loan.status === 'active'));
    }
    const localQueue = JSON.parse(localStorage.getItem(LOCAL_QUEUE_KEY) || '[]') as PendingEntry[];
    setQueue(localQueue.filter((entry) => entry.org_id === organization.id && !entry.synced));
  };

  // Account loading is intentionally refreshed when the active tenant changes.
  useEffect(() => {
    void loadData();
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization]);

  const accountLoans = useMemo(() => selected ? loans.filter((loan) => loan.account_id === selected.id) : [], [loans, selected]);
  const filtered = accounts.filter((account) => `${account.customer_name} ${account.account_number} ${account.phone ?? ''}`.toLowerCase().includes(search.toLowerCase()));

  const persistQueue = (entries: PendingEntry[]) => {
    const all = JSON.parse(localStorage.getItem(LOCAL_QUEUE_KEY) || '[]') as PendingEntry[];
    const otherTenant = all.filter((entry) => entry.org_id !== organization?.id);
    localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify([...otherTenant, ...entries]));
    setQueue(entries.filter((entry) => !entry.synced));
  };

  const syncQueue = async () => {
    if (!isSupabaseConfigured || !online || !user || !organization) return;
    const all = JSON.parse(localStorage.getItem(LOCAL_QUEUE_KEY) || '[]') as PendingEntry[];
    const pending = all.filter((entry) => entry.org_id === organization.id && !entry.synced);
    for (const entry of pending) {
      const { error: insertError } = await supabase.rpc('record_susu_transaction', { p_id: entry.id, p_org_id: entry.org_id, p_account_id: entry.account_id, p_collector_id: entry.collector_id, p_transaction_type: entry.type, p_amount: entry.amount, p_loan_id: entry.loan_id ?? null, p_client_recorded_at: entry.recorded_at });
      if (!insertError) entry.synced = true;
    }
    localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(all));
    setQueue(pending.filter((entry) => !entry.synced));
  };

  const recordCollection = async () => {
    if (!selected || !user || !organization || Number(amount) <= 0) return;
    const value = Number(amount);
    const entry: PendingEntry = { id: crypto.randomUUID(), org_id: organization.id, account_id: selected.id, collector_id: user.id, loan_id: selectedLoan || undefined, type: entryType, amount: value, recorded_at: new Date().toISOString(), synced: false };
    const nextAccounts = accounts.map((account) => account.id === selected.id ? { ...account, balance: account.balance + value } : account);
    setAccounts(nextAccounts);
    if (!isSupabaseConfigured) localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(nextAccounts));
    if (!isSupabaseConfigured && entryType === 'loan_repayment' && selectedLoan) {
      const localLoans = JSON.parse(localStorage.getItem(LOCAL_LOANS_KEY) || '[]') as Loan[];
      localStorage.setItem(LOCAL_LOANS_KEY, JSON.stringify(localLoans.map((loan) => loan.id === selectedLoan ? { ...loan, amount_paid: loan.amount_paid + value, status: loan.amount_paid + value >= loan.total_repayment_amount ? 'fully_paid' : 'active' } : loan)));
    }
    const all = JSON.parse(localStorage.getItem(LOCAL_QUEUE_KEY) || '[]') as PendingEntry[];
    persistQueue([...all.filter((item) => item.org_id !== organization.id), entry, ...all.filter((item) => item.org_id === organization.id)]);
    if (isSupabaseConfigured && online) await syncQueue();
    await logAuditEvent({ orgId: organization.id, module: 'susu', action: entryType === 'deposit' ? 'SUSU_COLLECTION_RECORDED' : 'LOAN_REPAYMENT_RECORDED', targetResource: selected.account_number, details: { amount: value, offline: !online || !isSupabaseConfigured }, actorId: user.id, actorEmail: user.email ?? undefined, actorRole: profile?.role });
    setMessage(`${entryType === 'deposit' ? 'Collection' : 'Loan repayment'} of GHS ${value.toFixed(2)} recorded${!online ? ' offline' : ''}.`);
    setSelected(null); setAmount(''); setSelectedLoan('');
  };

  return <section className="workspace-content susu-field"><div className="section-heading"><div><span className="eyebrow">Field collections</span><h2>Susu collector</h2><p>Record susu contributions and loan repayments while offline. Entries sync when connectivity returns.</p></div><div className={`connection-status ${online ? 'connected' : 'disconnected'}`}>{online ? <Wifi size={15} /> : <WifiOff size={15} />}{online ? 'Online' : 'Offline'} · {queue.length} queued</div></div><div className="collector-banner"><div className="collector-banner-icon">{online ? <Cloud size={20} /> : <CloudOff size={20} />}</div><div><strong>{online ? 'Connected to workspace' : 'Offline collection mode'}</strong><span>{online ? 'New entries will sync immediately.' : 'Entries are safely queued on this device.'}</span></div><button onClick={() => void syncQueue()}><RefreshCw size={15} /> Sync now</button></div><div className="school-toolbar"><div className="school-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, account, or phone" /></div></div>{message && <p className="success-message">{message}</p>}{error && <p className="form-error">{error}</p>}<div className="collector-list">{filtered.length === 0 ? <div className="empty-state"><Banknote size={25} /><strong>No assigned accounts</strong><p>Accounts assigned to this collector will appear here.</p></div> : filtered.map((account) => <button className="collector-account" key={account.id} onClick={() => { setSelected(account); setAmount(''); setMessage(null); }}><div><strong>{account.customer_name}</strong><span>{account.account_number} · {account.phone || 'No phone'}</span></div><b>GHS {Number(account.balance).toFixed(2)}</b></button>)}</div>{selected && <div className="modal-backdrop"><div className="dialog collector-dialog"><div className="dialog-header"><div><span className="eyebrow">Field transaction</span><h2>{selected.customer_name}</h2></div><button onClick={() => setSelected(null)} aria-label="Close dialog">×</button></div><p className="dialog-copy">Current savings balance: GHS {Number(selected.balance).toFixed(2)}</p><div className="transaction-tabs"><button className={entryType === 'deposit' ? 'selected' : ''} onClick={() => setEntryType('deposit')}>Susu collection</button><button className={entryType === 'loan_repayment' ? 'selected' : ''} onClick={() => setEntryType('loan_repayment')}>Loan repayment</button></div>{entryType === 'loan_repayment' && <label>Loan<select value={selectedLoan} onChange={(event) => setSelectedLoan(event.target.value)}><option value="">Select active loan</option>{accountLoans.map((loan) => <option key={loan.id} value={loan.id}>{loan.loan_number} · GHS {(loan.total_repayment_amount - loan.amount_paid).toFixed(2)} due</option>)}</select></label>}<label>Amount received (GHS)<input className="collector-amount" type="number" min="0.5" step="0.5" autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="20.00" /></label><button className="primary-button" disabled={!amount || (entryType === 'loan_repayment' && !selectedLoan)} onClick={() => void recordCollection()}><CheckCircle2 size={16} /> Confirm transaction</button></div></div>}</section>;
};
