import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.45.1';
import { buildCorsHeaders, corsOptionsResponse } from '../_shared/cors.ts';
import { createErrorResponse } from '../_shared/validation.ts';

type LinkRequest = {
  companyId?: string | null;
};

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  const jsonResponse = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return corsOptionsResponse(req);
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
    if (!token) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const payload = await req.json().catch(() => ({} as LinkRequest));
    const companyId = typeof payload?.companyId === 'string' ? payload.companyId : null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_type, tenant_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    if (!profile.tenant_id) {
      return jsonResponse({ error: 'Tenant not set' }, 400);
    }

    if (profile.user_type === 'pessoa_juridica' && !companyId) {
      return jsonResponse({ error: 'Company is required for PJ users' }, 400);
    }

    if (companyId) {
      const { data: membership, error: membershipError } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('company_id', companyId)
        .eq('profile_id', user.id)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) {
        return jsonResponse({ error: 'Company access denied' }, 403);
      }
    }

    let existingQuery = supabase
      .from('whatsapp_links')
      .select('id')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    existingQuery = companyId
      ? existingQuery.eq('company_id', companyId)
      : existingQuery.is('company_id', null);

    const { data: existing } = await existingQuery;

    const { code, expiresAt } = await persistPairingCode(
      supabase,
      {
        profileId: user.id,
        companyId,
        existingId: existing?.id ?? null,
      }
    );

    return jsonResponse({ code, expiresAt }, 200);
  } catch (error) {
    const dbCode = (error as any)?.code;
    const dbMessage = (error as any)?.message ?? '';
    if (dbCode === '23514' && /tenant/i.test(dbMessage)) {
      return jsonResponse({ error: 'Tenant validation failed. Check profile/company tenant_id.' }, 400);
    }
    if (dbCode === '23503' && /company/i.test(dbMessage)) {
      return jsonResponse({ error: 'Company not found or invalid.' }, 400);
    }
    return createErrorResponse(error, corsHeaders);
  }
});

function generatePairingCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function persistPairingCode(
  supabase: any,
  params: { profileId: string; companyId: string | null; existingId: string | null }
): Promise<{ code: string; expiresAt: string }> {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    if (params.existingId) {
      const { error } = await supabase
        .from('whatsapp_links')
        .update({
          status: 'pending',
          pairing_code: code,
          pairing_expires_at: expiresAt,
          phone: null,
          verified_at: null,
        })
        .eq('id', params.existingId);

      if (!error) {
        return { code, expiresAt };
      }

      if (error.code !== '23505') {
        throw error;
      }
    } else {
      const { error } = await supabase
        .from('whatsapp_links')
        .insert({
          profile_id: params.profileId,
          company_id: params.companyId,
          status: 'pending',
          pairing_code: code,
          pairing_expires_at: expiresAt,
        });

      if (!error) {
        return { code, expiresAt };
      }

      if (error.code !== '23505') {
        throw error;
      }
    }
  }

  throw new Error('Unable to generate pairing code');
}
