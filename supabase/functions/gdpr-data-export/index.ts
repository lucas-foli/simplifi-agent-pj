import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  validateRequest,
  createErrorResponse,
  UUIDSchema,
} from '../_shared/validation.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DataExportRequestSchema = z.object({
  userId: UUIDSchema,
  format: z.enum(['json', 'csv']).default('json'),
});

/**
 * LGPD Article 18 - Right to data portability
 * GDPR Article 20 - Right to data portability
 * 
 * This function exports all user data in a machine-readable format
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    const { userId, format } = validateRequest(DataExportRequestSchema, requestData);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Fetch all user data
    const userData = await fetchAllUserData(supabase, userId);

    // Log data access for audit
    await supabase.rpc('log_sensitive_access', {
      p_table_name: 'data_export',
      p_record_id: userId,
      p_action: 'EXPORT',
    });

    // Format response based on requested format
    if (format === 'csv') {
      const csv = convertToCSV(userData);
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="my-data-${userId}.csv"`,
        },
      });
    }

    // Default: JSON
    return new Response(JSON.stringify(userData, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="my-data-${userId}.json"`,
      },
    });
  } catch (error) {
    return createErrorResponse(error, corsHeaders);
  }
});

async function fetchAllUserData(supabase: any, userId: string) {
  // Fetch from all tables containing user data
  // Use decrypted views for users and companies
  const [
    profile,
    companies,
    transactions,
    fixedCosts,
    monthlyIncome,
    chatHistory,
    transactionPatterns,
  ] = await Promise.all([
    supabase.from('users_decrypted').select('*').eq('id', userId).single(),
    supabase.from('companies_decrypted').select('*').eq('user_id', userId),
    supabase.from('transactions').select('*').eq('user_id', userId),
    supabase.from('fixed_costs').select('*').eq('user_id', userId),
    supabase.from('monthly_income').select('*').eq('user_id', userId),
    supabase.from('chat_history').select('*').eq('user_id', userId),
    supabase.from('transaction_patterns').select('*').eq('user_id', userId),
  ]);

  return {
    export_date: new Date().toISOString(),
    user_id: userId,
    profile: profile.data,
    companies: companies.data || [],
    transactions: transactions.data || [],
    fixed_costs: fixedCosts.data || [],
    monthly_income: monthlyIncome.data || [],
    chat_history: chatHistory.data || [],
    transaction_patterns: transactionPatterns.data || [],
    _metadata: {
      total_records: {
        transactions: transactions.data?.length || 0,
        fixed_costs: fixedCosts.data?.length || 0,
        monthly_income: monthlyIncome.data?.length || 0,
        chat_history: chatHistory.data?.length || 0,
        transaction_patterns: transactionPatterns.data?.length || 0,
      },
      export_format: 'LGPD/GDPR compliant data export',
      rights: {
        access: 'You have the right to access your data (LGPD Art. 18, I)',
        correction: 'You have the right to correct incomplete/inaccurate data (LGPD Art. 18, III)',
        deletion: 'You have the right to request deletion of your data (LGPD Art. 18, VI)',
        portability: 'You have the right to data portability (LGPD Art. 18, V)',
      },
    },
  };
}

function convertToCSV(data: any): string {
  // Simple CSV conversion for transactions (most important data)
  const transactions = data.transactions || [];
  
  if (transactions.length === 0) {
    return 'No transaction data available';
  }

  const headers = Object.keys(transactions[0]).join(',');
  const rows = transactions.map((tx: any) =>
    Object.values(tx).map(v => `"${v}"`).join(',')
  );

  return [headers, ...rows].join('\n');
}
