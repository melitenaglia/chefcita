begin;
create table public.household_shopping_items (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 item_key text not null check(length(item_key) between 1 and 200),
 recipe_id uuid,
 recipe_title text check(length(recipe_title)<=500),
 name text not null check(length(trim(name)) between 1 and 500),
 quantity text not null default '' check(length(quantity)<=200),
 note text not null default '' check(length(note)<=1000),
 portions numeric check(portions>0 and portions<=1000),
 done boolean not null default false,
 added_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(household_id,item_key)
);
alter table public.household_shopping_items enable row level security;
create policy shopping_member_select on public.household_shopping_items for select to authenticated using(private.is_household_member(household_id));
create policy shopping_member_insert on public.household_shopping_items for insert to authenticated with check(private.is_household_member(household_id) and added_by=(select auth.uid()));
create policy shopping_member_update on public.household_shopping_items for update to authenticated using(private.is_household_member(household_id)) with check(private.is_household_member(household_id));
create policy shopping_member_delete on public.household_shopping_items for delete to authenticated using(private.is_household_member(household_id));
revoke all on public.household_shopping_items from anon,authenticated;
grant select,insert,delete on public.household_shopping_items to authenticated;
grant update(done,quantity,note,portions) on public.household_shopping_items to authenticated;
create function public.add_household_shopping_items(p_household uuid,p_items jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if auth.uid() is null or not private.is_household_member(p_household) then raise exception 'not_a_household_member';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>500 then raise exception 'invalid_items';end if;
 insert into public.household_shopping_items(household_id,item_key,recipe_id,recipe_title,name,quantity,note,portions,added_by)
 select p_household,item->>'id',nullif(item->>'recipeId','')::uuid,item->>'recipeTitle',item->>'name',coalesce(item->>'quantity',''),coalesce(item->>'note',''),nullif(item->>'portions','')::numeric,auth.uid()
 from jsonb_array_elements(p_items) item
 on conflict(household_id,item_key) do update set quantity=excluded.quantity,note=excluded.note,portions=excluded.portions;
 get diagnostics affected=row_count;return affected;
end;$$;
revoke all on function public.add_household_shopping_items(uuid,jsonb) from public,anon;
grant execute on function public.add_household_shopping_items(uuid,jsonb) to authenticated;
commit;
