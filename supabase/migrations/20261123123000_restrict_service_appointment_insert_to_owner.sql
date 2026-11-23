-- Additive role guard for appointment creation.
-- The existing permissive member policy remains in place; this restrictive
-- policy is ANDed with it so only an active store owner can insert appointments.
-- This migration is staged on the preview branch only and has not been applied.
CREATE POLICY service_appointments_insert_owner_guard
ON public.service_appointments
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_store_owner(store_id)
  AND created_by = auth.uid()
);
