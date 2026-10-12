begin;
create table public.household_shopping_stores (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100), unique(id,household_id)
);
create unique index household_store_name on public.household_shopping_stores(household_id,lower(trim(name)));
alter table public.household_shopping_stores enable row level security;
create policy stores_read on public.household_shopping_stores for select to authenticated using(private.is_household_member(household_id));
create policy stores_insert on public.household_shopping_stores for insert to authenticated with check(private.is_household_member(household_id));
create policy stores_update on public.household_shopping_stores for update to authenticated using(private.is_household_member(household_id)) with check(private.is_household_member(household_id));
revoke all on public.household_shopping_stores from anon,authenticated;
grant select,insert on public.household_shopping_stores to authenticated;
grant update(name) on public.household_shopping_stores to authenticated;
alter table public.household_shopping_items add column store_id uuid;
alter table public.household_shopping_items add constraint shopping_store_same_house foreign key(store_id,household_id) references public.household_shopping_stores(id,household_id);
grant update(store_id) on public.household_shopping_items to authenticated;
create index household_shopping_store on public.household_shopping_items(store_id,household_id);
create table public.household_shopping_preferences (
 household_id uuid not null references public.households(id) on delete cascade,
 product_key text not null check(length(product_key) between 1 and 500), store_id uuid,
 primary key(household_id,product_key),
 foreign key(store_id,household_id) references public.household_shopping_stores(id,household_id)
);
alter table public.household_shopping_preferences enable row level security;
create policy preferences_read on public.household_shopping_preferences for select to authenticated using(private.is_household_member(household_id));
create policy preferences_insert on public.household_shopping_preferences for insert to authenticated with check(private.is_household_member(household_id));
create policy preferences_update on public.household_shopping_preferences for update to authenticated using(private.is_household_member(household_id)) with check(private.is_household_member(household_id));
revoke all on public.household_shopping_preferences from anon,authenticated;
grant select,insert on public.household_shopping_preferences to authenticated;
grant update(store_id) on public.household_shopping_preferences to authenticated;
create index household_preference_store on public.household_shopping_preferences(store_id,household_id);
create or replace function public.add_household_shopping_items(p_household uuid,p_items jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if auth.uid() is null or not private.is_household_member(p_household) then raise exception 'not_a_household_member';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>500 then raise exception 'invalid_items';end if;
 insert into public.household_shopping_items(household_id,item_key,recipe_id,recipe_title,name,quantity,note,portions,added_by,store_id)
 select p_household,item->>'id',nullif(item->>'recipeId','')::uuid,item->>'recipeTitle',item->>'name',coalesce(item->>'quantity',''),coalesce(item->>'note',''),nullif(item->>'portions','')::numeric,auth.uid(),
 (select p.store_id from public.household_shopping_preferences p where p.household_id=p_household and p.product_key=coalesce(item->>'productKey',lower(trim(item->>'name'))))
 from jsonb_array_elements(p_items) item
 on conflict(household_id,item_key) do update set quantity=excluded.quantity,note=excluded.note,portions=excluded.portions;
 get diagnostics affected=row_count;return affected;
end;$$;
commit;
