-- No in-app 18+ confirmation any more. Signing up still records which version of
-- the Terms and Privacy Policy the person agreed to (sign-up sends
-- {"terms_version": n}); age_confirmed_at is only set by older app builds that
-- still send "age_confirmed": true.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_terms int;
  v_age boolean;
begin
  begin
    v_terms := nullif(new.raw_user_meta_data ->> 'terms_version', '')::int;
    v_age := coalesce((new.raw_user_meta_data ->> 'age_confirmed')::boolean, false);
  exception when others then
    v_terms := null;
    v_age := false;
  end;
  insert into profiles (id, terms_version, terms_accepted_at, age_confirmed_at)
  values (new.id,
          case when v_terms between 1 and 1000 then v_terms else 0 end,
          case when v_terms between 1 and 1000 then now() end,
          case when v_age then now() end)
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function handle_new_user() from public, anon, authenticated;
