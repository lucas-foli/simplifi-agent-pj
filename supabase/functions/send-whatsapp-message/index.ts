import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  WhatsAppMessageRequestSchema,
  validateRequest,
  createErrorResponse,
  checkRateLimit,
} from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    if (!token || !phoneNumberId) {
      throw new Error('WhatsApp API credentials are not configured.');
    }

    const payload = await req.json();
    const { userId, to, type, message, template } = validateRequest(WhatsAppMessageRequestSchema, payload);

    // Basic per-user throttling to avoid accidental floods
    checkRateLimit(userId, { maxRequests: 20, windowMs: 60_000 });

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const requestBody = buildRequestBody({ type, to, message, template });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = (await response.json()) as WhatsAppResponse;

    if (!response.ok) {
      const errorMessage = data.error?.error_user_msg || data.error?.message || 'WhatsApp API request failed.';
      console.error('[WhatsApp] Error response:', data);
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, messageId: data.messages?.[0]?.id ?? null }),
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
