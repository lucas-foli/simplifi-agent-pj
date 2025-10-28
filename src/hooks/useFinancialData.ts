import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type FixedCost = Database['public']['Tables']['fixed_costs']['Row'];
type FixedCostInsert = Database['public']['Tables']['fixed_costs']['Insert'];
type Category = Database['public']['Tables']['categories']['Row'];

// Categories Hooks
export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      return data as Category[];
    },
  });
};

// Fixed Costs Hooks
export const useFixedCosts = (month: number, year: number) => {
  return useQuery({
    queryKey: ['fixed-costs', month, year],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('fixed_costs')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as FixedCost[];
    },
  });
};

export const useCreateFixedCost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newCost: FixedCostInsert) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('fixed_costs')
        .insert({
          ...newCost,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-costs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
};

export const useUpdateFixedCost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FixedCostInsert> }) => {
      const { data, error } = await supabase
        .from('fixed_costs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-costs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
};

export const useDeleteFixedCost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fixed_costs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-costs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
};

// Monthly Income Hooks (using profile.monthly_income)
export const useMonthlyIncome = () => {
  return useQuery({
    queryKey: ['monthly-income'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select('monthly_income')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data?.monthly_income || 0;
    },
  });
};

export const useSetMonthlyIncome = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (amount: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update({ monthly_income: amount })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-income'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
};

// Dashboard Summary Hook
export const useDashboardSummary = (month: number, year: number) => {
  return useQuery({
    queryKey: ['dashboard-summary', month, year],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get monthly income from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('monthly_income')
        .eq('id', user.id)
        .single();

      const income = profile?.monthly_income || 0;

      // Get fixed costs
      const { data: fixedCostsData } = await supabase
        .from('fixed_costs')
        .select('amount')
        .eq('user_id', user.id);

      const fixedCosts = fixedCostsData?.reduce((sum, cost) => sum + Number(cost.amount), 0) || 0;

      // Get transactions for the specific month/year
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', user.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      const expenses = transactionsData
        ?.filter(t => t.type === 'despesa')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const remaining = income - fixedCosts - expenses;

      return {
        income,
        fixedCosts,
        expenses,
        remaining,
      };
    },
    staleTime: 30000, // Cache por 30s
    gcTime: 300000, // Manter cache por 5min
  });
};
