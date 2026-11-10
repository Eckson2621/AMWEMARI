create table if not exists public.suppliers (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 name text not null,
 contact_person text,
 phone text,
 email text,
 address text,
 tax_number text,
 notes text,
 is_active boolean not null default true,
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists suppliers_store_name_idx on public.suppliers(store_id, name);
alter table public.suppliers enable row level security;
drop policy if exists suppliers_select_member on public.suppliers;
create policy suppliers_select_member on public.suppliers for select to authenticated using (private.is_store_member(store_id));
drop policy if exists suppliers_insert_member on public.suppliers;
create policy suppliers_insert_member on public.suppliers for insert to authenticated with check (private.is_store_member(store_id) and created_by = auth.uid());
drop policy if exists suppliers_update_owner on public.suppliers;
create policy suppliers_update_owner on public.suppliers for update to authenticated using (private.is_store_owner(store_id)) with check (private.is_store_owner(store_id));
drop policy if exists suppliers_delete_owner on public.suppliers;
create policy suppliers_delete_owner on public.suppliers for delete to authenticated using (private.is_store_owner(store_id));
grant select, insert, update, delete on public.suppliers to authenticated;

create table if not exists public.service_appointments (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 customer_id uuid references public.customers(id) on delete set null,
 customer_name text not null,
 customer_phone text,
 service_name text not null,
 assigned_to uuid,
 starts_at timestamptz not null,
 ends_at timestamptz,
 status text not null default 'booked' check (status in ('booked','confirmed','in_progress','completed','cancelled','no_show')),
 price numeric(14,2) not null default 0 check (price >= 0),
 notes text,
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint service_appointments_valid_time check (ends_at is null or ends_at > starts_at)
);
create index if not exists service_appointments_store_start_idx on public.service_appointments(store_id, starts_at);
create index if not exists service_appointments_store_status_idx on public.service_appointments(store_id, status);
alter table public.service_appointments enable row level security;
drop policy if exists service_appointments_select_member on public.service_appointments;
create policy service_appointments_select_member on public.service_appointments for select to authenticated using (private.is_store_member(store_id));
drop policy if exists service_appointments_insert_member on public.service_appointments;
create policy service_appointments_insert_member on public.service_appointments for insert to authenticated with check (private.is_store_member(store_id) and created_by = auth.uid());
drop policy if exists service_appointments_update_owner on public.service_appointments;
create policy service_appointments_update_owner on public.service_appointments for update to authenticated using (private.is_store_owner(store_id)) with check (private.is_store_owner(store_id));
drop policy if exists service_appointments_delete_owner on public.service_appointments;
create policy service_appointments_delete_owner on public.service_appointments for delete to authenticated using (private.is_store_owner(store_id));
grant select, insert, update, delete on public.service_appointments to authenticated;

create table if not exists public.service_jobs (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 customer_id uuid references public.customers(id) on delete set null,
 appointment_id uuid references public.service_appointments(id) on delete set null,
 job_number text,
 title text not null,
 description text,
 assigned_to uuid,
 status text not null default 'open' check (status in ('open','in_progress','waiting_parts','completed','cancelled')),
 estimated_cost numeric(14,2) not null default 0 check (estimated_cost >= 0),
 final_cost numeric(14,2) not null default 0 check (final_cost >= 0),
 opened_at timestamptz not null default now(),
 due_at timestamptz,
 completed_at timestamptz,
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists service_jobs_store_status_idx on public.service_jobs(store_id, status);
create index if not exists service_jobs_store_due_idx on public.service_jobs(store_id, due_at);
alter table public.service_jobs enable row level security;
drop policy if exists service_jobs_select_member on public.service_jobs;
create policy service_jobs_select_member on public.service_jobs for select to authenticated using (private.is_store_member(store_id));
drop policy if exists service_jobs_insert_member on public.service_jobs;
create policy service_jobs_insert_member on public.service_jobs for insert to authenticated with check (private.is_store_member(store_id) and created_by = auth.uid());
drop policy if exists service_jobs_update_owner on public.service_jobs;
create policy service_jobs_update_owner on public.service_jobs for update to authenticated using (private.is_store_owner(store_id)) with check (private.is_store_owner(store_id));
drop policy if exists service_jobs_delete_owner on public.service_jobs;
create policy service_jobs_delete_owner on public.service_jobs for delete to authenticated using (private.is_store_owner(store_id));
grant select, insert, update, delete on public.service_jobs to authenticated;

create table if not exists public.business_projects (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 customer_id uuid references public.customers(id) on delete set null,
 project_name text not null,
 project_code text,
 description text,
 status text not null default 'planning' check (status in ('planning','active','on_hold','completed','cancelled')),
 budget numeric(14,2) not null default 0 check (budget >= 0),
 actual_cost numeric(14,2) not null default 0 check (actual_cost >= 0),
 start_date date,
 due_date date,
 completed_at timestamptz,
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists business_projects_store_status_idx on public.business_projects(store_id, status);
alter table public.business_projects enable row level security;
drop policy if exists business_projects_select_member on public.business_projects;
create policy business_projects_select_member on public.business_projects for select to authenticated using (private.is_store_member(store_id));
drop policy if exists business_projects_insert_member on public.business_projects;
create policy business_projects_insert_member on public.business_projects for insert to authenticated with check (private.is_store_member(store_id) and created_by = auth.uid());
drop policy if exists business_projects_update_owner on public.business_projects;
create policy business_projects_update_owner on public.business_projects for update to authenticated using (private.is_store_owner(store_id)) with check (private.is_store_owner(store_id));
drop policy if exists business_projects_delete_owner on public.business_projects;
create policy business_projects_delete_owner on public.business_projects for delete to authenticated using (private.is_store_owner(store_id));
grant select, insert, update, delete on public.business_projects to authenticated;