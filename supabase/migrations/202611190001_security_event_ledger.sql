-- AMWEMARI security event ledger (DRAFT: review and apply only after Supabase access is restored)
-- Deliberately isolated from public API schemas. No client role receives access.
create schema if not exists private;

create table if not exists private.security_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  event_type text not null check (length(event_type) between 3 and 80),
  severity text not null check (severity in ('info','low','medium','high','critical')),
  source text not null check (source in ('server','auth','rate_limit','admin_action','client_signal')),
  actor_user_id uuid null,
  tenant_id text null,
  request_id text null,
  remote_ip inet null,
  user_agent text null check (user_agent is null or length(user_agent) <= 512),
  summary text not null check (length(summary) between 1 and 500),
  details jsonb not null default '{}'::jsonb
    check (pg_column_size(details) <= 8192),
  fingerprint text null check (fingerprint is null or length(fingerprint) <= 128)
);

create index if not exists security_events_occurred_at_idx
  on private.security_events (occurred_at desc);
create index if not exists security_events_severity_time_idx
  on private.security_events (severity, occurred_at desc);
create index if not exists security_events_actor_time_idx
  on private.security_events (actor_user_id, occurred_at desc);
create unique index if not exists security_events_fingerprint_uidx
  on private.security_events (fingerprint)
  where fingerprint is not null;

alter table private.security_events enable row level security;
alter table private.security_events force row level security;

revoke all on schema private from public, anon, authenticated;
revoke all on private.security_events from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert on private.security_events to service_role;

-- Defense in depth: the ledger is append-only. Retention/purge must be a separately
-- reviewed maintenance operation, never a normal application update/delete.
create or replace function private.reject_security_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'security event ledger is append-only';
end;
$$;

revoke all on function private.reject_security_event_mutation() from public, anon, authenticated;

drop trigger if exists security_events_no_mutation on private.security_events;
create trigger security_events_no_mutation
before update or delete on private.security_events
for each row execute function private.reject_security_event_mutation();

comment on table private.security_events is
  'Private append-only security incident ledger. Writes are server-side only; never store credentials, tokens, payment data, or file contents.';
