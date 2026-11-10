-- Additive, non-destructive support for business-specific product attributes.
-- Existing products retain all values; each existing row receives an empty JSON object.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_details jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.products.product_details IS
  'Optional business-specific product attributes, such as vehicle make, model, year, chassis and registration details.';
