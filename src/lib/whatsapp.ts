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
  const { data, error } = await supabase.functions.invoke('whatsapp-link', {
    body: {
      companyId: companyId ?? null,
    },
  });

  if (error) {
    throw error;
  }

  return data as WhatsAppLinkResponse;
}
