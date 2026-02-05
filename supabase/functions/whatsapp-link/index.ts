import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1?target=deno';
import { createErrorResponse } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type LinkRequest = {
  companyId?: string | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json().catch(() => ({} as LinkRequest));
    const companyId = typeof payload?.companyId === 'string' ? payload.companyId : null;

    if (companyId) {
      const { data: membership, error: membershipError } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('company_id', companyId)
        .eq('profile_id', user.id)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) {
        return new Response(JSON.stringify({ error: 'Company access denied' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: existing } = await supabase
      .from('whatsapp_links')
      .select('id')
      .eq('profile_id', user.id)
      .is('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from('whatsapp_links')
        .update({
          status: 'pending',
          pairing_code: code,
          pairing_expires_at: expiresAt,
          phone: null,
          verified_at: null,
        })
        .eq('id', existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('whatsapp_links')
        .insert({
          profile_id: user.id,
          company_id: companyId,
          status: 'pending',
          pairing_code: code,
          pairing_expires_at: expiresAt,
        });

      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ code, expiresAt }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createErrorResponse(error, corsHeaders);
  }
});

function generatePairingCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
