-- Add value_tag column to company_categories for essential/optional classification
ALTER TABLE public.company_categories
  ADD COLUMN value_tag text DEFAULT NULL
  CONSTRAINT company_categories_value_tag_check CHECK (value_tag IN ('essential', 'optional'));

ALTER TABLE pj.company_categories
  ADD COLUMN value_tag text DEFAULT NULL
  CONSTRAINT company_categories_value_tag_check CHECK (value_tag IN ('essential', 'optional'));
