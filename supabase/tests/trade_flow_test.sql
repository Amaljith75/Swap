-- End-to-end test of the barter flow and the security rules.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000003');

create function t_as(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u, false);
end $$;
grant execute on function t_as(text) to authenticated;

-- expect_error runs SQL as the CURRENT role and fails the test if it succeeds.
create function expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_like || '%' then
      raise notice 'ok (blocked): %', left(sqlerrm, 80);
      return;
    end if;
    raise exception 'wrong error for [%]: %', p_sql, sqlerrm;
  end;
  raise exception 'expected error but succeeded: %', p_sql;
end $$;
grant execute on function expect_error(text, text) to authenticated;

create function check_(cond boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'CHECK FAILED: %', label; end if;
  raise notice 'ok: %', label;
end $$;
grant execute on function check_(boolean, text) to authenticated;

create table t_ids (k text primary key, v uuid);
grant all on t_ids to authenticated;
create function id_(k text) returns uuid language sql stable as $$ select v from t_ids where k = $1 $$;
grant execute on function id_(text) to authenticated;

select check_((select count(*) from profiles) = 3, 'profiles auto-created on signup');

set role authenticated;

-- ---------- A lists two items ----------
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into t_ids values ('a1', create_listing('Acoustic guitar', 'Yamaha F310, light scratches', 'music', 'good',
  'A bicycle or a board game', array['aaaaaaaa-0000-0000-0000-000000000001/g1.jpg'], 12.97161, 77.59463));
insert into t_ids values ('a2', create_listing('Camping tent', '2-person tent', 'sports', 'like_new',
  '', array['aaaaaaaa-0000-0000-0000-000000000001/t1.jpg'], 12.9720, 77.5950));
select expect_error($$select create_listing('Lamp', '', 'home', 'good', '', array['bbbbbbbb-0000-0000-0000-000000000002/x.jpg'], 12.97, 77.59)$$, 'Invalid photo');
select expect_error($$select create_listing('Lamp', '', 'home', 'good', '', array[]::text[], 12.97, 77.59)$$, 'at least one photo');
select expect_error($$select create_listing('Lamp', '', 'home', 'good', '', array['aaaaaaaa-0000-0000-0000-000000000001/x.jpg'], null, null)$$, 'Location');
select expect_error($$select create_listing('Lamp', '', 'weapons', 'good', '', array['aaaaaaaa-0000-0000-0000-000000000001/x.jpg'], 12.97, 77.59)$$, 'check constraint');

-- ---------- B lists two items ----------
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
insert into t_ids values ('b1', create_listing('Road bike', 'Hero Sprint 21 gear', 'sports', 'good',
  'Guitar', array['bbbbbbbb-0000-0000-0000-000000000002/b1.jpg'], 12.9800, 77.6000));
insert into t_ids values ('b2', create_listing('Catan board game', 'Complete set', 'toys', 'like_new',
  '', array['bbbbbbbb-0000-0000-0000-000000000002/c1.jpg'], 12.9800, 77.6000));

-- Discovery
select check_((select count(*) from nearby_listings(12.98, 77.60, 5)) = 2, 'B sees A''s 2 items nearby, not own');
select check_((select min(distance_km) from nearby_listings(12.98, 77.60, 5)) >= 0.5, 'distance rounded, never below 0.5 km');
select check_((select count(*) from nearby_listings(12.98, 77.60, 5, 'music')) = 1, 'category filter');
select check_((select count(*) from nearby_listings(12.98, 77.60, 5, null, 'guitar')) = 1, 'search');
select check_((select count(*) from nearby_listings(12.98, 77.60, 5, null, '%')) = 0, 'search wildcard escaped');
select check_((select count(*) from nearby_listings(19.07, 72.87, 5)) = 0, 'far away (Mumbai) sees nothing');
select expect_error($$select lat from listings limit 1$$, 'permission denied');
select expect_error($$insert into listings (owner_id, title, category) values (auth.uid(), 'Hack', 'other')$$, 'permission denied');
select expect_error($$update listings set status = 'traded'$$, 'permission denied');

-- ---------- B offers the bike for A's guitar ----------
insert into t_ids values ('o1', make_offer(id_('a1'), array[id_('b1')], 'Hi! Swap for my bike?'));
select expect_error($$select make_offer(id_('a1'), array[id_('b2')])$$, 'already have an open offer');
select expect_error($$select make_offer(id_('b2'), array[id_('b1')])$$, 'own item');
select expect_error($$select make_offer(id_('a2'), array[id_('a1')])$$, 'no longer available');
select expect_error($$select respond_offer(id_('o1'), 'accept')$$, 'not waiting for you');
select expect_error($$update offers set status = 'completed'$$, 'permission denied');

-- ---------- A counters: wants the board game instead ----------
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select check_(my_pending_count() = 1, 'A has 1 offer waiting');
select check_((select count(*) from messages where offer_id = id_('o1')) = 2, 'offer created system + first message');
select check_(respond_offer(id_('o1'), 'counter', array[id_('b2')]) = 'countered', 'A countered');
select expect_error($$select respond_offer(id_('o1'), 'counter', array[id_('a2')])$$, 'not waiting for you');
select expect_error($$select respond_offer(id_('o1'), 'accept')$$, 'not waiting for you');

-- ---------- B accepts the counter ----------
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
select expect_error($$select respond_offer(id_('o1'), 'counter', array[id_('a2')])$$, 'no longer available');
select check_(respond_offer(id_('o1'), 'accept') = 'accepted', 'B accepted');
select check_((select status from listings where id = id_('a1')) = 'reserved', 'guitar reserved');
select check_((select status from listings where id = id_('b2')) = 'reserved', 'board game reserved');
select check_((select status from listings where id = id_('b1')) = 'available', 'bike stays available');

-- ---------- C is an outsider ----------
select t_as('cccccccc-0000-0000-0000-000000000003');
insert into t_ids values ('c1', create_listing('Kindle', 'Paperwhite 10th gen', 'electronics', 'good',
  '', array['cccccccc-0000-0000-0000-000000000003/k.jpg'], 12.9716, 77.5946));
select check_((select count(*) from nearby_listings(12.97, 77.59, 5)) = 2, 'C sees tent + bike only (reserved hidden)');
select expect_error($$select make_offer(id_('a1'), array[id_('c1')])$$, 'no longer available');
select check_((select count(*) from offers) = 0, 'C cannot read others'' offers');
select check_((select count(*) from messages) = 0, 'C cannot read others'' messages');
select expect_error($$select send_message(id_('o1'), 'hello')$$, 'Chat not found');
select expect_error($$select confirm_trade(id_('o1'))$$, 'Offer not found');
insert into t_ids values ('o2', make_offer(id_('a2'), array[id_('c1')]));  -- C offers for the tent

-- ---------- Chat between A and B ----------
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select check_(send_message(id_('o1'), 'Meet at the metro station gate at 6?') is not null, 'A can chat');
select expect_error($$select send_message(id_('o1'), 'call me 98765 43210')$$, 'phone numbers');
select expect_error($$select send_message(id_('o1'), 'see https://x.co')$$, 'links');
select expect_error($$select send_message(id_('o1'), '   ')$$, '1 to 500');

-- ---------- Both confirm ----------
select check_(confirm_trade(id_('o1')) = 'accepted', 'A confirmed, waiting for B');
select check_(confirm_trade(id_('o1')) = 'accepted', 'A confirming twice cannot complete it');
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
select expect_error($$select rate_trade(id_('o1'), 5)$$, 'only completed');
select check_(confirm_trade(id_('o1')) = 'completed', 'B confirmed, swap completed');
select check_((select status from listings where id = id_('a1')) = 'traded', 'guitar traded');
select check_((select trades_completed from profiles where id = auth.uid()) = 1, 'trade count incremented');
select check_((select chat_closes_at between now() + interval '299 seconds' and now() + interval '301 seconds'
               from offers where id = id_('o1')), 'chat closes 5 minutes after completion');
select check_(send_message(id_('o1'), 'Thanks!') is not null, 'chat still open within 5 minutes');
reset role;
update offers set chat_closes_at = now() - interval '1 second' where id = id_('o1');
set role authenticated;
select expect_error($$select send_message(id_('o1'), 'late message')$$, 'chat is closed');

-- ---------- Ratings ----------
select rate_trade(id_('o1'), 4, 'On time, item as described');
select expect_error($$select rate_trade(id_('o1'), 5)$$, 'already rated');
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select rate_trade(id_('o1'), 5);
select check_((select rating_avg from profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 5.00, 'B rating 5.00');
select check_((select rating_avg from profiles where id = auth.uid()) = 4.00, 'A rating 4.00');

-- ---------- Profile column rules ----------
select expect_error($$update profiles set rating_avg = 5 where id = auth.uid()$$, 'permission denied');
select expect_error($$update profiles set is_suspended = false where id = auth.uid()$$, 'permission denied');
update profiles set display_name = 'Asha' where id = auth.uid();
select check_((select display_name from profiles where id = auth.uid()) = 'Asha', 'own name updated');
update profiles set display_name = 'Hacked' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select check_((select display_name from profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') <> 'Hacked', 'cannot edit others');

-- ---------- Competing offers: completing one closes the other ----------
-- A has the tent (a2). C already offered the Kindle. B offers the bike.
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
insert into t_ids values ('o3', make_offer(id_('a2'), array[id_('b1')]));
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select check_(my_pending_count() = 2, 'A has 2 offers on the tent');
select respond_offer(id_('o3'), 'accept');
select expect_error($$select respond_offer(id_('o2'), 'accept')$$, 'no longer available');
-- Cancel the accepted trade: items become available again
select check_(respond_offer(id_('o3'), 'cancel') = 'cancelled', 'A cancelled accepted trade');
select check_((select status from listings where id = id_('a2')) = 'available', 'tent available again');
select check_(respond_offer(id_('o2'), 'accept') = 'accepted', 'A accepts C''s Kindle offer instead');
select confirm_trade(id_('o2'));
select t_as('cccccccc-0000-0000-0000-000000000003');
select check_(confirm_trade(id_('o2')) = 'completed', 'tent-for-Kindle completed');

-- ---------- Same item offered in two places: one swap closes the other ----------
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into t_ids values ('a4', create_listing('Rice cooker', '', 'home', 'good', '', array['aaaaaaaa-0000-0000-0000-000000000001/r.jpg'], 12.9716, 77.5946));
select t_as('cccccccc-0000-0000-0000-000000000003');
insert into t_ids values ('c2', create_listing('Yoga mat', '', 'sports', 'good', '', array['cccccccc-0000-0000-0000-000000000003/y.jpg'], 12.9716, 77.5946));
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
insert into t_ids values ('o5', make_offer(id_('a4'), array[id_('b1')]));  -- bike for rice cooker
insert into t_ids values ('o6', make_offer(id_('c2'), array[id_('b1')]));  -- same bike for yoga mat
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select respond_offer(id_('o5'), 'accept');
select confirm_trade(id_('o5'));
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
select confirm_trade(id_('o5'));
select check_((select status from offers where id = id_('o6')) = 'declined', 'other offer using the swapped bike auto-closed');

-- ---------- Remove + block ----------
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into t_ids values ('a3', create_listing('Desk lamp', '', 'home', 'good', '', array['aaaaaaaa-0000-0000-0000-000000000001/l.jpg'], 12.9716, 77.5946));
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
insert into t_ids values ('b3', create_listing('Headphones', '', 'electronics', 'good', '', array['bbbbbbbb-0000-0000-0000-000000000002/h.jpg'], 12.98, 77.60));
insert into t_ids values ('o4', make_offer(id_('a3'), array[id_('b3')]));
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select block_user('bbbbbbbb-0000-0000-0000-000000000002');
select check_((select status from offers where id = id_('o4')) = 'declined', 'block closes open offers');
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
select check_((select count(*) from nearby_listings(12.97, 77.59, 5) where owner_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'blocked: B no longer sees A''s items');
select expect_error($$select make_offer(id_('a3'), array[id_('b3')])$$, 'cannot make an offer');
select expect_error($$select send_message(id_('o4'), 'hey')$$, 'closed');
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select unblock_user('bbbbbbbb-0000-0000-0000-000000000002');
select remove_listing(id_('a3'));
select check_((select status from listings where id = id_('a3')) = 'removed', 'item removed');

-- ---------- Reports ----------
insert into reports (reporter_id, reported_user_id, reason, details)
values (auth.uid(), 'cccccccc-0000-0000-0000-000000000003', 'no_show', 'Did not come');
select expect_error($$insert into reports (reporter_id, reported_user_id, reason) values ('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003', 'other')$$, 'row-level security');
select t_as('cccccccc-0000-0000-0000-000000000003');
select check_((select count(*) from reports) = 0, 'reported user cannot read the report');

-- ---------- Signed out ----------
select t_as('');
select expect_error($$select nearby_listings(12.97, 77.59, 5)$$, 'Sign in');
reset role;
set role anon;
select expect_error($$select * from offers$$, 'permission denied');
select expect_error($$select nearby_listings(12.97, 77.59, 5)$$, 'permission denied');
reset role;

-- ---------- Suspension ----------
update profiles set is_suspended = true where id = 'cccccccc-0000-0000-0000-000000000003';
set role authenticated;
select t_as('cccccccc-0000-0000-0000-000000000003');
select expect_error($$select nearby_listings(12.97, 77.59, 5)$$, 'suspended');
reset role;


-- ---------- Review fixes ----------
set role authenticated;
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select expect_error($$select is_blocked_between('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003')$$, 'permission denied');
select expect_error($$select close_open_offers_for_listings(array[id_('a1')], null, 'x')$$, 'permission denied');
select expect_error($$update profiles set display_name = 'WhatsApp 98765 43210' where id = auth.uid()$$, 'not allowed in your profile');
select expect_error($$update profiles set bio = 'see www.example.com' where id = auth.uid()$$, 'not allowed in your profile');
select expect_error($$update profiles set avatar_url = 'https://tracker.example/p.gif' where id = auth.uid()$$, 'Invalid profile photo');
update profiles set avatar_url = 'aaaaaaaa-0000-0000-0000-000000000001/avatar/me.jpg' where id = auth.uid();
select check_((select avatar_url from profiles where id = auth.uid()) like 'aaaaaaaa%', 'own avatar path accepted');
insert into t_ids values ('a5', create_listing('Ukulele', '', 'music', 'good', '', array['aaaaaaaa-0000-0000-0000-000000000001/u.jpg'], 12.9716, 77.5946));
insert into t_ids values ('a6', create_listing('Speaker', '', 'electronics', 'good', '', array['aaaaaaaa-0000-0000-0000-000000000001/s.jpg'], 12.9716, 77.5946));

select t_as('bbbbbbbb-0000-0000-0000-000000000002');
insert into t_ids values ('b4', create_listing('Skateboard', '', 'sports', 'good', '', array['bbbbbbbb-0000-0000-0000-000000000002/sk.jpg'], 12.98, 77.60));
insert into t_ids values ('b5', create_listing('Chess set', '', 'toys', 'good', '', array['bbbbbbbb-0000-0000-0000-000000000002/ch.jpg'], 12.98, 77.60));
select expect_error($$select make_offer(id_('a5'), array[id_('b4')], 'call me 98765 43210')$$, 'phone numbers');
insert into t_ids values ('o7', make_offer(id_('a5'), array[id_('b4')], 'Skateboard for the ukulele?'));
-- Bait and switch: editing an offered item closes the offer
select update_listing(id_('b4'), 'Broken skateboard', '', 'sports', 'fair', '', array['bbbbbbbb-0000-0000-0000-000000000002/sk.jpg']);
select check_((select status from offers where id = id_('o7')) = 'declined', 'editing an offered item closes the offer');
insert into t_ids values ('o8', make_offer(id_('a6'), array[id_('b5')]));

-- Owner can still decline after countering
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select respond_offer(id_('o8'), 'counter', array[id_('b4')]);
select check_(respond_offer(id_('o8'), 'decline') = 'declined', 'owner can decline after countering');

-- Nearby: radius quantized, still works with odd values
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
select check_((select count(*) from nearby_listings(12.98, 77.60, 3.7)) >= 1, 'odd radius rounds up to a fixed step');

-- Rating farming: two swaps between the same people count once
reset role;
select check_((select rating_count from profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'A has 1 counted rating so far');
set role authenticated;
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into t_ids values ('a7', create_listing('Mug', '', 'home', 'good', '', array['aaaaaaaa-0000-0000-0000-000000000001/m.jpg'], 12.9716, 77.5946));
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
insert into t_ids values ('o9', make_offer(id_('a7'), array[id_('b5')]));
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select respond_offer(id_('o9'), 'accept'); select confirm_trade(id_('o9'));
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
select confirm_trade(id_('o9'));
select rate_trade(id_('o9'), 1);
select check_((select rating_count from profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1
              and (select rating_avg from profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1.00,
              'same rater counts once (latest rating wins)');
reset role;


-- ---------- Notifications ----------
set role authenticated;
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select expect_error($$select * from notification_queue$$, 'permission denied');
select expect_error($$select * from push_tokens$$, 'permission denied');
select expect_error($$select enqueue_notification(auth.uid(), 'x', 'y', '{}')$$, 'permission denied');
select expect_error($$select publish_release(99, 'u', 'n')$$, 'permission denied');
select register_push_token('fcm-token-for-asha-000000', 'android');
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
insert into t_ids values ('b6', create_listing('Frisbee', '', 'sports', 'good', '', array['bbbbbbbb-0000-0000-0000-000000000002/f.jpg'], 12.98, 77.60));
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into t_ids values ('a8', create_listing('Kettle', '', 'home', 'good', '', array['aaaaaaaa-0000-0000-0000-000000000001/k.jpg'], 12.9716, 77.5946));
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
insert into t_ids values ('o10', make_offer(id_('a8'), array[id_('b6')], 'Frisbee for the kettle?'));
reset role;
select check_((select count(*) from notification_queue where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 2, 'owner gets new-offer + message notifications');
select check_((select count(*) from notification_queue where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 0, 'no notifications for users without a device');
set role authenticated;
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select respond_offer(id_('o10'), 'decline');
reset role;
select check_((select count(*) from notification_queue) = 2, 'actor is not notified about own decline');
select check_(publish_release(5, 'https://example/swap-5.apk', 'Build 5'), 'first release recorded');
select check_((select count(*) from notification_queue where user_id is null) = 0, 'first release is not announced');
select check_(publish_release(6, 'https://example/swap-6.apk', 'Build 6'), 'newer release recorded');
select check_((select count(*) from notification_queue where user_id is null and data->>'type' = 'update') = 1, 'newer release announced to everyone');
select check_(not publish_release(6, 'x', 'y'), 'same build is ignored');
set role anon;
select check_((select value->>'build' from app_config where key = 'latest_release') = '6', 'anon can read latest release');
select check_((select count(*) from app_config) = 1, 'anon sees only the release row');
reset role;


-- ---------- Area, move, wanted matches ----------
set role authenticated;
reset role;
update profiles set is_suspended = false where id = 'cccccccc-0000-0000-0000-000000000003';
set role authenticated;
select t_as('cccccccc-0000-0000-0000-000000000003');
insert into t_ids values ('c3', create_listing('Old drum kit', '', 'music', 'fair', 'A bicycle or some board games', array['cccccccc-0000-0000-0000-000000000003/d.jpg'], 12.9716, 77.5946));
select register_push_token('fcm-token-for-meera-0000000', 'android');
select check_((select count(*) from listing_area(id_('c3'))) = 1, 'owner sees the item area');
select move_listing(id_('c3'), 12.9900, 77.6100);
select check_((select lat from listing_area(id_('c3'))) = 12.990, 'moved pin is snapped to the grid');
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
select expect_error($$select move_listing(id_('c3'), 1, 1)$$, 'not found');
-- B lists a bicycle -> C (who wants "a bicycle") is notified, A (no matching want) is not.
insert into t_ids values ('b7', create_listing('Kids bicycle', '', 'sports', 'good', '', array['bbbbbbbb-0000-0000-0000-000000000002/kb.jpg'], 12.98, 77.60));
reset role;
select check_((select count(*) from notification_queue where user_id = 'cccccccc-0000-0000-0000-000000000003' and data->>'type' = 'match') = 1, 'wanted match notifies the person looking for it');
select check_((select title from notification_queue where data->>'type' = 'match' limit 1) like '% got what you need', 'match title names the lister');
select check_((select count(*) from notification_queue where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and data->>'type' = 'match') = 0, 'no match for people who want other things');
set role authenticated;
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
insert into t_ids values ('b8', create_listing('Ticket to Ride board game', '', 'toys', 'good', '', array['bbbbbbbb-0000-0000-0000-000000000002/tr.jpg'], 12.98, 77.60));
insert into t_ids values ('b9', create_listing('Garden hose', '', 'tools', 'good', '', array['bbbbbbbb-0000-0000-0000-000000000002/gh.jpg'], 12.98, 77.60));
reset role;
select check_((select count(*) from notification_queue where user_id = 'cccccccc-0000-0000-0000-000000000003' and data->>'type' = 'match') = 2, 'plural folding: "board games" matches "board game", hose does not');
select check_(wanted_words('Anything! Open to offers') = '{}', 'filler words never match');

\echo ALL TESTS PASSED
