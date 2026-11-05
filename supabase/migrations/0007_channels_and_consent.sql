-- =====================================================================
-- 1. Distribution channels. The Google Play build updates through Play, so
--    "update available" notices must only reach sideload (GitHub APK) installs.
--    Older app builds don't send a channel; they are all sideload installs.
-- 2. Terms + age confirmation. Swap is 18+ only. Each account records which
--    version of the Terms and Privacy Policy it accepted, and when.
-- =====================================================================

-- ---------- 1. channels ----------
alter table push_tokens
  add column if not exists channel text not null default 'sideload'
  check (channel in ('sideload', 'play', 'ios'));
alter table notification_queue
  add column if not exists channel text
  check (channel is null or channel in ('sideload', 'play', 'ios'));  -- null = every channel
update push_tokens set channel = 'ios' where platform = 'ios' and channel = 'sideload';

drop function if exists register_push_token(text, text);
create or replace function register_push_token(p_token text, p_platform text, p_channel text default 'sideload')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
  v_channel text := case when p_platform = 'ios' then 'ios' else coalesce(p_channel, 'sideload') end;
begin
  if p_platform not in ('android', 'ios') or char_length(coalesce(p_token, '')) not between 10 and 4096
     or v_channel not in ('sideload', 'play', 'ios') then
    raise exception 'Invalid push token.' using errcode = '22023';
  end if;
  insert into push_tokens (token, user_id, platform, channel) values (p_token, v_uid, p_platform, v_channel)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, channel = excluded.channel, updated_at = now();
end $$;

-- Same as before plus an optional channel for broadcasts (user = null).
drop function if exists enqueue_notification(uuid, text, text, jsonb);
create or replace function enqueue_notification(p_user uuid, p_title text, p_body text, p_data jsonb,
                                                p_channel text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_url text := (select value #>> '{}' from app_config where key = 'notify_url');
begin
  if p_user is not null and not exists (select 1 from push_tokens where user_id = p_user) then
    return;  -- nobody to send to
  end if;
  insert into notification_queue (user_id, title, body, data, channel)
  values (p_user, left(p_title, 80), left(p_body, 180), coalesce(p_data, '{}'::jsonb), p_channel)
  returning id into v_id;
  begin
    perform net.http_post(url := v_url, body := jsonb_build_object('id', v_id),
                          headers := '{"Content-Type": "application/json"}'::jsonb);
  exception when others then
    null;  -- pg_net unavailable (e.g. local tests); the row stays queued
  end;
end $$;

-- Update notices go to sideload installs only.
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
  if v_current > 0 then
    perform enqueue_notification(null, coalesce(p_name, 'Swap') || ' is available',
      'Tap to update. It installs over your current version.',
      jsonb_build_object('type', 'update', 'url', p_url, 'build', p_build), 'sideload');
  end if;
  return true;
end $$;

-- ---------- 2. terms + age ----------
alter table profiles
  add column if not exists terms_version int not null default 0,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists age_confirmed_at timestamptz;

-- Sign-up sends {"terms_version": n, "age_confirmed": true} as user metadata, so the
-- acceptance is recorded even when email confirmation delays the first sign-in.
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
          case when v_age and v_terms > 0 then v_terms else 0 end,
          case when v_age and v_terms > 0 then now() end,
          case when v_age and v_terms > 0 then now() end)
  on conflict (id) do nothing;
  return new;
end $$;

-- Existing accounts (and anyone after a terms change) confirm in the app.
create or replace function accept_terms(p_version int, p_age_confirmed boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in to continue.' using errcode = '28000';
  end if;
  if not coalesce(p_age_confirmed, false) then
    raise exception 'Swap is only for people aged 18 or over.' using errcode = '22023';
  end if;
  if p_version is null or p_version < 1 or p_version > 1000 then
    raise exception 'Invalid terms version.' using errcode = '22023';
  end if;
  update profiles
  set terms_version = greatest(terms_version, p_version), terms_accepted_at = now(),
      age_confirmed_at = coalesce(age_confirmed_at, now())
  where id = v_uid;
end $$;

-- Profile reads already use column grants; add the new public column.
grant select (terms_version) on profiles to authenticated;

-- ---------- privileges ----------
revoke execute on function
  register_push_token(text, text, text),
  enqueue_notification(uuid, text, text, jsonb, text),
  publish_release(int, text, text),
  accept_terms(int, boolean),
  handle_new_user()
from public, anon, authenticated;
grant execute on function register_push_token(text, text, text), accept_terms(int, boolean) to authenticated;
