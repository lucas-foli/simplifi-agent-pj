-- Add due_day column to the actual table in pj schema
ALTER TABLE pj.company_fixed_costs
  ADD COLUMN due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31);

-- Recreate the public view to include the new column
CREATE OR REPLACE VIEW public.company_fixed_costs AS
  SELECT id,
    company_id,
    description,
    amount,
    category_id,
    created_by,
    created_at,
    updated_at,
    due_day
  FROM pj.company_fixed_costs;

-- Table to track sent reminders and avoid duplicates
CREATE TABLE public.cost_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_cost_id UUID NOT NULL,
  company_id UUID NOT NULL,
  phone TEXT NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('5_days', '3_days', '1_day')),
  due_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_id TEXT,
  UNIQUE (fixed_cost_id, reminder_type, due_date)
);

-- Index for efficient lookup when checking if reminder was already sent
CREATE INDEX idx_cost_reminder_logs_lookup
  ON public.cost_reminder_logs (fixed_cost_id, due_date, reminder_type);

-- RLS on cost_reminder_logs
ALTER TABLE public.cost_reminder_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Service role can manage reminder logs"
  ON public.cost_reminder_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
