import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AuthError, requireSupabaseUserId } from '../_shared/auth.ts';
import { buildCorsHeaders, corsOptionsResponse } from '../_shared/cors.ts';
import {
  WhatsAppMessageRequestSchema,
  validateRequest,
  createErrorResponse,
  checkRateLimit,
} from '../_shared/validation.ts';

const token = Deno.env.get('META_WHATSAPP_TOKEN');
const phoneNumberId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID');
const apiVersion = Deno.env.get('META_WHATSAPP_API_VERSION') ?? 'v20.0';

if (!token || !phoneNumberId) {
  console.warn('[WhatsApp] Missing META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_NUMBER_ID environment variables.');
}

type WhatsAppResponse = {
  messages?: Array<{ id: string }>;
  error?: {
    message: string;
    type: string;
    code: number;
    error_user_title?: string;
    error_user_msg?: string;
  };
};

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsOptionsResponse(req);
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authUserId = await requireSupabaseUserId(req);

    if (!token || !phoneNumberId) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp integration is not configured on the server.' }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const payload = await req.json();
    const validatedData = validateRequest(WhatsAppMessageRequestSchema, payload);
    const { userId, to, message, template } = validatedData;
    const type = validatedData.type ?? 'text'; // Ensure type is never undefined

    if (userId !== authUserId) throw new AuthError();

    // Basic per-user throttling to avoid accidental floods
    checkRateLimit(userId, { maxRequests: 20, windowMs: 60_000 });

    // Verify the destination phone belongs to this user's company
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const normalizedTo = to.startsWith('+') ? to : `+${to}`;
      const { data: link } = await supabase
        .from('whatsapp_links')
        .select('id')
        .eq('user_id', userId)
        .eq('phone_e164', normalizedTo)
        .eq('status', 'verified')
        .maybeSingle();

      if (!link) {
        return new Response(
          JSON.stringify({ error: 'Destination phone is not linked to your account.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const requestBody = buildRequestBody({ type, to, message, template });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (networkError) {
      console.error('[WhatsApp] Network error while calling Meta API:', networkError);
      return new Response(JSON.stringify({ error: 'Could not reach WhatsApp API. Please try again.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = response.headers.get('content-type') ?? '';
    let data: WhatsAppResponse | null = null;
    let rawBody: string | null = null;

    if (contentType.includes('application/json')) {
      try {
        data = (await response.json()) as WhatsAppResponse;
      } catch (parseError) {
        console.error('[WhatsApp] Failed to parse JSON response:', parseError);
      }
    } else {
      rawBody = await response.text();
    }

    if (!response.ok) {
      const errorMessage =
        data?.error?.error_user_msg ||
        data?.error?.message ||
        rawBody ||
        `WhatsApp API request failed with status ${response.status}.`;
      console.error('[WhatsApp] Error response:', { status: response.status, data, rawBody });
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, messageId: data?.messages?.[0]?.id ?? null }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return createErrorResponse(error, corsHeaders);
  }
});

type BuildRequestBodyParams = {
  type: 'text' | 'template';
  to: string;
  message?: string;
  template?: {
    name: string;
    languageCode: string;
    variables?: string[];
  };
};

function buildRequestBody(params: BuildRequestBodyParams) {
  const base = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneNumber(params.to),
  } as const;

  if (params.type === 'template' && params.template) {
    const components = params.template.variables?.length
      ? [{
          type: 'body' as const,
          parameters: params.template.variables.map((value) => ({
            type: 'text' as const,
            text: value,
          })),
        }]
      : undefined;

    return {
      ...base,
      type: 'template',
      template: {
        name: params.template.name,
        language: { code: params.template.languageCode },
        ...(components ? { components } : {}),
      },
    };
  }

  return {
    ...base,
    type: 'text',
    text: {
      preview_url: false,
      body: params.message ?? '',
    },
  };
}

function normalizePhoneNumber(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) {
    return trimmed.substring(1);
  }
  return trimmed;
}
