-- Fix remaining Supabase security linter warnings:
-- 1. function_search_path_mutable — 5 functions missing SET search_path
-- 2. rls_policy_always_true — cost_reminder_logs policy targets all roles
-- 3. rls_enabled_no_policy — whatsapp_events has RLS but no policies

-- =============================================================================
-- 1. Fix mutable search_path on trigger functions
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION pj.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'pj'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_transaction_patterns_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_tenants_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix SECURITY DEFINER function missing search_path
CREATE OR REPLACE FUNCTION public.create_company_with_owner(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pj'
AS $function$
DECLARE
  uid uuid;
  result uuid;
BEGIN
  uid := (SELECT auth.uid());
  IF uid IS NULL THEN
    RETURN jsonb_build_object('status','error','code', 'authentication_required','message','Authentication required');
  END IF;

  BEGIN
    result := pj.ensure_company_for_user(
      (payload->>'company_name'),
      (payload->>'cnpj'),
      (payload->>'monthly_revenue')::numeric
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status','error','code','function_error','message', SQLERRM);
  END;

  RETURN jsonb_build_object('status','ok','company_id', result::text);
END;
$function$;

-- =============================================================================
-- 2. Fix cost_reminder_logs policy targeting all roles instead of service_role
-- =============================================================================

DROP POLICY IF EXISTS "Service role can manage reminder logs" ON public.cost_reminder_logs;

CREATE POLICY "Service role can manage reminder logs"
  ON public.cost_reminder_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 3. Add policies to whatsapp_events (RLS enabled but no policies)
-- =============================================================================

-- Service role needs full access for webhook edge functions
CREATE POLICY "Service role manages whatsapp events"
  ON public.whatsapp_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read events for their linked phone numbers
CREATE POLICY "Users can view events for their linked phones"
  ON public.whatsapp_events
  FOR SELECT
  TO authenticated
  USING (
    phone IN (
      SELECT wl.phone FROM public.whatsapp_links wl
      WHERE wl.profile_id = auth.uid()
    )
  );
