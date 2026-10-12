begin;
create function public.set_household_product_store(p_household uuid,p_product text,p_store uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.is_household_member(p_household) then raise exception 'not_a_household_member';end if;
 insert into public.household_shopping_preferences(household_id,product_key,store_id) values(p_household,p_product,p_store)
 on conflict(household_id,product_key) do update set store_id=excluded.store_id;
end;$$;
revoke all on function public.set_household_product_store(uuid,text,uuid) from public,anon;
grant execute on function public.set_household_product_store(uuid,text,uuid) to authenticated;
commit;
