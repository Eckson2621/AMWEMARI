create table if not exists public.cyber_admin_devices (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  device_key text not null,
  device_label text not null,
  platform text not null check (platform in ('android','windows','macos','linux','ios','web','unknown')),
  proof_hash text not null,
  status text not null default 'active' check (status in ('active','revoked')),
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (admin_user_id, device_key),
  constraint cyber_admin_devices_device_key_len check (length(device_key) between 16 and 128),
  constraint cyber_admin_devices_label_len check (length(device_label) between 1 and 100)
);
alter table public.cyber_admin_devices enable row level security;
alter table public.cyber_admin_devices force row level security;
revoke all on public.cyber_admin_devices from anon, authenticated;
grant select, insert, update, delete on public.cyber_admin_devices to service_role;
comment on table public.cyber_admin_devices is 'Private-by-grants registry of devices enrolled by the fixed AMWEMARI Super Admin. Access only through the authenticated Cyber Admin Edge Function.';
create index if not exists cyber_admin_devices_admin_status_idx
 on public.cyber_admin_devices (admin_user_id, status, last_seen_at desc);
