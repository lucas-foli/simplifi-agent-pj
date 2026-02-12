import { supabase } from '@/lib/supabase';

export type WhatsAppMessagePayload = {
  userId: string;
  to: string;
  message?: string;
  template?: {
    name: string;
    languageCode: string;
    variables?: string[];
  };
  type?: 'text' | 'template';
};

export type WhatsAppLinkResponse = {
  code: string;
  expiresAt: string;
};

export type WhatsAppLinkStatus = 'pending' | 'linked' | 'revoked';

export type WhatsAppLinkRecord = {
  id: string;
  status: WhatsAppLinkStatus;
  phone: string | null;
  pairing_expires_at: string | null;
  verified_at: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function sendWhatsAppMessage(payload: WhatsAppMessagePayload) {
  const body = {
    ...payload,
    type: payload.type ?? (payload.template ? 'template' : 'text'),
  };

  const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
    body,
  });

  if (error) {
    throw error;
  }

  return data as { success: boolean; messageId: string | null };
}

export async function createWhatsAppLink(companyId?: string) {
  const invokeWithToken = async (accessToken: string) => {
    const { data, error } = await supabase.functions.invoke('whatsapp-link', {
      body: {
        companyId: companyId ?? null,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    });

    if (error) {
      throw error;
    }

    return data as WhatsAppLinkResponse;
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  try {
    return await invokeWithToken(accessToken);
  } catch (error) {
    const status = (error as any)?.context?.status ?? (error as any)?.status;
    const message = (error as any)?.message ?? '';
    const shouldRefresh = /jwt expired|not authenticated/i.test(message);
    if (!shouldRefresh) {
      throw error;
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed?.session?.access_token) {
      throw error;
    }

    return await invokeWithToken(refreshed.session.access_token);
  }
}

export async function fetchLatestWhatsAppLink(companyId?: string) {
  const client = supabase as any;
  let query = client
    .from('whatsapp_links')
    .select('id, status, phone, pairing_expires_at, verified_at, company_id, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (companyId) {
    query = query.eq('company_id', companyId);
  } else {
    query = query.is('company_id', null);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data as WhatsAppLinkRecord | null;
}
