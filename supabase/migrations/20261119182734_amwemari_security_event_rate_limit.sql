create table if not exists private.security_event_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  event_count integer not null check (event_count >= 1),
  updated_at timestamptz not null default now()
);
alter table private.security_event_rate_limits enable row level security;
alter table private.security_event_rate_limits force row level security;
revoke all on private.security_event_rate_limits from public, anon, authenticated;
grant select, insert, update on private.security_event_rate_limits to service_role;
create or replace function public.amwemari_record_security_event(
  p_event_type text, p_severity text, p_source text, p_summary text,
  p_actor_user_id uuid default null, p_request_id text default null,
  p_user_agent text default null, p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer;
  v_bucket text;
begin
  if length(coalesce(p_event_type, '')) not between 3 and 80
     or p_severity not in ('info','low','medium','high','critical')
     or p_source not in ('server','auth','rate_limit','admin_action','client_signal')
     or length(coalesce(p_summary, '')) not between 1 and 500
     or length(coalesce(p_request_id, '')) > 100
     or length(coalesce(p_user_agent, '')) > 512
     or pg_column_size(coalesce(p_details, '{}'::jsonb)) > 8192 then
    raise exception 'Invalid security event payload' using errcode = '22023';
  end if;
  v_bucket := coalesce(p_actor_user_id::text, 'system') || ':' || p_event_type;
  insert into private.security_event_rate_limits(bucket_key, window_started_at, event_count, updated_at)
  values (v_bucket, now(), 1, now())
  on conflict (bucket_key) do update
  set window_started_at = case
        when private.security_event_rate_limits.window_started_at <= now() - interval '5 minutes' then now()
        else private.security_event_rate_limits.window_started_at end,
      event_count = case
        when private.security_event_rate_limits.window_started_at <= now() - interval '5 minutes' then 1
        else private.security_event_rate_limits.event_count + 1 end,
      updated_at = now()
  returning event_count into v_count;
  if v_count > 20 then
    insert into private.security_events(
      event_type, severity, source, actor_user_id, summary, details, fingerprint
    ) values (
      'cyber_admin_event_rate_limited', 'high', 'rate_limit', p_actor_user_id,
      'Repeated security event writes were throttled by the server.',
      jsonb_build_object('blocked_event_type', p_event_type, 'window_minutes', 5, 'threshold', 20),
      'rl:' || md5(v_bucket) || ':' || floor(extract(epoch from now()) / 300)::bigint::text
    ) on conflict (fingerprint) where fingerprint is not null do nothing;
    return null;
  end if;
  insert into private.security_events (
    event_type, severity, source, summary, actor_user_id,
    request_id, user_agent, details
  ) values (
    p_event_type, p_severity, p_source, p_summary, p_actor_user_id,
    nullif(p_request_id, ''), nullif(p_user_agent, ''),
    coalesce(p_details, '{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.amwemari_record_security_event(text,text,text,text,uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.amwemari_record_security_event(text,text,text,text,uuid,text,text,jsonb) to service_role;
