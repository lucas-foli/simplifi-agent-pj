ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_currency TEXT NOT NULL DEFAULT 'BRL';

ALTER TABLE profiles
  ADD CONSTRAINT profiles_display_currency_check
  CHECK (display_currency IN ('BRL', 'USD', 'CAD'));
