-- Playlist membership is independent of recipe ownership. Never grants edit rights.
-- Restricted mutations stay in the private schema, behind authenticated invoker RPCs.
create or replace function private.set_library_recipe(p_recipe_id uuid,p_household_id uuid,p_added boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'not_authenticated'; end if;
 if p_added is null then raise exception 'added_required'; end if;
 if not exists(select 1 from public.household_members where household_id=p_household_id and user_id=v_user) then
  raise exception 'not_library_member';
 end if;
 if p_added then
  if not private.can_access_recipe(p_recipe_id) then raise exception 'recipe_not_accessible'; end if;
  if not exists(select 1 from public.recipes where id=p_recipe_id and review_status='recipe') then raise exception 'recipe_not_reviewed'; end if;
  insert into public.recipe_library_shares(recipe_id,household_id,shared_by)
   values(p_recipe_id,p_household_id,v_user) on conflict(recipe_id,household_id) do nothing;
 else
  delete from public.recipe_library_shares where recipe_id=p_recipe_id and household_id=p_household_id;
 end if;
end;
$$;
revoke all on function private.set_library_recipe(uuid,uuid,boolean) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.set_library_recipe(uuid,uuid,boolean) to authenticated;
create or replace function public.set_library_recipe(p_recipe_id uuid,p_household_id uuid,p_added boolean)
returns void language sql security invoker set search_path='' as $$
 select private.set_library_recipe(p_recipe_id,p_household_id,p_added);
$$;
revoke all on function public.set_library_recipe(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_library_recipe(uuid,uuid,boolean) to authenticated;

create or replace function private.manage_recipe_library(p_household_id uuid,p_action text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_role text;
begin
 if v_user is null then raise exception 'not_authenticated'; end if;
 select role into v_role from public.household_members where household_id=p_household_id and user_id=v_user;
 if v_role is null then raise exception 'not_library_member'; end if;
 if p_action='delete' then
  if v_role<>'owner' then raise exception 'library_owner_required'; end if;
  -- Foreign keys remove membership/invites/shares, never the recipes themselves.
  delete from public.households where id=p_household_id;
 elsif p_action='leave' then
  if v_role='owner' then raise exception 'owner_cannot_leave'; end if;
  delete from public.household_members where household_id=p_household_id and user_id=v_user;
 else raise exception 'invalid_library_action';
 end if;
end;
$$;
revoke all on function private.manage_recipe_library(uuid,text) from public,anon;
grant execute on function private.manage_recipe_library(uuid,text) to authenticated;
create or replace function public.manage_recipe_library(p_household_id uuid,p_action text)
returns void language sql security invoker set search_path='' as $$
 select private.manage_recipe_library(p_household_id,p_action);
$$;
revoke all on function public.manage_recipe_library(uuid,text) from public,anon;
grant execute on function public.manage_recipe_library(uuid,text) to authenticated;
