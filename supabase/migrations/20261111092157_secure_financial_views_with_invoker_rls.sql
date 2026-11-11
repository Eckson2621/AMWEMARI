-- Prevent financial views from bypassing the caller's row-level security.
ALTER VIEW public.store_financial_summary SET (security_invoker = true);
ALTER VIEW public.store_financial_daily SET (security_invoker = true);

REVOKE ALL ON TABLE public.store_financial_daily FROM anon;
REVOKE ALL ON TABLE public.store_financial_summary FROM anon;
GRANT SELECT ON TABLE public.store_financial_summary TO authenticated;
GRANT SELECT ON TABLE public.store_financial_daily TO authenticated;
