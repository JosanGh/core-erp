import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('Authorization required');
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user?.email_confirmed_at) throw new Error('Verified authenticated user required');
    const { data: profile, error: profileError } = await client.from('profiles').select('org_id, role').eq('id', user.id).eq('is_active', true).single();
    if (profileError || !profile || !['owner', 'admin'].includes(profile.role)) throw new Error('Only workspace owners or admins can verify payments');
    const { provider, reference } = await request.json();
    if (!['paystack', 'hubtel'].includes(provider) || !reference) throw new Error('Provider and reference are required');
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: payment } = await admin.from('payment_transactions').select('*').eq('org_id', profile.org_id).eq('provider', provider).eq('reference', reference).single();
    if (!payment) throw new Error('Payment not found for this workspace');
    if (payment.status !== 'paid') {
      if (provider === 'paystack') {
        const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
        const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
        const result = await response.json();
        if (!response.ok || result.data?.status !== 'success') throw new Error('Paystack payment is not successful');
      } else {
        throw new Error('Hubtel payment must be confirmed by its webhook before activation');
      }
      await admin.from('payment_transactions').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', payment.id).eq('status', 'pending');
      const { error: subscriptionError } = await admin.from('workspace_subscriptions').insert({ org_id: profile.org_id, provider, provider_reference: reference, key_fingerprint: `${provider}:${reference}`, plan: payment.plan ?? 'standard', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + Number(Deno.env.get('SUBSCRIPTION_DURATION_DAYS') ?? 30) * 86400000).toISOString(), status: 'active' });
      if (subscriptionError && subscriptionError.code !== '23505') throw subscriptionError;
      await admin.from('organizations').update({ subscription_status: 'active' }).eq('id', profile.org_id);
    }
    return new Response(JSON.stringify({ verified: true, orgId: profile.org_id }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ verified: false, error: error instanceof Error ? error.message : 'Payment verification failed' }), { status: 400, headers });
  }
});
