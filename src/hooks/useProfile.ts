import type { CurrencyCode } from "@/lib/currencies";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  monthly_income: number | null;
  display_currency: CurrencyCode;
}

export const useProfile = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      return data as Profile;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
};

export const useSetDisplayCurrency = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (currency: CurrencyCode) => {
      if (!user || !profile) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update({ display_currency: currency })
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};
