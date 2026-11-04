-- =====================================================================
-- Push notifications + "new update available".
--   * Devices register a push token through register_push_token().
--   * Database triggers queue a notification row for every offer event and
--     chat message, then ping the `notify` Edge Function, which sends it
--     through Firebase Cloud Messaging and marks the row sent.
--   * The function only ever sends rows that are already in the queue, so
--     calling it from outside can't create notifications.
-- =====================================================================

insert into app_config (key, value) values
  ('notify_url', '"https://vwkaohiukqmotwesdqvi.supabase.co/functions/v1/notify"'),
  ('latest_release', '{"build": 0, "url": null, "name": null}')
on conflict (key) do nothing;

-- The update check runs before sign-in too, so this one row is public.
grant select on app_config to anon;
drop policy if exists config_read on app_config;
create policy config_read on app_config for select to authenticated using (true);
create policy config_read_release on app_config for select to anon using (key = 'latest_release');

create table push_tokens (
  token text primary key check (char_length(token) between 10 and 4096),
  user_id uuid not null references profiles(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);
create index idx_push_tokens_user on push_tokens (user_id);
alter table push_tokens enable row level security;  -- no client policies: RPC only

create table notification_queue (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade,  -- null = everyone (app updates)
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index idx_notification_queue_pending on notification_queue (created_at) where status = 'pending';
alter table notification_queue enable row level security;  -- server only

create or replace function register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
begin
  if p_platform not in ('android', 'ios') or char_length(coalesce(p_token, '')) not between 10 and 4096 then
    raise exception 'Invalid push token.' using errcode = '22023';
  end if;
  insert into push_tokens (token, user_id, platform) values (p_token, v_uid, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

create or replace function unregister_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from push_tokens where token = p_token and user_id = auth.uid();
$$;

-- Queue one notification and wake the sender. Never fails the caller's transaction.
create or replace function enqueue_notification(p_user uuid, p_title text, p_body text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_url text := (select value #>> '{}' from app_config where key = 'notify_url');
begin
  if p_user is not null and not exists (select 1 from push_tokens where user_id = p_user) then
    return;  -- nobody to send to
  end if;
  insert into notification_queue (user_id, title, body, data)
  values (p_user, left(p_title, 80), left(p_body, 180), coalesce(p_data, '{}'::jsonb))
  returning id into v_id;
  begin
    perform net.http_post(url := v_url, body := jsonb_build_object('id', v_id),
                          headers := '{"Content-Type": "application/json"}'::jsonb);
  exception when others then
    null;  -- pg_net unavailable (e.g. local tests); the row stays queued
  end;
end $$;

-- ---------- triggers ----------
create or replace function notify_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o offers%rowtype;
  v_to uuid;
begin
  if new.kind <> 'text' or new.sender_id is null then
    return new;
  end if;
  select * into o from offers where id = new.offer_id;
  v_to := case when new.sender_id = o.from_user then o.to_user else o.from_user end;
  perform enqueue_notification(v_to, display_name_of(new.sender_id), new.body,
    jsonb_build_object('type', 'message', 'offer_id', o.id));
  return new;
end $$;
create trigger trg_notify_message after insert on messages
  for each row execute function notify_on_message();

create or replace function notify_on_offer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_title text := (select title from listings where id = new.target_listing_id);
  v_actor uuid := auth.uid();
  v_other uuid;
  v_n int;
  v_data jsonb := jsonb_build_object('type', 'offer', 'offer_id', new.id);
begin
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
create trigger trg_notify_offer after insert or update on offers
  for each row execute function notify_on_offer();

-- Called by the release-check function (service role) when a newer APK is published.
create or replace function publish_release(p_build int, p_url text, p_name text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_current int := coalesce((select (value ->> 'build')::int from app_config where key = 'latest_release'), 0);
begin
  if p_build is null or p_build <= v_current then
    return false;
  end if;
  insert into app_config (key, value, updated_at)
  values ('latest_release', jsonb_build_object('build', p_build, 'url', p_url, 'name', p_name), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  if v_current > 0 then  -- don't announce the very first release we learn about
    perform enqueue_notification(null, 'Swap update available',
      'A new version is ready. Tap to update.', jsonb_build_object('type', 'update', 'url', p_url));
  end if;
  return true;
end $$;

-- ---------- privileges ----------
-- New functions get Supabase's default grants, so lock them down explicitly.
revoke execute on function
  register_push_token(text, text),
  unregister_push_token(text),
  enqueue_notification(uuid, text, text, jsonb),
  notify_on_message(),
  notify_on_offer(),
  publish_release(int, text, text)
from public, anon, authenticated;
grant execute on function register_push_token(text, text), unregister_push_token(text) to authenticated;
revoke all on push_tokens, notification_queue from anon, authenticated;
