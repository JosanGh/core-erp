import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json' };
const encoder = new TextEncoder();

async function hmacSha512(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request: Request) => {
  const rawBody = await request.text();
  const url = new URL(request.url);
  const provider = url.pathname.endsWith('/hubtel') ? 'hubtel' : 'paystack';
  try {
    if (provider === 'paystack') {
      const expected = await hmacSha512(Deno.env.get('PAYSTACK_SECRET_KEY') ?? '', rawBody);
      if (request.headers.get('x-paystack-signature') !== expected) return new Response('Unauthorized', { status: 401 });
    } else {
      const expected = Deno.env.get('HUBTEL_WEBHOOK_SECRET');
      if (!expected || request.headers.get('Authorization') !== `Basic ${expected}`) return new Response('Unauthorized', { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const reference = provider === 'paystack' ? body.data?.reference : body.Data?.ClientReference;
    const paid = provider === 'paystack' ? body.event === 'charge.success' && body.data?.status === 'success' : body.Data?.Status === 'Success' || body.ResponseCode === '0000';
    if (!reference || !paid) return new Response(JSON.stringify({ received: true }), { headers: jsonHeaders });

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: payment, error: paymentError } = await admin.from('payment_transactions').select('*').eq('provider', provider).eq('reference', reference).single();
    if (paymentError || !payment) return new Response('Payment reference not found', { status: 404 });
    if (payment.status === 'paid') return new Response(JSON.stringify({ received: true, duplicate: true }), { headers: jsonHeaders });

    const { error: updateError } = await admin.from('payment_transactions').update({ status: 'paid', paid_at: new Date().toISOString(), provider_payload: body }).eq('id', payment.id).eq('status', 'pending');
    if (updateError) throw updateError;
    const { error: subscriptionError } = await admin.from('workspace_subscriptions').insert({ org_id: payment.org_id, provider, provider_reference: reference, key_fingerprint: `${provider}:${reference}`, plan: payment.plan ?? 'standard', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + Number(Deno.env.get('SUBSCRIPTION_DURATION_DAYS') ?? 30) * 86400000).toISOString(), status: 'active' });
    if (subscriptionError && subscriptionError.code !== '23505') throw subscriptionError;
    await admin.from('organizations').update({ subscription_status: 'active' }).eq('id', payment.org_id);
    return new Response(JSON.stringify({ received: true }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Webhook processing failed' }), { status: 500, headers: jsonHeaders });
  }
});
