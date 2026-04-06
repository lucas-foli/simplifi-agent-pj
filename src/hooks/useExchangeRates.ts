import { useQuery } from '@tanstack/react-query';
import { fetchExchangeRates, type ExchangeRates } from '@/services/exchangeRates';

export const useExchangeRates = () => {
  return useQuery<ExchangeRates>({
    queryKey: ['exchange-rates'],
    queryFn: fetchExchangeRates,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
};
