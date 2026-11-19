create or replace function public.amwemari_get_security_events(p_admin_user_id uuid, p_limit integer default 100)
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
  if p_admin_user_id is null or not exists (
    select 1
    from public.amwemari_super_admins a
    join auth.users u on u.id = a.user_id
    where a.user_id = p_admin_user_id
      and lower(a.email) = 'mwalimueckson2104@gmail.com'
      and lower(coalesce(u.email, '')) = 'mwalimueckson2104@gmail.com'
  ) then
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

revoke all on function public.amwemari_get_security_events(uuid, integer) from public, anon, authenticated;
grant execute on function public.amwemari_get_security_events(uuid, integer) to service_role;
