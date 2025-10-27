import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  validateRequest,
  checkRateLimit,
  createErrorResponse,
  SavePatternRequestSchema,
} from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate and parse request
    const requestData = await req.json();
    const { description, category, userId } = validateRequest(
      SavePatternRequestSchema,
      requestData
    );

    // Check rate limit (higher limit for pattern saving)
    checkRateLimit(userId, { maxRequests: 50, windowMs: 60000 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Normalize the description to create a pattern
    const pattern = description.toLowerCase().trim();

    // Check if pattern already exists
    const { data: existingPattern } = await supabase
      .from('transaction_patterns')
      .select('*')
      .eq('user_id', userId)
      .eq('description_pattern', pattern)
      .single();

    if (existingPattern) {
      // Update existing pattern
      const newUsageCount = existingPattern.usage_count + 1;
      const newConfidence = Math.min(0.99, existingPattern.confidence + 0.05);

      const { error } = await supabase
        .from('transaction_patterns')
        .update({
          category,
          usage_count: newUsageCount,
          confidence: newConfidence,
        })
        .eq('id', existingPattern.id);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          pattern: {
            ...existingPattern,
            category,
            usage_count: newUsageCount,
            confidence: newConfidence,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      // Create new pattern
      const { data, error } = await supabase
        .from('transaction_patterns')
        .insert({
          user_id: userId,
          description_pattern: pattern,
          category,
          confidence: 0.7,
          usage_count: 1,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, pattern: data }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    return createErrorResponse(error, corsHeaders);
  }
});
