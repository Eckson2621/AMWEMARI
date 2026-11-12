-- Enforce same-store references for the shared service and project modules.
-- This is additive: no existing rows are rewritten or removed.
alter table public.service_appointments
  add constraint service_appointments_id_store_unique unique (id, store_id);

alter table public.service_appointments
  add constraint service_appointments_customer_same_store_fk
  foreign key (customer_id, store_id)
  references public.customers (id, store_id)
  on delete set null (customer_id);

alter table public.service_jobs
  add constraint service_jobs_customer_same_store_fk
  foreign key (customer_id, store_id)
  references public.customers (id, store_id)
  on delete set null (customer_id);

alter table public.service_jobs
  add constraint service_jobs_appointment_same_store_fk
  foreign key (appointment_id, store_id)
  references public.service_appointments (id, store_id)
  on delete set null (appointment_id);

alter table public.business_projects
  add constraint business_projects_customer_same_store_fk
  foreign key (customer_id, store_id)
  references public.customers (id, store_id)
  on delete set null (customer_id);
