begin;

-- Chefcita previously treated household_members as a single "home" per user.
-- Shared libraries reuse the same tables/RLS model but allow a user to belong
-- to multiple shared spaces.

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid='public.household_members'::regclass
      and contype='u'
      and replace(pg_get_constraintdef(oid),' ','')='UNIQUE(user_id)'
  loop
    execute format('alter table public.household_members drop constraint %I',v_constraint.conname);
  end loop;
end;
$$;

create unique index if not exists household_members_household_user_uidx
  on public.household_members(household_id,user_id);

create or replace function public.create_shared_library(p_name text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_name text:=nullif(trim(p_name),'');
  v_library uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if v_name is null then
    raise exception 'library_name_required';
  end if;

  insert into public.households(name,created_by)
  values(v_name,v_user)
  returning id into v_library;

  insert into public.household_members(household_id,user_id,role)
  values(v_library,v_user,'owner')
  on conflict (household_id,user_id) do nothing;

  return v_library;
end;
$$;

revoke all on function public.create_shared_library(text) from public,anon;
grant execute on function public.create_shared_library(text) to authenticated;

comment on function public.create_shared_library(text)
is 'Creates a shared recipe library backed by households/household_members.';

commit;
