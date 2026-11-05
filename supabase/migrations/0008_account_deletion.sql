-- =====================================================================
-- Account deletion (required by Google Play, in the app and on the web).
--
-- What happens when someone deletes their account:
--   * open offers and accepted trades are closed, and the other person is told
--   * their items are removed and the item photos cleared; items that nobody
--     traded or offered on are deleted outright
--   * profile details (name, photo, bio, area) are wiped; the row stays as an
--     anonymous "Deleted user" so the other person's past chats and ratings
--     still make sense
--   * push tokens, blocks and admin rights are deleted
--   * the sign-in account (email, password) is deleted from auth.users
-- Photo files are deleted from storage by the delete-account Edge Function
-- (Supabase only allows that through the Storage API).
-- =====================================================================

alter table profiles add column if not exists deleted_at timestamptz;
grant select (deleted_at) on profiles to authenticated;

-- The profile row must outlive the auth user, so it no longer cascades from auth.users.
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass
  loop
    execute format('alter table profiles drop constraint %I', c);
  end loop;
end $$;

-- Deleted accounts can't be edited, even by a leftover session.
drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid() and deleted_at is null) with check (id = auth.uid());

-- Offer notifications stay the same, except during bulk closes (below).
create or replace function notify_on_offer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_title text := (select title from listings where id = new.target_listing_id);
  v_actor uuid := auth.uid();
  v_other uuid;
  v_n int;
  v_data jsonb := jsonb_build_object('type', 'offer', 'offer_id', new.id);
