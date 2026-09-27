begin;

-- Chefcita shared libraries reuse the existing household tables for membership,
-- but users may now belong to more than one library.
do $$
declare
  v_item record;
begin
  for v_item in
    select conname
    from pg_constraint
    where conrelid='public.household_members'::regclass
      and contype='u'
      and replace(pg_get_constraintdef(oid),' ','')='UNIQUE(user_id)'
  loop
    execute format('alter table public.household_members drop constraint %I',v_item.conname);
  end loop;

  for v_item in
    select idx.relname as index_name
    from pg_index pi
    join pg_class idx on idx.oid=pi.indexrelid
    where pi.indrelid='public.household_members'::regclass
      and pi.indisunique
      and pi.indnatts=1
      and exists (
        select 1
        from pg_attribute a
        where a.attrelid=pi.indrelid
          and a.attname='user_id'
          and a.attnum=any(pi.indkey::smallint[])
      )
      and not exists (
        select 1 from pg_constraint c where c.conindid=pi.indexrelid
      )
  loop
    execute format('drop index if exists public.%I',v_item.index_name);
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

create or replace function public.accept_shared_library_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_email text;
  v_invite public.household_invites;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select email
  into v_email
  from auth.users
  where id=v_user;

  select *
  into v_invite
  from public.household_invites
  where token::text=p_token
    and accepted_at is null
    and (expires_at is null or expires_at>now())
  for update;

  if not found then
    raise exception 'invite_invalid_or_expired';
  end if;

  if lower(coalesce(v_invite.invited_email,''))<>lower(coalesce(v_email,'')) then
    raise exception 'invite_email_mismatch';
  end if;

  insert into public.household_members(household_id,user_id,role)
  values(v_invite.household_id,v_user,'member')
  on conflict (household_id,user_id) do nothing;

  update public.household_invites
  set accepted_at=now()
  where id=v_invite.id;

  return v_invite.household_id;
end;
$$;

revoke all on function public.accept_shared_library_invite(text) from public,anon;
grant execute on function public.accept_shared_library_invite(text) to authenticated;

-- Recipes always stay personal. Sharing only grants read access to a library.
create table if not exists public.recipe_library_shares (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  shared_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key(recipe_id,household_id)
);

alter table public.recipe_library_shares enable row level security;

-- Convert the old single-household model without losing access.
insert into public.recipe_library_shares(recipe_id,household_id,shared_by)
select r.id,r.household_id,r.owner_id
from public.recipes r
where r.household_id is not null
on conflict (recipe_id,household_id) do nothing;

update public.recipes
set household_id=null,
    visibility='private'
where household_id is not null;

update public.imports
set household_id=null
where household_id is not null;

drop policy if exists recipe_library_shares_select on public.recipe_library_shares;
create policy recipe_library_shares_select
on public.recipe_library_shares
for select
to authenticated
using (
  shared_by=auth.uid()
  or exists (
    select 1
    from public.household_members hm
    where hm.household_id=recipe_library_shares.household_id
      and hm.user_id=auth.uid()
  )
);

drop policy if exists recipe_library_shares_insert on public.recipe_library_shares;
create policy recipe_library_shares_insert
on public.recipe_library_shares
for insert
to authenticated
with check (
  shared_by=auth.uid()
  and exists (
    select 1
    from public.recipes r
    where r.id=recipe_library_shares.recipe_id
      and r.owner_id=auth.uid()
  )
  and exists (
    select 1
    from public.household_members hm
    where hm.household_id=recipe_library_shares.household_id
      and hm.user_id=auth.uid()
  )
);

drop policy if exists recipe_library_shares_delete on public.recipe_library_shares;
create policy recipe_library_shares_delete
on public.recipe_library_shares
for delete
to authenticated
using (
  exists (
    select 1
    from public.recipes r
    where r.id=recipe_library_shares.recipe_id
      and r.owner_id=auth.uid()
  )
);

-- Shared members can read the recipe itself. Existing UPDATE/DELETE policies
-- are intentionally untouched, so sharing never grants recipe editing.
drop policy if exists recipes_shared_library_read on public.recipes;
create policy recipes_shared_library_read
on public.recipes
for select
to authenticated
using (
  exists (
    select 1
    from public.recipe_library_shares rls
    join public.household_members hm on hm.household_id=rls.household_id
    where rls.recipe_id=recipes.id
      and hm.user_id=auth.uid()
  )
);

-- Related recipe content is also read-only for shared members.
drop policy if exists recipe_ingredients_shared_library_read on public.recipe_ingredients;
create policy recipe_ingredients_shared_library_read
on public.recipe_ingredients
for select
to authenticated
using (
  exists (
    select 1
    from public.recipe_library_shares rls
    join public.household_members hm on hm.household_id=rls.household_id
    where rls.recipe_id=recipe_ingredients.recipe_id
      and hm.user_id=auth.uid()
  )
);

drop policy if exists recipe_steps_shared_library_read on public.recipe_steps;
create policy recipe_steps_shared_library_read
on public.recipe_steps
for select
to authenticated
using (
  exists (
    select 1
    from public.recipe_library_shares rls
    join public.household_members hm on hm.household_id=rls.household_id
    where rls.recipe_id=recipe_steps.recipe_id
      and hm.user_id=auth.uid()
  )
);

drop policy if exists recipe_sources_shared_library_read on public.recipe_sources;
create policy recipe_sources_shared_library_read
on public.recipe_sources
for select
to authenticated
using (
  exists (
    select 1
    from public.recipe_library_shares rls
    join public.household_members hm on hm.household_id=rls.household_id
    where rls.recipe_id=recipe_sources.recipe_id
      and hm.user_id=auth.uid()
  )
);

drop policy if exists recipe_tags_shared_library_read on public.recipe_tags;
create policy recipe_tags_shared_library_read
on public.recipe_tags
for select
to authenticated
using (
  exists (
    select 1
    from public.recipe_library_shares rls
    join public.household_members hm on hm.household_id=rls.household_id
    where rls.recipe_id=recipe_tags.recipe_id
      and hm.user_id=auth.uid()
  )
);

commit;
