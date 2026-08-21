import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { supabase } from '../lib/supabase';

interface Workspace { id: string; name: string; industry_type: string; subscription_status: string; trial_ends_at: string; }

export const DeveloperPortal = () => {
  const { user } = useAuth();
  const [key, setKey] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [fee, setFee] = useState('50');
  const [days, setDays] = useState('30');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invoke = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    const { data, error: invokeError } = await supabase.functions.invoke('developer-subscriptions', { headers: { 'x-developer-key': key }, body: { action, ...body } });
    if (invokeError || data?.error) throw new Error(data?.error || invokeError?.message || 'Developer action failed');
    return data;
  }, [key]);

  const load = useCallback(async () => { try { const result = await invoke('list'); setWorkspaces(result.data ?? []); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Developer authorization failed'); } }, [invoke]);
  useEffect(() => { if (user?.user_metadata?.developer === true) void load(); }, [load, user]);

  const action = async (type: string) => { try { setError(null); setMessage(null); await invoke(type, { orgId: selectedId, fee: Number(fee), days: Number(days) }); setMessage(`Workspace ${type.replace('_', ' ')} completed.`); await load(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Developer action failed'); } };

  if (!user || user.user_metadata?.developer !== true) return <main className="developer-page"><div className="developer-card"><h1>Developer access required</h1><p>This portal is restricted to the service developer account.</p><Link className="policy-link" to="/login">Return to sign in</Link></div></main>;

  return <main className="developer-page"><div className="developer-card"><span className="eyebrow">Restricted operator console</span><h1>Workspace subscriptions</h1><p>Developer authorization is verified server-side. Never place the developer key in source control.</p><label>Developer portal key<input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Enter server-issued key" /></label><button className="primary-button" onClick={() => void load()}>Load workspaces</button>{error && <p className="form-error">{error}</p>}{message && <p className="success-message">{message}</p>}<label>Workspace<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select workspace</option>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.industry_type}</option>)}</select></label><div className="form-two-column"><label>Fee (GHS)<input type="number" min="0" value={fee} onChange={(event) => setFee(event.target.value)} /></label><label>Days<input type="number" min="1" value={days} onChange={(event) => setDays(event.target.value)} /></label></div><div className="developer-actions"><button className="primary-button" disabled={!selectedId} onClick={() => void action('set_fee')}>Set fee</button><button className="primary-button" disabled={!selectedId} onClick={() => void action('activate')}>Activate</button><button className="secondary-button" disabled={!selectedId} onClick={() => void action('cancel')}>Cancel plan</button></div><Link className="policy-link" to="/terms">Read terms and policy</Link></div></main>;
};
