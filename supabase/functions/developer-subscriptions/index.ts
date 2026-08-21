import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const authHeader = request.headers.get('Authorization');
    const developerKey = request.headers.get('x-developer-key');
    if (!authHeader || !developerKey || developerKey !== Deno.env.get('DEVELOPER_PORTAL_KEY')) throw new Error('Developer authorization required');
    const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    const allowedIds = (Deno.env.get('DEVELOPER_USER_IDS') ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    if (userError || !user || !allowedIds.includes(user.id)) throw new Error('Developer account not authorized');
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const body = await request.json();
    const action = body.action;
    const orgId = String(body.orgId || '');
    if (action === 'list') {
      const { data, error } = await admin.from('organizations').select('id, name, industry_type, subscription_status, trial_started_at, trial_ends_at').order('created_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ data }), { headers });
    }
    if (!orgId) throw new Error('Workspace is required');
    if (action === 'set_fee') {
      const { data, error } = await admin.from('workspace_subscription_plans').upsert({ org_id: orgId, monthly_fee: Number(body.fee), plan_name: body.planName || 'standard', updated_by: user.id }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ data }), { headers });
    }
    if (action === 'activate') {
      const endsAt = new Date(Date.now() + Number(body.days || 30) * 86400000).toISOString();
      const { error } = await admin.from('workspace_subscriptions').insert({ org_id: orgId, provider: 'developer', provider_reference: `DEV-${crypto.randomUUID()}`, key_fingerprint: `developer:${orgId}:${Date.now()}`, plan: body.planName || 'standard', starts_at: new Date().toISOString(), ends_at: endsAt, status: 'active', created_by: user.id });
      if (error) throw error;
      await admin.from('organizations').update({ subscription_status: 'active' }).eq('id', orgId);
      return new Response(JSON.stringify({ activated: true, endsAt }), { headers });
    }
    if (action === 'cancel') {
      await admin.from('workspace_subscriptions').update({ status: 'revoked' }).eq('org_id', orgId).eq('status', 'active');
      await admin.from('organizations').update({ subscription_status: 'suspended' }).eq('id', orgId);
      return new Response(JSON.stringify({ cancelled: true }), { headers });
    }
    throw new Error('Unsupported developer action');
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Developer action failed' }), { status: 400, headers });
  }
});
