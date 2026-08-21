import { useState } from 'react';
import PaystackPop from '@paystack/inline-js';
import { supabase } from '../lib/supabase';

interface CheckoutProps { userEmail?: string; userId?: string; earlyPayment?: boolean; }

export default function SubscriptionCheckout({ userEmail, earlyPayment = false }: CheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const verifyPayment = async (provider: 'paystack' | 'hubtel', reference: string) => {
    const { data, error: verificationError } = await supabase.functions.invoke('verify-payment', { body: { provider, reference } });
    if (verificationError || !data?.verified) throw new Error(data?.error || verificationError?.message || 'Payment verification failed');
    setMessage('Payment verified. Your workspace subscription is active.');
    window.location.reload();
  };

  const initializeCheckout = async (provider: 'paystack' | 'hubtel') => {
    setLoading(true); setError(null); setMessage(null);
    try {
      const { data, error: checkoutError } = await supabase.functions.invoke('subscription-checkout', { body: { provider, amount: 50, plan: 'standard', callbackUrl: `${window.location.origin}/dashboard` } });
      if (checkoutError || data?.error) throw new Error(data?.error || checkoutError?.message || 'Unable to initialize payment');
      if (provider === 'hubtel') {
        if (!data.checkoutUrl) throw new Error('Hubtel did not return a checkout URL');
        window.location.assign(data.checkoutUrl);
        return;
      }
      const paystack = new PaystackPop();
      paystack.newTransaction({ key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY, email: userEmail ?? '', amount: 5000, currency: 'GHS', ref: data.reference, onSuccess: async (transaction: { reference: string }) => { try { await verifyPayment('paystack', transaction.reference); } catch (verificationError) { setError(verificationError instanceof Error ? verificationError.message : 'Verification failed'); } finally { setLoading(false); } }, onCancel: () => { setLoading(false); setError('Payment was cancelled.'); } });
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to initialize payment'); setLoading(false);
    }
  };

  return <div className="subscription-checkout"><h3>{earlyPayment ? 'Activate workspace subscription' : 'Workspace subscription required'}</h3><p>{earlyPayment ? 'Pay securely before your 15-day trial ends.' : 'Your trial has ended. Activate this registered workspace with Paystack or Hubtel.'}</p>{error && <p className="form-error">{error}</p>}{message && <p className="success-message">{message}</p>}<button className="primary-button" onClick={() => void initializeCheckout('paystack')} disabled={loading}>{loading ? 'Processing...' : 'Pay with Paystack'}</button><button className="secondary-button" onClick={() => void initializeCheckout('hubtel')} disabled={loading}>Pay with Hubtel</button></div>;
}
