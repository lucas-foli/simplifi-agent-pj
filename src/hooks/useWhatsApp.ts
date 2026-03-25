import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabase';

export const useLinkedWhatsApp = (companyId?: string) => {
  const { user } = useAuth();
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeRef = useRef(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let query = supabase
      .from('whatsapp_links')
      .select('phone')
      .eq('profile_id', user.id)
      .eq('status', 'linked')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (!activeRef.current) return;

    if (error) {
      console.error('Erro ao buscar WhatsApp vinculado:', error);
    } else {
      setLinkedPhone(data?.phone ?? null);
    }
    setIsLoading(false);
  }, [user?.id, companyId]);

  useEffect(() => {
    activeRef.current = true;
    load();
    return () => { activeRef.current = false; };
  }, [load]);

  return { linkedPhone, isLoading, setLinkedPhone, refresh: load };
};

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

export const useSendWhatsAppMessage = () => {
  return useMutation({
    mutationFn: async (payload: WhatsAppMessagePayload) => {
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
    },
  });
};

export type WhatsAppLinkPayload = {
  companyId?: string | null;
};

export const useWhatsAppLinkCode = () => {
  return useMutation({
    mutationFn: async (payload: WhatsAppLinkPayload) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-link', {
        body: { companyId: payload.companyId ?? null },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });

      if (error) {
        throw error;
      }

      return data as {
        code: string;
        expiresAt: string;
      };
    },
  });
};
