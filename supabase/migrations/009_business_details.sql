alter table public.organizations
  add column if not exists address text;

create or replace function public.update_organization_details(
  p_org_id uuid,
  p_name text,
  p_address text
)
returns public.organizations
language plpgsql security definer set search_path = public
as $$
declare result public.organizations;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and org_id = p_org_id and role in ('owner', 'admin') and is_active) then
    raise exception 'Workspace administrator required';
  end if;
  if length(trim(p_name)) < 2 then raise exception 'Business name must contain at least 2 characters'; end if;
  update public.organizations
  set name = trim(p_name), address = nullif(trim(p_address), ''), updated_at = now()
  where id = p_org_id
  returning * into result;
  return result;
end;
$$;

grant execute on function public.update_organization_details(uuid, text, text) to authenticated;