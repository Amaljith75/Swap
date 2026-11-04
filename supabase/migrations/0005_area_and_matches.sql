-- =====================================================================
-- Item area on a map, moving an item's pin, and "got what you need"
-- notifications when a new listing matches someone's looking-for text.
-- =====================================================================

-- The rounded (~500 m grid) position of an item the caller may see. This is
-- the same cell distance search already reveals, so nothing new is exposed.
create or replace function listing_area(p_id uuid)
returns table (lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  select l.lat, l.lng
  from listings l
  where l.id = p_id
    and auth.uid() is not null
    and (l.owner_id = auth.uid()
         or (l.status = 'available' and not is_blocked_between(auth.uid(), l.owner_id))
         or exists (select 1 from offers o
                    where (o.from_user = auth.uid() or o.to_user = auth.uid())
                      and (o.target_listing_id = l.id
                           or exists (select 1 from offer_items oi where oi.offer_id = o.id and oi.listing_id = l.id))));
$$;

create or replace function move_listing(p_id uuid, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_user();
  v_status listing_status;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid location.' using errcode = '22023';
  end if;
  select status into v_status from listings where id = p_id and owner_id = v_uid for update;
  if not found then
    raise exception 'Item not found.' using errcode = 'P0002';
  end if;
  if v_status <> 'available' then
    raise exception 'Only available items can be moved.' using errcode = '22023';
  end if;
  update listings set lat = snap_coord(p_lat), lng = snap_coord(p_lng) where id = p_id;
end $$;

-- ---------- wanted-list matching ----------
insert into app_config (key, value) values
  ('match_radius_km', '25'),
  ('match_notifications_per_day', '5')
on conflict (key) do nothing;

-- Meaningful words of a free-text field, lower-cased, light plural folding
-- ("books" -> "book", "glass" stays "glass").
create or replace function wanted_words(t text) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(distinct w), '{}')
  from (
    select regexp_replace(x, '([^s])s$', '\1') as w
    from regexp_split_to_table(lower(coalesce(t, '')), '[^a-z0-9]+') as x
    where char_length(x) >= 3
      and x not in ('any', 'anything', 'open', 'offer', 'offers', 'something', 'the', 'and', 'for', 'with',
                    'good', 'new', 'old', 'used', 'like', 'some', 'stuff', 'thing', 'things', 'item', 'items',
                    'other', 'similar', 'kind', 'type', 'nice', 'want', 'wanted', 'need', 'looking', 'swap',
                    'trade', 'exchange', 'maybe', 'also', 'etc', 'more', 'set', 'pair', 'one', 'two')
  ) s
  where char_length(w) >= 3;
$$;

create or replace function notify_wanted_matches() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_words text[] := wanted_words(new.title || ' ' || new.category);
  v_r double precision := cfg_int('match_radius_km', 25);
  v_cap int := cfg_int('match_notifications_per_day', 5);
  v_name text := display_name_of(new.owner_id);
  r record;
begin
  if new.lat is null or cardinality(v_words) = 0 then
    return new;
  end if;
  for r in
    select distinct on (l.owner_id) l.owner_id
    from listings l
    join profiles p on p.id = l.owner_id
    where l.status = 'available'
      and l.owner_id <> new.owner_id
      and l.looking_for <> ''
      and not p.is_suspended
      and l.lat between new.lat - v_r / 111.0 and new.lat + v_r / 111.0
      and distance_km(new.lat, new.lng, l.lat, l.lng) <= v_r
      and wanted_words(l.looking_for) && v_words
      and not is_blocked_between(l.owner_id, new.owner_id)
      and exists (select 1 from push_tokens t where t.user_id = l.owner_id)
      and (select count(*) from notification_queue q
           where q.user_id = l.owner_id and q.data ->> 'type' = 'match'
             and q.created_at > now() - interval '1 day') < v_cap
  loop
    perform enqueue_notification(r.owner_id, v_name || ' got what you need',
      new.title || ' was just listed near you. Trade now.',
      jsonb_build_object('type', 'match', 'listing_id', new.id));
  end loop;
  return new;
end $$;

create trigger trg_notify_wanted_matches after insert on listings
  for each row execute function notify_wanted_matches();

revoke execute on function
  listing_area(uuid), move_listing(uuid, double precision, double precision),
  wanted_words(text), notify_wanted_matches()
from public, anon, authenticated;
grant execute on function listing_area(uuid), move_listing(uuid, double precision, double precision) to authenticated;