begin
  -- Bulk closes (account deleted, account suspended) send their own clearer notice.
  if coalesce(current_setting('swap.quiet_offer_notices', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    select count(*) into v_n from offer_items where offer_id = new.id;
    perform enqueue_notification(new.to_user, 'New offer for your ' || v_title,
      display_name_of(new.from_user) || ' wants to swap for it. Tap to see the offer.', v_data);
    return new;
  end if;

  -- Whoever caused the change doesn't need to be told about it.
  v_other := case when v_actor = new.from_user then new.to_user
                  when v_actor = new.to_user then new.from_user end;

  if new.status is distinct from old.status then
    if new.status = 'countered' then
      perform enqueue_notification(new.awaiting_user, 'Counter-offer: ' || v_title,
        display_name_of(case when new.awaiting_user = new.from_user then new.to_user else new.from_user end)
          || ' changed the swap. Your turn.', v_data);
    elsif new.status = 'accepted' then
      perform enqueue_notification(coalesce(v_other, new.from_user), 'Swap accepted',
        'Your swap for ' || v_title || ' was accepted. Chat to agree where to meet.', v_data);
    elsif new.status = 'completed' then
      perform enqueue_notification(coalesce(v_other, new.from_user), 'Swap complete',
        'Thanks for swapping! Rate how it went.', v_data);
    elsif new.status = 'declined' then
      if v_other is not null then
        perform enqueue_notification(v_other, 'Offer declined', 'The swap for ' || v_title || ' was declined.', v_data);
      else
        -- Closed by the system (item swapped elsewhere, removed or edited): tell the offerer.
        perform enqueue_notification(new.from_user, 'Offer closed', 'Your offer for ' || v_title || ' is no longer open.', v_data);
      end if;
    elsif new.status = 'cancelled' and v_other is not null then
      perform enqueue_notification(v_other, 'Swap cancelled', 'The swap for ' || v_title || ' was cancelled.', v_data);
    end if;
  elsif new.status = 'countered' and new.awaiting_user is distinct from old.awaiting_user then
    perform enqueue_notification(new.awaiting_user, 'Counter-offer: ' || v_title, 'The swap changed. Your turn.', v_data);
  elsif new.status = 'accepted' and v_other is not null
        and ((old.from_confirmed_at is null and new.from_confirmed_at is not null)
          or (old.to_confirmed_at is null and new.to_confirmed_at is not null)) then
    perform enqueue_notification(v_other, display_name_of(v_actor) || ' confirmed the swap',
      'Tap "We swapped" once you have your item.', v_data);
  end if;
  return new;
end $$;

-- Closes every open offer and accepted trade a person is part of, frees the
-- other person's items, and tells the other person with one clear notice.
create or replace function close_user_offers(p_uid uuid, p_message text, p_notice text) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_all uuid[];
  v_other uuid;
begin
  perform set_config('swap.quiet_offer_notices', 'on', true);
  for r in
    select * from offers
    where (from_user = p_uid or to_user = p_uid) and status in ('pending', 'countered', 'accepted')
    order by id
    for update
  loop
    v_other := case when r.from_user = p_uid then r.to_user else r.from_user end;
    if r.status = 'accepted' then
      select array_agg(listing_id) into v_all from offer_items where offer_id = r.id;
      v_all := coalesce(v_all, '{}') || r.target_listing_id;
      update listings set status = 'available' where id = any(v_all) and status = 'reserved' and owner_id <> p_uid;
      update offers set status = 'cancelled', awaiting_user = null, closed_at = now(),
        from_confirmed_at = null, to_confirmed_at = null where id = r.id;
    else
      update offers set status = 'declined', awaiting_user = null, closed_at = now() where id = r.id;
    end if;
    perform post_system_message(r.id, p_message);
    perform enqueue_notification(v_other, 'Swap closed', p_notice, jsonb_build_object('type', 'offer', 'offer_id', r.id));
  end loop;
  perform set_config('swap.quiet_offer_notices', '', true);
end $$;

create or replace function scrub_account(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_uid is null or not exists (select 1 from profiles where id = p_uid) then
    return;
  end if;

  -- Nothing more should reach this person's devices.
  delete from push_tokens where user_id = p_uid;

  -- 1. Close everything still open, and tell the other person.
  perform close_user_offers(p_uid, 'This swap closed because the other person deleted their account.',
    'The other person deleted their Swap account, so this swap is closed.');

  -- 2. Items: delete the ones nobody ever offered on; keep the rest (stripped)
  --    so the other person's trade history still shows what was swapped.
  delete from listings l
  where l.owner_id = p_uid
    and not exists (select 1 from offers o where o.target_listing_id = l.id)
    and not exists (select 1 from offer_items oi where oi.listing_id = l.id);
  update listings
  set status = case when status = 'traded' then 'traded'::listing_status else 'removed'::listing_status end,
      photos = '{}', description = '', looking_for = ''
  where owner_id = p_uid;

  -- 3. Personal data and links to other people.
  delete from notification_queue where user_id = p_uid and status in ('pending', 'sending');
  delete from blocks where blocker_id = p_uid or blocked_id = p_uid;
  delete from admin_users where user_id = p_uid;
  update profiles
  set display_name = 'Deleted user', avatar_url = null, bio = null, city = null,
      is_suspended = true, deleted_at = coalesce(deleted_at, now())
  where id = p_uid;
end $$;

-- Deleting a user anywhere (the app, the web page, or the Supabase dashboard)
-- scrubs their data the same way.
create or replace function handle_deleted_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform scrub_account(old.id);
  return old;
end $$;
drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted after delete on auth.users
  for each row execute function handle_deleted_user();

-- Storage paths the Edge Function must delete (every file in the user's folder).
create or replace function account_media_paths(p_uid uuid) returns setof text
language sql stable security definer set search_path = public, storage as $$
  select o.name from storage.objects o
  where o.bucket_id = 'media' and o.name like p_uid::text || '/%';
$$;

-- display_name_of() is used in chat and notifications; deleted accounts read clearly.
create or replace function display_name_of(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select display_name from profiles where id = p_user), 'Deleted user');
$$;

revoke execute on function
  scrub_account(uuid), handle_deleted_user(), account_media_paths(uuid), display_name_of(uuid),
  close_user_offers(uuid, text, text), notify_on_offer()
from public, anon, authenticated;
grant execute on function scrub_account(uuid), account_media_paths(uuid) to service_role;
