DO $$ BEGIN
  CREATE TYPE public.whatsapp_link_status AS ENUM ('pending', 'linked', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.whatsapp_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES pj.companies(id) ON DELETE SET NULL,
  phone TEXT,
  status public.whatsapp_link_status NOT NULL DEFAULT 'pending',
  pairing_code TEXT NOT NULL,
  pairing_expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own WhatsApp links"
  ON public.whatsapp_links FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own WhatsApp links"
  ON public.whatsapp_links FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own WhatsApp links"
  ON public.whatsapp_links FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE INDEX IF NOT EXISTS whatsapp_links_profile_id_idx
  ON public.whatsapp_links(profile_id);

CREATE INDEX IF NOT EXISTS whatsapp_links_company_id_idx
  ON public.whatsapp_links(company_id);

CREATE INDEX IF NOT EXISTS whatsapp_links_pairing_code_idx
  ON public.whatsapp_links(pairing_code);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_links_pairing_code_pending_unique
  ON public.whatsapp_links(pairing_code)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_links_phone_unique
  ON public.whatsapp_links(phone)
  WHERE phone IS NOT NULL AND status = 'linked';

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_events_message_direction_key
  ON public.whatsapp_events(message_id, direction);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_whatsapp_links_updated_at'
  ) THEN
    CREATE TRIGGER update_whatsapp_links_updated_at
      BEFORE UPDATE ON public.whatsapp_links
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;
