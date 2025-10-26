import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AIInsight {
  message: string;
  actions?: Array<{
    label: string;
    action: string;
    data?: string;
  }>;
}

export const useAIInsights = () => {
  return useQuery({
    queryKey: ['ai-insights'],
    queryFn: async (): Promise<AIInsight | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      try {
        // Call Edge Function to get AI insights
        const { data, error } = await supabase.functions.invoke('chat-assistant', {
          body: {
            message: 'Me dê uma dica rápida sobre meus gastos este mês',
            userId: user.id,
          },
        });

        if (error) {
          console.error('Error fetching AI insights:', error);
          return null;
        }

        return {
          message: data.message,
          actions: data.actions || [],
        };
      } catch (error) {
        console.error('Error calling AI assistant:', error);
        return null;
      }
    },
    staleTime: 300000, // Cache por 5 minutos
    gcTime: 600000, // Manter cache por 10 minutos
    retry: false, // Não retentar se falhar
  });
};
