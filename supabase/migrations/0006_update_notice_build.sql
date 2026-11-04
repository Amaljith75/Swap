-- Include the build number in "update available" notifications so the app can
-- download and install it straight from the notification.
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
      jsonb_build_object('type', 'update', 'url', p_url, 'build', p_build));
  end if;
  return true;
end $$;
revoke execute on function publish_release(int, text, text) from public, anon, authenticated;
