-- Evaluate auth and membership functions once per statement rather than once per row.
DROP POLICY IF EXISTS service_jobs_insert_member ON public.service_jobs;
CREATE POLICY service_jobs_insert_member ON public.service_jobs
FOR INSERT TO authenticated
WITH CHECK ((SELECT private.is_store_member(store_id)) AND created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS suppliers_insert_member ON public.suppliers;
CREATE POLICY suppliers_insert_member ON public.suppliers
FOR INSERT TO authenticated
WITH CHECK ((SELECT private.is_store_member(store_id)) AND created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS service_appointments_insert_member ON public.service_appointments;
CREATE POLICY service_appointments_insert_member ON public.service_appointments
FOR INSERT TO authenticated
WITH CHECK ((SELECT private.is_store_member(store_id)) AND created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS business_projects_insert_member ON public.business_projects;
CREATE POLICY business_projects_insert_member ON public.business_projects
FOR INSERT TO authenticated
WITH CHECK ((SELECT private.is_store_member(store_id)) AND created_by = (SELECT auth.uid()));
