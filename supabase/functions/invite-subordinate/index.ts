import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('Authorization required');

    const projectUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(projectUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(projectUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error('Authenticated user not found');

    const { data: requester, error: requesterError } = await adminClient
      .from('profiles')
      .select('id, org_id, email, role')
      .eq('id', user.id)
      .single();
    if (requesterError || !requester || !['owner', 'admin'].includes(requester.role)) {
      throw new Error('Only owners and admins can invite subordinates');
    }

    const body = await request.json();
    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || 'manager');
    const allowedRoles = ['admin', 'manager', 'front_desk', 'sales_person', 'cashier', 'pharmacist', 'doctor', 'teacher', 'collector', 'driver'];
    if (!fullName || !email || !allowedRoles.includes(role)) throw new Error('Name, email, and a valid role are required');

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, org_id: requester.org_id, role },
    });
    if (inviteError || !invited.user) throw inviteError || new Error('Invitation failed');

    await adminClient.from('audit_logs').insert({
      org_id: requester.org_id,
      actor_id: requester.id,
      actor_email: requester.email,
      actor_role: requester.role,
      module: 'admin',
      action: 'SUBORDINATE_INVITED',
      target_resource: email,
      details: { role, invited_user_id: invited.user.id },
    });

    return new Response(JSON.stringify({ success: true, userId: invited.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Invitation failed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

