create or replace function public.amwemari_get_security_events(p_limit integer default 100)
returns table (
  id uuid,
  occurred_at timestamptz,
  event_type text,
  severity text,
  source text,
  actor_user_id uuid,
  tenant_id text,
  request_id text,
  remote_ip inet,
  user_agent text,
  summary text,
  details jsonb,
  fingerprint text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_amwemari_super_admin() then
    raise exception 'Super Admin access required' using errcode = '42501';
  end if;

  return query
  select e.id, e.occurred_at, e.event_type, e.severity, e.source,
         e.actor_user_id, e.tenant_id, e.request_id, e.remote_ip,
         e.user_agent, e.summary, e.details, e.fingerprint
  from private.security_events e
  order by e.occurred_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

revoke all on function public.amwemari_get_security_events(integer) from public, anon;
grant execute on function public.amwemari_get_security_events(integer) to authenticated;
