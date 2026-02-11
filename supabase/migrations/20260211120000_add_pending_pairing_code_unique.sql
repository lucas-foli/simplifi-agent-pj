CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_links_pairing_code_pending_unique
  ON public.whatsapp_links(pairing_code)
  WHERE status = 'pending';
