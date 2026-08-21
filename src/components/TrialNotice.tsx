import { useMemo, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import SubscriptionCheckout from './SubscriptionCheckout';

const REMINDER_DAYS = [0, 4, 8, 12];

export const TrialNotice = () => {
  const { organization, accessState, profile, user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const isAdmin = profile?.role === 'owner' || profile?.role === 'admin';
  const reminder = useMemo(() => {
    if (!organization?.trial_ends_at || accessState !== 'trial' || !isAdmin) return null;
    const endsAt = new Date(organization.trial_ends_at);
    const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 86400000));
    const reminderKey = `core-erp-trial-reminder-${organization.id}-${daysLeft}`;
    const welcomeKey = `core-erp-trial-welcome-${organization.id}`;
    const firstVisit = !localStorage.getItem(welcomeKey);
    const shouldShow = firstVisit || REMINDER_DAYS.includes(daysLeft) || daysLeft <= 2;
    if (!shouldShow || localStorage.getItem(reminderKey)) return null;
    localStorage.setItem(reminderKey, 'shown');
    if (firstVisit) localStorage.setItem(welcomeKey, 'shown');
    return { daysLeft, message: daysLeft === 0 ? 'Your free trial ends today.' : `You have ${daysLeft} days left in your free trial.` };
  }, [accessState, isAdmin, organization]);

  if (dismissed || (!reminder && accessState !== 'expired')) return null;
  if (!isAdmin && accessState !== 'expired') return null;
  return <div className="trial-notice"><div className="trial-notice-icon"><Bell size={16} /></div><div><strong>{accessState === 'expired' ? 'Subscription required' : 'Free trial reminder'}</strong><span>{accessState === 'expired' ? 'Your workspace is blocked until an administrator completes payment.' : reminder?.message}</span></div><div className="trial-notice-actions"><button onClick={() => setShowPayment(true)}>View payment options</button><button className="trial-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss notice"><X size={15} /></button></div>{showPayment && <div className="trial-payment"><SubscriptionCheckout userEmail={user?.email ?? undefined} /><button onClick={() => setShowPayment(false)}>Close</button></div>}</div>;
};
