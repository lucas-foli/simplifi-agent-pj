drop extension if exists "pg_net";

drop policy if exists "Members can view company" on "pj"."companies";

drop view if exists "public"."companies";

drop view if exists "public"."company_fixed_costs";


  create table "public"."data_access_log" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "table_name" text not null,
    "record_id" uuid,
    "action" text not null,
    "accessed_at" timestamp with time zone default now(),
    "ip_address" inet,
    "user_agent" text
      );


alter table "public"."data_access_log" enable row level security;


  create table "public"."data_retention_policy" (
    "id" uuid not null default gen_random_uuid(),
    "table_name" text not null,
    "retention_days" integer not null,
    "last_cleanup_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."encryption_keys" (
    "id" uuid not null default gen_random_uuid(),
    "key_name" text not null,
    "key_value" text not null,
    "created_at" timestamp with time zone default now(),
    "rotated_at" timestamp with time zone
      );



  create table "public"."transaction_patterns" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "description_pattern" text not null,
    "category" text not null,
    "confidence" numeric(3,2) not null default 0.7,
    "usage_count" integer not null default 1,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."transaction_patterns" enable row level security;

alter table "pj"."company_fixed_costs" drop column "payment_method";

alter table "public"."profiles" add column "cnpj_encrypted" text;

alter table "public"."transactions" add column "payment_method" text;

CREATE UNIQUE INDEX data_access_log_pkey ON public.data_access_log USING btree (id);

CREATE UNIQUE INDEX data_retention_policy_pkey ON public.data_retention_policy USING btree (id);

CREATE UNIQUE INDEX data_retention_policy_table_name_key ON public.data_retention_policy USING btree (table_name);

CREATE UNIQUE INDEX encryption_keys_key_name_key ON public.encryption_keys USING btree (key_name);

CREATE UNIQUE INDEX encryption_keys_pkey ON public.encryption_keys USING btree (id);

CREATE INDEX idx_data_access_log_accessed_at ON public.data_access_log USING btree (accessed_at);

CREATE INDEX idx_data_access_log_table_name ON public.data_access_log USING btree (table_name);

CREATE INDEX idx_data_access_log_user_id ON public.data_access_log USING btree (user_id);

CREATE INDEX idx_transaction_patterns_description ON public.transaction_patterns USING btree (description_pattern);

CREATE INDEX idx_transaction_patterns_user_id ON public.transaction_patterns USING btree (user_id);

CREATE UNIQUE INDEX transaction_patterns_pkey ON public.transaction_patterns USING btree (id);

CREATE UNIQUE INDEX transaction_patterns_user_id_description_pattern_key ON public.transaction_patterns USING btree (user_id, description_pattern);

alter table "public"."data_access_log" add constraint "data_access_log_pkey" PRIMARY KEY using index "data_access_log_pkey";

alter table "public"."data_retention_policy" add constraint "data_retention_policy_pkey" PRIMARY KEY using index "data_retention_policy_pkey";

alter table "public"."encryption_keys" add constraint "encryption_keys_pkey" PRIMARY KEY using index "encryption_keys_pkey";

alter table "public"."transaction_patterns" add constraint "transaction_patterns_pkey" PRIMARY KEY using index "transaction_patterns_pkey";

alter table "public"."data_access_log" add constraint "data_access_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."data_access_log" validate constraint "data_access_log_user_id_fkey";

alter table "public"."data_retention_policy" add constraint "data_retention_policy_table_name_key" UNIQUE using index "data_retention_policy_table_name_key";

alter table "public"."encryption_keys" add constraint "encryption_keys_key_name_key" UNIQUE using index "encryption_keys_key_name_key";

alter table "public"."transaction_patterns" add constraint "transaction_patterns_confidence_check" CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))) not valid;

alter table "public"."transaction_patterns" validate constraint "transaction_patterns_confidence_check";

alter table "public"."transaction_patterns" add constraint "transaction_patterns_usage_count_check" CHECK ((usage_count >= 0)) not valid;

alter table "public"."transaction_patterns" validate constraint "transaction_patterns_usage_count_check";

alter table "public"."transaction_patterns" add constraint "transaction_patterns_user_id_description_pattern_key" UNIQUE using index "transaction_patterns_user_id_description_pattern_key";

