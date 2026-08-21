import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('Authorization required');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user?.email_confirmed_at) throw new Error('Verified authenticated user required');

    const { data: profile, error: profileError } = await client.from('profiles').select('id, org_id, role').eq('id', user.id).eq('is_active', true).single();
    if (profileError || !profile || !['owner', 'admin'].includes(profile.role)) throw new Error('Only workspace owners or admins can subscribe');

    const body = await request.json();
    const provider = body.provider === 'hubtel' ? 'hubtel' : 'paystack';
    const amount = Number(body.amount ?? 50);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid subscription amount');
    const reference = `${provider.toUpperCase()}-${profile.org_id}-${crypto.randomUUID()}`;
    const callbackUrl = body.callbackUrl || `${new URL(request.url).origin}/dashboard`;

    if (provider === 'paystack') {
      const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
      if (!secret) throw new Error('Paystack is not configured');
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, amount: Math.round(amount * 100), currency: 'GHS', reference, callback_url: callbackUrl, metadata: { org_id: profile.org_id, user_id: user.id, plan: body.plan || 'standard' } }),
      });
      const result = await response.json();
      if (!response.ok || !result.status) throw new Error(result.message || 'Paystack initialization failed');
      const { error: paymentError } = await admin.from('payment_transactions').insert({ org_id: profile.org_id, provider, reference, amount, currency: 'GHS', plan: body.plan || 'standard', status: 'pending', metadata: result.data });
      if (paymentError) throw paymentError;
      return new Response(JSON.stringify({ provider, reference, authorizationUrl: result.data.authorization_url, accessCode: result.data.access_code }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const hubtelClientId = Deno.env.get('HUBTEL_CLIENT_ID');
    const hubtelClientSecret = Deno.env.get('HUBTEL_CLIENT_SECRET');
    const merchantAccount = Deno.env.get('HUBTEL_MERCHANT_ACCOUNT');
    if (!hubtelClientId || !hubtelClientSecret || !merchantAccount) throw new Error('Hubtel is not configured');
    const credentials = btoa(`${hubtelClientId}:${hubtelClientSecret}`);
    const response = await fetch('https://payproxyapi.hubtel.com/items/initiate', {
      method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalAmount: amount, description: 'Core ERP workspace subscription', callbackUrl: `${Deno.env.get('SUPABASE_FUNCTIONS_URL')}/payment-webhook/hubtel`, returnUrl: callbackUrl, merchantAccountNumber: merchantAccount, clientReference: reference, customerEmail: user.email, metadata: { org_id: profile.org_id, user_id: user.id } }),
    });
    const result = await response.json();
    if (!response.ok || result.ResponseCode !== '0000') throw new Error(result.Message || 'Hubtel initialization failed');
    const { error: paymentError } = await admin.from('payment_transactions').insert({ org_id: profile.org_id, provider, reference, amount, currency: 'GHS', plan: body.plan || 'standard', status: 'pending', metadata: result });
    if (paymentError) throw paymentError;
    return new Response(JSON.stringify({ provider, reference, checkoutUrl: result.Data?.CheckoutUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Checkout initialization failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
