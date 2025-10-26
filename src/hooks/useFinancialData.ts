import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type FixedCost = Database['public']['Tables']['fixed_costs']['Row'];
type FixedCostInsert = Database['public']['Tables']['fixed_costs']['Insert'];
type MonthlyIncome = Database['public']['Tables']['monthly_income']['Row'];
type MonthlyIncomeInsert = Database['public']['Tables']['monthly_income']['Insert'];

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
        .eq('user_id', user.id)
        .eq('month', month)
        .eq('year', year);

      if (error) throw error;
      return data as FixedCost[];
    },
  });
};

export const useCreateFixedCost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cost: Omit<FixedCostInsert, 'user_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('fixed_costs')
        .insert({
          ...cost,
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
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FixedCost> }) => {
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

// Monthly Income Hooks
export const useMonthlyIncome = (month: number, year: number) => {
  return useQuery({
    queryKey: ['monthly-income', month, year],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('monthly_income')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (error) throw error;
      return data as MonthlyIncome | null;
    },
  });
};

export const useSetMonthlyIncome = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (income: Omit<MonthlyIncomeInsert, 'user_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Use upsert to insert or update
      const { data, error } = await supabase
        .from('monthly_income')
        .upsert({
          ...income,
          user_id: user.id,
        }, {
          onConflict: 'user_id,company_id,month,year'
        })
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

      console.log('[Dashboard Summary] 🔍 Buscando dados:', { month, year, userId: user.id });

      // Fetch income
      const { data: incomeData, error: incomeError } = await supabase
        .from('monthly_income')
        .select('amount')
        .eq('user_id', user.id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (incomeError) {
        console.error('[Dashboard Summary] ❌ Erro ao buscar receita:', incomeError);
      } else {
        console.log('[Dashboard Summary] 💰 Receita:', incomeData);
      }

      // Fetch fixed costs
      const { data: fixedCostsData, error: costsError } = await supabase
        .from('fixed_costs')
        .select('amount')
        .eq('user_id', user.id)
        .eq('month', month)
        .eq('year', year);

      if (costsError) {
        console.error('[Dashboard Summary] ❌ Erro ao buscar custos:', costsError);
      } else {
        console.log('[Dashboard Summary] 📋 Custos fixos:', fixedCostsData);
      }

      // Fetch transactions
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      const { data: transactionsData, error: txError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (txError) {
        console.error('[Dashboard Summary] ❌ Erro ao buscar transações:', txError);
      } else {
        console.log('[Dashboard Summary] 🛒 Transações:', transactionsData);
      }

      // Values are stored as decimals in the database
      const income = incomeData?.amount ? Number(incomeData.amount) : 0;
      const fixedCosts = fixedCostsData?.reduce((sum, cost) => sum + Number(cost.amount), 0) || 0;
      const expenses = transactionsData?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
      const remaining = income - fixedCosts - expenses;

      console.log('[Dashboard Summary] ✅ Calculado:', { income, fixedCosts, expenses, remaining });

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
