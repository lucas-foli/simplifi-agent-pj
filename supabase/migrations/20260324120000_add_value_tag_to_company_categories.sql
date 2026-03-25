-- Add value_tag column to pj.company_categories (the actual table)
ALTER TABLE pj.company_categories
  ADD COLUMN value_tag text DEFAULT NULL
  CONSTRAINT company_categories_value_tag_check CHECK (value_tag IN ('essential', 'optional'));

-- Recreate the public view so the new column is exposed via PostgREST
CREATE OR REPLACE VIEW public.company_categories AS
  SELECT * FROM pj.company_categories;
