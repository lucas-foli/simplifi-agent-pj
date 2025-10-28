import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Transaction = Database['public']['Tables']['transactions']['Row'];
type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];

export const useTransactions = (month?: number, year?: number) => {
  return useQuery({
    queryKey: ['transactions', month, year],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('transactions')
        .select('*, categories(name)')
        .eq('user_id', user.id)
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
      return data as Transaction[];
    },
  });
};

export const useTransaction = (id: string) => {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Transaction;
    },
    enabled: !!id,
  });
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newTransaction: TransactionInsert) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          ...newTransaction,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TransactionUpdate }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
};

// Group transactions by category
export const useTransactionsByCategory = (month?: number, year?: number) => {
  return useQuery({
    queryKey: ['transactions-by-category', month, year],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id);

      if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        query = query
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get categories to map IDs to names
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id);

      const categoryMap = new Map(
        categoriesData?.map(cat => [cat.id, cat.name]) || []
      );

      // Group by category
      const grouped = data.reduce((acc: any, transaction: any) => {
        const categoryName = transaction.category_id 
          ? categoryMap.get(transaction.category_id) || 'Sem categoria'
          : 'Sem categoria';
        if (!acc[categoryName]) {
          acc[categoryName] = {
            category: categoryName,
            total: 0,
            count: 0,
          };
        }
        acc[categoryName].total += Number(transaction.amount);
        acc[categoryName].count += 1;
        return acc;
      }, {});

      return Object.values(grouped);
    },
  });
};
