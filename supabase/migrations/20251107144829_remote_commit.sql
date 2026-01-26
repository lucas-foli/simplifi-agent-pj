drop trigger if exists "update_conversations_updated_at" on "public"."conversations";

drop trigger if exists "update_fixed_costs_updated_at" on "public"."fixed_costs";

drop trigger if exists "on_user_profile_created" on "public"."profiles";

drop trigger if exists "update_profiles_updated_at" on "public"."profiles";

drop trigger if exists "update_transaction_patterns_updated_at" on "public"."transaction_patterns";

drop trigger if exists "update_transactions_updated_at" on "public"."transactions";

drop policy if exists "Users can insert messages to their conversations" on "public"."messages";

drop policy if exists "Users can view messages from their conversations" on "public"."messages";

alter table "pj"."companies" drop constraint "companies_created_by_fkey";

alter table "pj"."company_fixed_costs" drop constraint "company_fixed_costs_created_by_fkey";

alter table "pj"."company_members" drop constraint "company_members_invited_by_fkey";

alter table "pj"."company_members" drop constraint "company_members_profile_id_fkey";

alter table "pj"."company_transactions" drop constraint "company_transactions_created_by_fkey";

alter table "public"."categories" drop constraint "categories_user_id_fkey";

alter table "public"."classification_rules" drop constraint "classification_rules_category_id_fkey";

alter table "public"."classification_rules" drop constraint "classification_rules_user_id_fkey";

alter table "public"."conversations" drop constraint "conversations_user_id_fkey";

alter table "public"."fixed_costs" drop constraint "fixed_costs_category_id_fkey";

alter table "public"."fixed_costs" drop constraint "fixed_costs_user_id_fkey";

alter table "public"."messages" drop constraint "messages_conversation_id_fkey";

alter table "public"."transaction_patterns" drop constraint "transaction_patterns_user_id_fkey";

alter table "public"."transactions" drop constraint "transactions_category_id_fkey";

alter table "public"."transactions" drop constraint "transactions_fixed_cost_id_fkey";

alter table "public"."transactions" drop constraint "transactions_user_id_fkey";

drop view if exists "public"."companies";

drop view if exists "public"."company_transactions";

drop view if exists "public"."users_decrypted";

alter table "pj"."company_fixed_costs" add column "payment_method" text;

alter table "pj"."company_transactions" alter column "type" set data type public.transaction_type using "type"::text::public.transaction_type;

alter table "public"."profiles" alter column "user_type" set data type public.user_type using "user_type"::text::public.user_type;

alter table "public"."transactions" alter column "type" set data type public.transaction_type using "type"::text::public.transaction_type;

alter table "pj"."companies" add constraint "companies_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "pj"."companies" validate constraint "companies_created_by_fkey";

alter table "pj"."company_fixed_costs" add constraint "company_fixed_costs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "pj"."company_fixed_costs" validate constraint "company_fixed_costs_created_by_fkey";

alter table "pj"."company_members" add constraint "company_members_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "pj"."company_members" validate constraint "company_members_invited_by_fkey";

alter table "pj"."company_members" add constraint "company_members_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "pj"."company_members" validate constraint "company_members_profile_id_fkey";

alter table "pj"."company_transactions" add constraint "company_transactions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "pj"."company_transactions" validate constraint "company_transactions_created_by_fkey";

alter table "public"."categories" add constraint "categories_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."categories" validate constraint "categories_user_id_fkey";

alter table "public"."classification_rules" add constraint "classification_rules_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE not valid;

alter table "public"."classification_rules" validate constraint "classification_rules_category_id_fkey";

alter table "public"."classification_rules" add constraint "classification_rules_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."classification_rules" validate constraint "classification_rules_user_id_fkey";

alter table "public"."conversations" add constraint "conversations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."conversations" validate constraint "conversations_user_id_fkey";

alter table "public"."fixed_costs" add constraint "fixed_costs_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL not valid;

alter table "public"."fixed_costs" validate constraint "fixed_costs_category_id_fkey";

alter table "public"."fixed_costs" add constraint "fixed_costs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."fixed_costs" validate constraint "fixed_costs_user_id_fkey";

alter table "public"."messages" add constraint "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_conversation_id_fkey";

alter table "public"."transaction_patterns" add constraint "transaction_patterns_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."transaction_patterns" validate constraint "transaction_patterns_user_id_fkey";

alter table "public"."transactions" add constraint "transactions_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL not valid;

alter table "public"."transactions" validate constraint "transactions_category_id_fkey";

alter table "public"."transactions" add constraint "transactions_fixed_cost_id_fkey" FOREIGN KEY (fixed_cost_id) REFERENCES public.fixed_costs(id) ON DELETE SET NULL not valid;

alter table "public"."transactions" validate constraint "transactions_fixed_cost_id_fkey";

alter table "public"."transactions" add constraint "transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."transactions" validate constraint "transactions_user_id_fkey";

create or replace view "public"."companies" as  SELECT id,
    name,
    activity,
    trade_name,
    created_by,
    cnpj_encrypted,
    public.decrypt_sensitive(cnpj_encrypted) AS cnpj,
    email,
    phone,
    monthly_revenue,
    metadata,
    created_at,
    updated_at
   FROM pj.companies c;


create or replace view "public"."company_transactions" as  SELECT id,
    company_id,
    description,
    amount,
    type,
    date,
    category_id,
    payment_method,
    notes,
    created_by,
    created_at,
    updated_at
   FROM pj.company_transactions;


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



  create policy "Users can insert messages to their conversations"
  on "public"."messages"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.conversations
  WHERE ((conversations.id = messages.conversation_id) AND (conversations.user_id = auth.uid())))));



  create policy "Users can view messages from their conversations"
  on "public"."messages"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.conversations
  WHERE ((conversations.id = messages.conversation_id) AND (conversations.user_id = auth.uid())))));


CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fixed_costs_updated_at BEFORE UPDATE ON public.fixed_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_user_profile_created AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transaction_patterns_updated_at BEFORE UPDATE ON public.transaction_patterns FOR EACH ROW EXECUTE FUNCTION public.update_transaction_patterns_updated_at();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

drop trigger if exists "on_auth_user_created" on "auth"."users";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