alter table "public"."transaction_patterns" add constraint "transaction_patterns_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."transaction_patterns" validate constraint "transaction_patterns_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION pj.create_company_with_owner(company_name text, cnpj text DEFAULT NULL::text, monthly_revenue numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pj', 'public'
AS $function$
DECLARE
  target_company UUID;
  encrypted_cnpj TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT company_id INTO target_company
  FROM pj.company_members
  WHERE profile_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_company IS NOT NULL THEN
    RETURN target_company;
  END IF;

  IF cnpj IS NOT NULL THEN
    SELECT public.encrypt_sensitive(cnpj) INTO encrypted_cnpj;
  END IF;

  INSERT INTO pj.companies (name, created_by, cnpj_encrypted, monthly_revenue)
  VALUES (
    COALESCE(NULLIF(trim(company_name), ''), 'Empresa sem nome'),
    auth.uid(),
    encrypted_cnpj,
    COALESCE(monthly_revenue, 0)
  )
  RETURNING id INTO target_company;

  INSERT INTO pj.company_members (company_id, profile_id, role)
  VALUES (target_company, auth.uid(), 'owner');

  PERFORM pj.create_default_categories(target_company);

  RETURN target_company;
END;
$function$
;

CREATE OR REPLACE FUNCTION pj.ensure_company_for_user(company_name text, cnpj text DEFAULT NULL::text, monthly_revenue numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pj', 'public'
AS $function$
DECLARE
  target_company UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT company_id INTO target_company
  FROM pj.company_members
  WHERE profile_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_company IS NOT NULL THEN
    RETURN target_company;
  END IF;

  RETURN pj.create_company_with_owner(company_name, cnpj, monthly_revenue);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.anonymize_transaction_data(start_date date, end_date date)
 RETURNS TABLE(month text, category text, avg_amount numeric, transaction_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(date, 'YYYY-MM') as month,
    t.category,
    ROUND(AVG(t.amount), 2) as avg_amount,
    COUNT(*)::BIGINT as transaction_count
  FROM transactions t
  WHERE t.date BETWEEN start_date AND end_date
  GROUP BY TO_CHAR(date, 'YYYY-MM'), t.category
  ORDER BY month, category;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
 RETURNS TABLE(table_name text, deleted_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  policy RECORD;
  delete_count BIGINT;
BEGIN
  FOR policy IN SELECT * FROM data_retention_policy LOOP
    EXECUTE format(
      'DELETE FROM %I WHERE created_at < NOW() - INTERVAL ''%s days''',
      policy.table_name,
      policy.retention_days
    );
    
    GET DIAGNOSTICS delete_count = ROW_COUNT;
    
    -- Update last cleanup time
    UPDATE data_retention_policy
    SET last_cleanup_at = NOW()
    WHERE id = policy.id;
    
    -- Return results
    table_name := policy.table_name;
    deleted_count := delete_count;
    RETURN NEXT;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_company_with_owner(company_name text, cnpj text DEFAULT NULL::text, monthly_revenue numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pj'
AS $function$
  SELECT public.pg_create_company_with_owner(
    jsonb_build_object(
      'company_name', company_name,
      'cnpj', cnpj,
      'monthly_revenue', monthly_revenue
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.create_company_with_owner(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  uid uuid;
  result uuid;
BEGIN
  -- get auth user id
  uid := (SELECT auth.uid());
  IF uid IS NULL THEN
    RETURN jsonb_build_object('status','error','code', 'authentication_required','message','Authentication required');
  END IF;

  -- call underlying function in pj schema
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_default_categories()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert default categories for the new user
  INSERT INTO public.categories (user_id, name, color, is_default)
  VALUES
    (NEW.id, 'Alimentação', '#F59E0B', true),
    (NEW.id, 'Transporte', '#3B82F6', true),
    (NEW.id, 'Saúde', '#10B981', true),
    (NEW.id, 'Educação', '#8B5CF6', true),
    (NEW.id, 'Lazer', '#EC4899', true),
    (NEW.id, 'Moradia', '#EF4444', true),
    (NEW.id, 'Vestuário', '#14B8A6', true),
    (NEW.id, 'Serviços', '#6366F1', true),
    (NEW.id, 'Investimentos', '#059669', true),
    (NEW.id, 'Outros', '#6B7280', true);
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_company_for_user(company_name text, cnpj text DEFAULT NULL::text, monthly_revenue numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pj'
AS $function$
  SELECT pj.ensure_company_for_user(company_name, cnpj, monthly_revenue);
$function$
;

CREATE OR REPLACE FUNCTION public.log_sensitive_access(p_table_name text, p_record_id uuid, p_action text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO data_access_log (user_id, table_name, record_id, action)
  VALUES (auth.uid(), p_table_name, p_record_id, p_action);
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the main operation if logging fails
    RAISE WARNING 'Failed to log data access: %', SQLERRM;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_transaction_patterns_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$function$
;

create or replace view "public"."users_decrypted" as  SELECT id,
    email,
    full_name AS name,
    user_type,
    company_name,
    monthly_income,
        CASE
            WHEN (cnpj_encrypted IS NOT NULL) THEN public.decrypt_sensitive(cnpj_encrypted)
            ELSE cnpj
        END AS cnpj,
    created_at,
    updated_at
   FROM public.profiles;


CREATE OR REPLACE FUNCTION pj.create_company_with_owner(company_name text, cnpj text DEFAULT NULL::text, monthly_revenue numeric DEFAULT 0, activity text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pj', 'public'
AS $function$
DECLARE
  target_company UUID;
  encrypted_cnpj TEXT;
  sanitized_activity TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT company_id
  INTO target_company
  FROM pj.company_members
  WHERE profile_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_company IS NOT NULL THEN
    RETURN target_company;
  END IF;

  IF cnpj IS NOT NULL THEN
    SELECT public.encrypt_sensitive(cnpj)
    INTO encrypted_cnpj;
  END IF;

  sanitized_activity := NULLIF(trim(activity), '');

  INSERT INTO pj.companies (name, activity, created_by, cnpj_encrypted, monthly_revenue)
  VALUES (
    COALESCE(NULLIF(trim(company_name), ''), 'Empresa sem nome'),
    sanitized_activity,
    auth.uid(),
    encrypted_cnpj,
    COALESCE(monthly_revenue, 0)
  )
  RETURNING id INTO target_company;

  INSERT INTO pj.company_members (company_id, profile_id, role)
  VALUES (target_company, auth.uid(), 'owner');

  PERFORM pj.create_default_categories(target_company);

  RETURN target_company;
END;
$function$
;

CREATE OR REPLACE FUNCTION pj.ensure_company_for_user(company_name text, cnpj text DEFAULT NULL::text, monthly_revenue numeric DEFAULT 0, activity text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pj', 'public'
AS $function$
DECLARE
  target_company UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT company_id
  INTO target_company
  FROM pj.company_members
  WHERE profile_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_company IS NOT NULL THEN
    RETURN target_company;
  END IF;

  RETURN pj.create_company_with_owner(company_name, cnpj, monthly_revenue, activity);
END;
$function$
;

create or replace view "public"."companies" as  SELECT id,
    name,
    trade_name,
    created_by,
    cnpj_encrypted,
    email,
    phone,
    monthly_revenue,
    metadata,
    created_at,
    updated_at
   FROM pj.companies;


create or replace view "public"."company_fixed_costs" as  SELECT id,
    company_id,
    description,
    amount,
    category_id,
    created_by,
    created_at,
    updated_at
   FROM pj.company_fixed_costs;


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, user_type, full_name, email, monthly_income)
  VALUES (
    NEW.id,
    -- Use user_type from metadata, default to pessoa_fisica if not provided
    COALESCE(
      CASE NEW.raw_user_meta_data->>'user_type'
        WHEN 'pf' THEN 'pessoa_fisica'::user_type
        WHEN 'pj' THEN 'pessoa_juridica'::user_type
        WHEN 'pessoa_fisica' THEN 'pessoa_fisica'::user_type
        WHEN 'pessoa_juridica' THEN 'pessoa_juridica'::user_type
        ELSE 'pessoa_fisica'::user_type
      END,
      'pessoa_fisica'::user_type
    ),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.email,
    0
  );
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."data_access_log" to "anon";

grant insert on table "public"."data_access_log" to "anon";

grant references on table "public"."data_access_log" to "anon";

grant select on table "public"."data_access_log" to "anon";

grant trigger on table "public"."data_access_log" to "anon";

grant truncate on table "public"."data_access_log" to "anon";

grant update on table "public"."data_access_log" to "anon";

grant delete on table "public"."data_access_log" to "authenticated";

grant insert on table "public"."data_access_log" to "authenticated";

grant references on table "public"."data_access_log" to "authenticated";

grant select on table "public"."data_access_log" to "authenticated";

grant trigger on table "public"."data_access_log" to "authenticated";

grant truncate on table "public"."data_access_log" to "authenticated";

grant update on table "public"."data_access_log" to "authenticated";

grant delete on table "public"."data_access_log" to "service_role";

grant insert on table "public"."data_access_log" to "service_role";

grant references on table "public"."data_access_log" to "service_role";

grant select on table "public"."data_access_log" to "service_role";

grant trigger on table "public"."data_access_log" to "service_role";

grant truncate on table "public"."data_access_log" to "service_role";

grant update on table "public"."data_access_log" to "service_role";

grant delete on table "public"."data_retention_policy" to "anon";

grant insert on table "public"."data_retention_policy" to "anon";

grant references on table "public"."data_retention_policy" to "anon";

grant select on table "public"."data_retention_policy" to "anon";

grant trigger on table "public"."data_retention_policy" to "anon";

grant truncate on table "public"."data_retention_policy" to "anon";

grant update on table "public"."data_retention_policy" to "anon";

grant delete on table "public"."data_retention_policy" to "authenticated";

grant insert on table "public"."data_retention_policy" to "authenticated";

grant references on table "public"."data_retention_policy" to "authenticated";

grant select on table "public"."data_retention_policy" to "authenticated";

grant trigger on table "public"."data_retention_policy" to "authenticated";

grant truncate on table "public"."data_retention_policy" to "authenticated";

grant update on table "public"."data_retention_policy" to "authenticated";

grant delete on table "public"."data_retention_policy" to "service_role";

grant insert on table "public"."data_retention_policy" to "service_role";

grant references on table "public"."data_retention_policy" to "service_role";

grant select on table "public"."data_retention_policy" to "service_role";

grant trigger on table "public"."data_retention_policy" to "service_role";

grant truncate on table "public"."data_retention_policy" to "service_role";

grant update on table "public"."data_retention_policy" to "service_role";

grant delete on table "public"."encryption_keys" to "anon";

grant insert on table "public"."encryption_keys" to "anon";

grant references on table "public"."encryption_keys" to "anon";

grant select on table "public"."encryption_keys" to "anon";

grant trigger on table "public"."encryption_keys" to "anon";

grant truncate on table "public"."encryption_keys" to "anon";

grant update on table "public"."encryption_keys" to "anon";

grant delete on table "public"."encryption_keys" to "authenticated";

grant insert on table "public"."encryption_keys" to "authenticated";

grant references on table "public"."encryption_keys" to "authenticated";

grant select on table "public"."encryption_keys" to "authenticated";

grant trigger on table "public"."encryption_keys" to "authenticated";

grant truncate on table "public"."encryption_keys" to "authenticated";

grant update on table "public"."encryption_keys" to "authenticated";

grant delete on table "public"."encryption_keys" to "service_role";

grant insert on table "public"."encryption_keys" to "service_role";

grant references on table "public"."encryption_keys" to "service_role";

grant select on table "public"."encryption_keys" to "service_role";

grant trigger on table "public"."encryption_keys" to "service_role";

grant truncate on table "public"."encryption_keys" to "service_role";

grant update on table "public"."encryption_keys" to "service_role";

grant delete on table "public"."transaction_patterns" to "anon";

grant insert on table "public"."transaction_patterns" to "anon";

grant references on table "public"."transaction_patterns" to "anon";

grant select on table "public"."transaction_patterns" to "anon";

grant trigger on table "public"."transaction_patterns" to "anon";

grant truncate on table "public"."transaction_patterns" to "anon";

grant update on table "public"."transaction_patterns" to "anon";

grant delete on table "public"."transaction_patterns" to "authenticated";

grant insert on table "public"."transaction_patterns" to "authenticated";

grant references on table "public"."transaction_patterns" to "authenticated";

grant select on table "public"."transaction_patterns" to "authenticated";

grant trigger on table "public"."transaction_patterns" to "authenticated";

grant truncate on table "public"."transaction_patterns" to "authenticated";

grant update on table "public"."transaction_patterns" to "authenticated";

grant delete on table "public"."transaction_patterns" to "service_role";

grant insert on table "public"."transaction_patterns" to "service_role";

grant references on table "public"."transaction_patterns" to "service_role";

grant select on table "public"."transaction_patterns" to "service_role";

grant trigger on table "public"."transaction_patterns" to "service_role";

grant truncate on table "public"."transaction_patterns" to "service_role";

grant update on table "public"."transaction_patterns" to "service_role";


  create policy "Service role can insert audit logs"
  on "public"."data_access_log"
  as permissive
  for insert
  to public
with check (true);



  create policy "Service role can view audit logs"
  on "public"."data_access_log"
  as permissive
  for select
  to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));



  create policy "Users can delete their own patterns"
  on "public"."transaction_patterns"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert their own patterns"
  on "public"."transaction_patterns"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update their own patterns"
  on "public"."transaction_patterns"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view their own patterns"
  on "public"."transaction_patterns"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Members can view company"
  on "pj"."companies"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM pj.company_members cm
  WHERE ((cm.company_id = companies.id) AND (cm.profile_id = auth.uid())))));


CREATE TRIGGER on_user_profile_created AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();

CREATE TRIGGER update_transaction_patterns_updated_at BEFORE UPDATE ON public.transaction_patterns FOR EACH ROW EXECUTE FUNCTION public.update_transaction_patterns_updated_at();


  create policy "Users can delete their own files"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'uploads'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can read their own files"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'uploads'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can update their own files"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'uploads'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])))
with check (((bucket_id = 'uploads'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can upload their own files"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'uploads'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


