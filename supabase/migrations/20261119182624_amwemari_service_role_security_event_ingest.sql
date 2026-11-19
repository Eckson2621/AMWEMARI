create or replace function public.amwemari_record_security_event(
  p_event_type text,
  p_severity text,
  p_source text,
  p_summary text,
  p_actor_user_id uuid default null,
  p_request_id text default null,
  p_user_agent text default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
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

comment on function public.amwemari_record_security_event(text,text,text,text,uuid,text,text,jsonb) is
  'Service-role-only validated ingress into private append-only security event ledger.';
