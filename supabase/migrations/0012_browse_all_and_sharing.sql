-- =====================================================================
-- 1. Browse every available item, not only nearby ones.
--    nearby_listings(p_radius_km => 0) means "anywhere": no distance limit,
--    nearest first. Without a location (p_lat/p_lng null) it still works in
--    "anywhere" mode: newest first, no distance shown.
--    Older app builds send 1/5/10/25 and behave exactly as before.
-- 2. Shared item links: a small public preview (title, photo, condition,
--    what they want) for the share page. No owner details, no location.
-- 3. App updates are downloaded through Swap's own address
--    (functions/v1/app-download), never a GitHub link.
-- =====================================================================

-- ---------- 1. browse everything ----------
create or replace function nearby_listings(
  p_lat double precision, p_lng double precision, p_radius_km double precision,
  p_category text default null, p_query text default null,
  p_limit int default 30, p_offset int default 0
) returns table (
  id uuid, title text, category text, condition item_condition, looking_for text,
  photos text[], created_at timestamptz, owner_id uuid, owner_name text,
  owner_avatar text, owner_rating numeric, owner_trades int, distance_km numeric
)
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
  v_anywhere boolean := coalesce(p_radius_km, 5) <= 0;
  v_has_pos boolean := p_lat is not null and p_lng is not null;
  -- A distance radius is limited to fixed steps and the search point is snapped to
  -- the same grid as listings, so repeated queries can't triangulate a listing's
  -- cell more finely than the ~550 m grid itself.
  v_r double precision := (select min(x) from unnest(array[1, 2, 5, 10, 25, 50]) x
                           where x >= least(coalesce(p_radius_km, 5), cfg_int('max_radius_km', 50)));
  v_dlat double precision;
  v_dlng double precision;
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not v_has_pos and not v_anywhere then
    raise exception 'Location is needed to find nearby items.' using errcode = '22023';
  end if;
  if not hit_rate_limit('nearby', cfg_int('nearby_searches_per_10min', 120), interval '10 minutes') then
    raise exception 'You are searching very fast. Wait a few minutes and try again.' using errcode = '22023';
  end if;
  v_r := coalesce(v_r, 50);
  if v_has_pos then
    p_lat := snap_coord(p_lat);
    p_lng := snap_coord(p_lng);
    v_dlat := v_r / 111.0;
    v_dlng := v_r / greatest(111.0 * cos(radians(p_lat)), 1.0);
  end if;
  if v_q is not null then
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select l.id, l.title, l.category, l.condition, l.looking_for, l.photos, l.created_at,
         l.owner_id, p.display_name, p.avatar_url, p.rating_avg, p.trades_completed,
         case when v_has_pos then display_distance(distance_km(p_lat, p_lng, l.lat, l.lng)) end
  from listings l
  join profiles p on p.id = l.owner_id
  where l.status = 'available'
    and l.owner_id <> v_uid
    and not p.is_suspended
    and (v_anywhere or (l.lat between p_lat - v_dlat and p_lat + v_dlat
                        and l.lng between p_lng - v_dlng and p_lng + v_dlng
                        and display_distance(distance_km(p_lat, p_lng, l.lat, l.lng)) <= v_r))
    and (p_category is null or l.category = p_category)
    and (v_q is null or l.title ilike v_q or l.looking_for ilike v_q or l.description ilike v_q)
    and not is_blocked_between(v_uid, l.owner_id)
  order by case when v_has_pos then distance_km(p_lat, p_lng, l.lat, l.lng) end nulls last,
           l.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- ---------- 2. public preview for shared links ----------
create or replace function listing_preview(p_id uuid)
returns table (id uuid, title text, category text, condition item_condition, looking_for text,
               photo text, created_at timestamptz, available boolean)
language sql stable security definer set search_path = public as $$
  select l.id, l.title, l.category, l.condition, l.looking_for, l.photos[1], l.created_at,
         l.status = 'available'
  from listings l
  join profiles p on p.id = l.owner_id
  where l.id = p_id
    and l.status in ('available', 'reserved', 'traded')
    and not p.is_suspended
    and p.deleted_at is null;
$$;

-- ---------- 3. neutral update download link ----------
create or replace function app_download_url(p_build int) returns text
language sql immutable as $$
  select 'https://vwkaohiukqmotwesdqvi.supabase.co/functions/v1/app-download?build=' || p_build;
$$;

-- publish_release always records Swap's own download address, whatever it is given.
create or replace function publish_release(p_build int, p_url text, p_name text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_current int := coalesce((select (value ->> 'build')::int from app_config where key = 'latest_release'), 0);
  v_url text := app_download_url(p_build);
begin
  if p_build is null or p_build <= v_current then
    return false;
  end if;
  insert into app_config (key, value, updated_at)
  values ('latest_release', jsonb_build_object('build', p_build, 'url', v_url, 'name', p_name), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  if v_current > 0 then
    perform enqueue_notification(null, coalesce(p_name, 'Swap') || ' is available',
      'Tap to update. It installs over your current version.',
      jsonb_build_object('type', 'update', 'url', v_url, 'build', p_build), 'sideload');
  end if;
  return true;
end $$;

-- The release already recorded switches to the neutral address too.
update app_config
set value = jsonb_set(value, '{url}', to_jsonb(app_download_url((value ->> 'build')::int)))
where key = 'latest_release' and coalesce((value ->> 'build')::int, 0) > 0;

revoke execute on function
  nearby_listings(double precision, double precision, double precision, text, text, int, int),
  listing_preview(uuid), app_download_url(int), publish_release(int, text, text)
from public, anon, authenticated;
grant execute on function
  nearby_listings(double precision, double precision, double precision, text, text, int, int) to authenticated;
grant execute on function listing_preview(uuid) to anon, authenticated;
