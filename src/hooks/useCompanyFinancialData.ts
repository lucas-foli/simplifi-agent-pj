import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Company = Database['public']['Tables']['companies']['Row'];
type CompanyCategory = Database['public']['Tables']['company_categories']['Row'];
type CompanyFixedCost = Database['public']['Tables']['company_fixed_costs']['Row'];
type CompanyFixedCostInsert = Database['public']['Tables']['company_fixed_costs']['Insert'];
type CompanyTransaction = Database['public']['Tables']['company_transactions']['Row'];
type CompanyTransactionInsert = Database['public']['Tables']['company_transactions']['Insert'];
type CompanyTransactionUpdate = Database['public']['Tables']['company_transactions']['Update'];
type CompanyTransactionWithCategory = CompanyTransaction & {
  company_categories?: {
    id: string;
    name: string;
  } | null;
};

export const useCompanyProfile = (companyId?: string) => {
  return useQuery({
    queryKey: ['company-profile', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (error) throw error;
      return data as Company;
    },
  });
};

export const useCompanyCategories = (companyId?: string) => {
  return useQuery({
    queryKey: ['company-categories', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [] as CompanyCategory[];

      const { data, error } = await supabase
        .from('company_categories')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (error) throw error;

      return data as CompanyCategory[];
    },
  });
};

export const useCompanyFixedCosts = (companyId?: string) => {
  return useQuery({
    queryKey: ['company-fixed-costs', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [] as CompanyFixedCost[];

      const { data, error } = await supabase
        .from('company_fixed_costs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data as CompanyFixedCost[];
    },
  });
};

export const useCreateCompanyFixedCost = (companyId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<CompanyFixedCostInsert, 'company_id'>) => {
      if (!companyId) throw new Error('Company not selected');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('company_fixed_costs')
        .insert({
          ...payload,
          company_id: companyId,
          amount: Number(payload.amount),
          created_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-fixed-costs', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company-dashboard-summary', companyId], exact: false });
    },
  });
};

export const useUpdateCompanyFixedCost = (companyId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CompanyFixedCostInsert> }) => {
      if (!companyId) throw new Error('Company not selected');

      const { error } = await supabase
        .from('company_fixed_costs')
        .update({
          ...updates,
          amount: updates.amount !== undefined ? Number(updates.amount) : undefined,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company-fixed-costs', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company-fixed-cost', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['company-dashboard-summary', companyId], exact: false });
    },
  });
};

export const useDeleteCompanyFixedCost = (companyId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!companyId) throw new Error('Company not selected');

      const { error } = await supabase
        .from('company_fixed_costs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-fixed-costs', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company-dashboard-summary', companyId], exact: false });
    },
  });
};

export const useCompanyTransactions = (companyId: string | undefined, month?: number, year?: number) => {
  return useQuery({
    queryKey: ['company-transactions', companyId, month, year],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [] as CompanyTransaction[];

      let query = supabase
        .from('company_transactions')
        .select(`
          *,
          company_categories (
            id,
            name
          )
        `)
        .eq('company_id', companyId)
        .order('date', { ascending: false });

      if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        query = query
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CompanyTransactionWithCategory[];
    },
  });
};

export const useCreateCompanyTransaction = (companyId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<CompanyTransactionInsert, 'company_id'>) => {
      if (!companyId) throw new Error('Company not selected');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('company_transactions')
        .insert({
          ...payload,
          company_id: companyId,
          amount: Number(payload.amount),
          created_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-transactions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company-dashboard-summary', companyId], exact: false });
      queryClient.invalidateQueries({ queryKey: ['company-transactions-by-category', companyId] });
    },
  });
};

export const useUpdateCompanyTransaction = (companyId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: CompanyTransactionUpdate }) => {
      if (!companyId) throw new Error('Company not selected');

      const { error } = await supabase
        .from('company_transactions')
        .update({
          ...updates,
          amount: updates.amount !== undefined ? Number(updates.amount) : undefined,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company-transactions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company-transaction', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['company-dashboard-summary', companyId], exact: false });
      queryClient.invalidateQueries({ queryKey: ['company-transactions-by-category', companyId] });
    },
  });
};

export const useDeleteCompanyTransaction = (companyId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!companyId) throw new Error('Company not selected');

      const { error } = await supabase
        .from('company_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-transactions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company-dashboard-summary', companyId], exact: false });
      queryClient.invalidateQueries({ queryKey: ['company-transactions-by-category', companyId] });
    },
  });
};

export const useCompanyTransactionsByCategory = (companyId: string | undefined, month?: number, year?: number) => {
  return useQuery({
    queryKey: ['company-transactions-by-category', companyId, month, year],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [] as Array<{ category: string; total: number; count: number }>;

      let query = supabase
        .from('company_transactions')
        .select('amount, category_id, type')
        .eq('company_id', companyId);

      if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        query = query
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      const { data: categoriesData } = await supabase
        .from('company_categories')
        .select('id, name')
        .eq('company_id', companyId);

      const categoryMap = new Map(categoriesData?.map((category) => [category.id, category.name]) ?? []);

      const grouped = data?.reduce((acc: Record<string, { category: string; total: number; count: number }>, transaction) => {
        const name = transaction.category_id
          ? categoryMap.get(transaction.category_id) || 'Sem categoria'
          : 'Sem categoria';

        if (!acc[name]) {
          acc[name] = { category: name, total: 0, count: 0 };
        }

        acc[name].total += Number(transaction.amount);
        acc[name].count += 1;
        return acc;
      }, {}) ?? {};

      return Object.values(grouped);
    },
  });
};

export const useCompanyDashboardSummary = (companyId: string | undefined, month: number, year: number) => {
  return useQuery({
    queryKey: ['company-dashboard-summary', companyId, month, year],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) {
        return {
          revenue: 0,
          fixedCosts: 0,
          expenses: 0,
          transactionIncome: 0,
          remaining: 0,
        };
      }

      const { data: companyData } = await supabase
        .from('companies')
        .select('monthly_revenue')
        .eq('id', companyId)
        .single();

      const revenue = Number(companyData?.monthly_revenue ?? 0);

      const { data: fixedCostsData } = await supabase
        .from('company_fixed_costs')
        .select('amount')
        .eq('company_id', companyId);

      const fixedCosts = fixedCostsData?.reduce((acc, cost) => acc + Number(cost.amount), 0) ?? 0;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const { data: transactionsData } = await supabase
        .from('company_transactions')
        .select('amount, type')
        .eq('company_id', companyId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      const expenses = transactionsData
        ?.filter((transaction) => transaction.type === 'despesa')
        .reduce((acc, transaction) => acc + Number(transaction.amount), 0) ?? 0;

      const transactionIncome = transactionsData
        ?.filter((transaction) => transaction.type === 'receita')
        .reduce((acc, transaction) => acc + Number(transaction.amount), 0) ?? 0;

      const remaining = revenue + transactionIncome - fixedCosts - expenses;

      return {
        revenue,
        fixedCosts,
        expenses,
        transactionIncome,
        remaining,
      };
    },
    staleTime: 30000,
    gcTime: 300000,
  });
};

export const useSetCompanyMonthlyRevenue = (companyId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (amount: number) => {
      if (!companyId) throw new Error('Company not selected');

      const { error } = await supabase
        .from('companies')
        .update({ monthly_revenue: amount })
        .eq('id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company-dashboard-summary', companyId], exact: false });
    },
  });
};
