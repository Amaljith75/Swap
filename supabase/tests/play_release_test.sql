-- Tests for the Play-release changes (migrations 0007-0009).
-- Runs after trade_flow_test.sql and reuses its users (A, B, C) and helpers.
\set ON_ERROR_STOP on
\set QUIET on

-- ---------- Channels: update notices only reach sideload installs ----------
set role authenticated;
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
select register_push_token('fcm-token-for-ravi-play-0001', 'android', 'play');
select expect_error($$select register_push_token('fcm-token-bad-channel-00001', 'android', 'web')$$, 'Invalid push token');
reset role;
select check_((select channel from push_tokens where token = 'fcm-token-for-ravi-play-0001') = 'play', 'Play build registers as play');
select check_((select channel from push_tokens where token = 'fcm-token-for-asha-000000') = 'sideload', 'old 2-argument registration defaults to sideload');
select check_(publish_release(7, 'https://example/swap-7.apk', 'Swap V 1.2'), 'release 7 recorded');
select check_((select channel from notification_queue where data->>'build' = '7') = 'sideload', 'update notice targets sideload only');

-- ---------- Terms + 18+ ----------
insert into auth.users (id, raw_user_meta_data) values
  ('dddddddd-0000-0000-0000-000000000004', '{"terms_version": 1, "age_confirmed": true}'),
  ('eeeeeeee-0000-0000-0000-000000000005', '{}');
select check_((select terms_version from profiles where id = 'dddddddd-0000-0000-0000-000000000004') = 1
              and (select age_confirmed_at from profiles where id = 'dddddddd-0000-0000-0000-000000000004') is not null,
              'sign-up consent recorded on the profile');
select check_((select terms_version from profiles where id = 'eeeeeeee-0000-0000-0000-000000000005') = 0, 'no consent without metadata');
set role authenticated;
select t_as('eeeeeeee-0000-0000-0000-000000000005');
select expect_error($$select accept_terms(1, false)$$, '18 or over');
select accept_terms(1, true);
select check_((select terms_version from profiles where id = auth.uid()) = 1, 'existing account accepts in the app');
select expect_error($$update profiles set terms_version = 5 where id = auth.uid()$$, 'permission denied');
reset role;

-- ---------- Account deletion ----------
-- D lists three items: one nobody touches, one with a pending offer from A,
-- and one in an accepted trade with B.
set role authenticated;
select t_as('dddddddd-0000-0000-0000-000000000004');
update profiles set display_name = 'Dev', bio = 'Hi', city = 'Kochi', onboarded = true where id = auth.uid();
insert into t_ids values ('d1', create_listing('Spare chair', '', 'home', 'good', '', array['dddddddd-0000-0000-0000-000000000004/listings/c.jpg'], 12.98, 77.60));
insert into t_ids values ('d2', create_listing('Desk lamp', 'Warm light', 'home', 'good', 'books', array['dddddddd-0000-0000-0000-000000000004/listings/l.jpg'], 12.98, 77.60));
insert into t_ids values ('d3', create_listing('Rice cooker', '', 'home', 'good', '', array['dddddddd-0000-0000-0000-000000000004/listings/r.jpg'], 12.98, 77.60));
select register_push_token('fcm-token-for-dev-000000001', 'android', 'play');
insert into t_ids values ('od_b', make_offer(id_('b9'), array[id_('d3')], 'Cooker for the hose?'));
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into t_ids values ('oa_d', make_offer(id_('d2'), array[id_('a8')], 'Kettle for the lamp?'));
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
select respond_offer(id_('od_b'), 'accept');
select check_((select status from listings where id = id_('b9')) = 'reserved', 'B''s hose reserved in the accepted trade');
select t_as('dddddddd-0000-0000-0000-000000000004');
select expect_error($$select scrub_account(auth.uid())$$, 'permission denied');
select expect_error($$select * from account_media_paths(auth.uid())$$, 'permission denied');
reset role;
insert into storage.objects (bucket_id, name) values
  ('media', 'dddddddd-0000-0000-0000-000000000004/listings/c.jpg'),
  ('media', 'dddddddd-0000-0000-0000-000000000004/avatar/me.jpg'),
  ('media', 'aaaaaaaa-0000-0000-0000-000000000001/g1.jpg');
select check_((select count(*) from account_media_paths('dddddddd-0000-0000-0000-000000000004')) = 2, 'media paths cover only the user''s folder');

-- The Edge Function deletes the auth user; the trigger scrubs everything.
delete from auth.users where id = 'dddddddd-0000-0000-0000-000000000004';
select check_((select display_name from profiles where id = 'dddddddd-0000-0000-0000-000000000004') = 'Deleted user'
              and (select bio from profiles where id = 'dddddddd-0000-0000-0000-000000000004') is null
              and (select city from profiles where id = 'dddddddd-0000-0000-0000-000000000004') is null
              and (select deleted_at from profiles where id = 'dddddddd-0000-0000-0000-000000000004') is not null,
              'profile anonymised, row kept');
select check_((select status from offers where id = id_('od_b')) = 'cancelled', 'accepted trade cancelled');
select check_((select status from listings where id = id_('b9')) = 'available', 'other person''s item available again');
select check_((select status from offers where id = id_('oa_d')) = 'declined', 'pending offer closed');
select check_((select status from listings where id = id_('a8')) = 'available', 'offerer''s item untouched');
select check_(not exists (select 1 from listings where id = id_('d1')), 'untouched item deleted');
select check_((select status::text || cardinality(photos) || description from listings where id = id_('d2')) = 'removed0',
              'offered item kept as a removed stub without photos');
select check_(not exists (select 1 from push_tokens where user_id = 'dddddddd-0000-0000-0000-000000000004'), 'push tokens deleted');
select check_(exists (select 1 from messages where offer_id = id_('od_b') and body like '%deleted their account%'), 'system message in the chat');
select check_(exists (select 1 from messages where offer_id = id_('od_b') and sender_id = 'dddddddd-0000-0000-0000-000000000004'), 'past messages kept for the other person');
select check_((select count(*) from notification_queue where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and title = 'Swap closed') = 1,
              'trade partner told once');
select check_((select count(*) from notification_queue where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
                 and data->>'offer_id' = id_('oa_d')::text and title in ('Offer closed', 'Swap closed')) = 1,
              'offerer told once (no duplicate)');
select check_(display_name_of('dddddddd-0000-0000-0000-000000000004') = 'Deleted user', 'chat names show Deleted user');
select scrub_account('dddddddd-0000-0000-0000-000000000004');  -- idempotent
set role authenticated;
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
select check_((select deleted_at is not null from profiles where id = 'dddddddd-0000-0000-0000-000000000004'), 'others can see the account was deleted');
select t_as('dddddddd-0000-0000-0000-000000000004');  -- a leftover session
update profiles set display_name = 'Back again' where id = auth.uid();
select check_((select display_name from profiles where id = auth.uid()) = 'Deleted user', 'deleted profile can''t be edited');
select expect_error($$select create_listing('Ghost', '', 'home', 'good', '', array['dddddddd-0000-0000-0000-000000000004/x.jpg'], 12.98, 77.60)$$, 'suspended');
reset role;

-- ---------- Reports, admin alerts, moderation ----------
insert into admin_users (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001');
set role authenticated;
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
insert into reports (reporter_id, reported_user_id, listing_id, reason, details)
values (auth.uid(), 'cccccccc-0000-0000-0000-000000000003', id_('c3'), 'prohibited_item', 'Looks fake');
select expect_error($$insert into reports (reporter_id, reported_user_id, listing_id, reason)
                      values (auth.uid(), 'cccccccc-0000-0000-0000-000000000003', id_('c3'), 'other')$$, 'already reported');
select expect_error($$select * from admin_reports()$$, 'Admins only');
select expect_error($$select admin_set_suspended('cccccccc-0000-0000-0000-000000000003', true)$$, 'Admins only');
reset role;
select check_((select count(*) from notification_queue where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and data->>'type' = 'report') = 1,
              'admin gets a push for a new report');
set role authenticated;
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
select check_((select count(*) from admin_reports() where reported_name is not null and listing_title = 'Old drum kit') = 1, 'admin sees the report with context');
select admin_remove_listing(id_('c3'));
select check_((select listing_status from admin_reports() where listing_title = 'Old drum kit') = 'removed', 'admin removed the item');
select admin_set_suspended('cccccccc-0000-0000-0000-000000000003', true);
select expect_error($$select admin_set_suspended(auth.uid(), true)$$, 'yourself');
insert into t_ids values ('rep1', (select id from admin_reports() where listing_title = 'Old drum kit'));
select admin_resolve_report(id_('rep1'), 'resolved', 'Item removed, user suspended');
select check_(not exists (select 1 from admin_reports('open') where id = id_('rep1'))
              and exists (select 1 from admin_reports('closed') where id = id_('rep1')), 'report resolved');
reset role;
select check_((select is_suspended from profiles where id = 'cccccccc-0000-0000-0000-000000000003'), 'user suspended');
select check_(not exists (select 1 from push_tokens where user_id = 'cccccccc-0000-0000-0000-000000000003'), 'suspended user gets no more pushes');
update profiles set is_suspended = false where id = 'cccccccc-0000-0000-0000-000000000003';

-- ---------- Rate limits ----------
update app_config set value = '2' where key = 'nearby_searches_per_10min';
update app_config set value = '1' where key = 'reports_per_day';
set role authenticated;
select t_as('eeeeeeee-0000-0000-0000-000000000005');
select count(*) from nearby_listings(12.98, 77.60, 5);
select count(*) from nearby_listings(12.98, 77.60, 5);
select expect_error($$select count(*) from nearby_listings(12.98, 77.60, 5)$$, 'searching very fast');
insert into reports (reporter_id, reported_user_id, reason) values (auth.uid(), 'bbbbbbbb-0000-0000-0000-000000000002', 'spam_or_scam');
select expect_error($$insert into reports (reporter_id, reported_user_id, reason) values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'other')$$, 'lot of reports');
select expect_error($$select * from rate_hits$$, 'permission denied');
reset role;
update app_config set value = '120' where key = 'nearby_searches_per_10min';
update app_config set value = '10' where key = 'reports_per_day';

-- ---------- Error log ----------
select set_config('request.jwt.claim.sub', '', false);  -- signed out
set role anon;
select log_client_error('TypeError: x is undefined', 'at Foo', '/welcome', true, 9, 'play', 'android', '15', 'Pixel 8');
select expect_error($$select * from client_errors$$, 'permission denied');
set role authenticated;
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
select log_client_error(repeat('x', 5000));
select log_client_error('');
reset role;
select check_((select count(*) from client_errors) = 2, 'errors logged (empty ones ignored)');
select check_((select char_length(message) from client_errors where user_id is not null) = 1000, 'long messages truncated');

-- ---------- Storage cleanup ----------
insert into storage.objects (bucket_id, name, created_at) values
  ('media', 'bbbbbbbb-0000-0000-0000-000000000002/listings/p2-keep.jpg', now() - interval '3 days'),
  ('media', 'bbbbbbbb-0000-0000-0000-000000000002/listings/p2-keep.t.jpg', now() - interval '3 days'),
  ('media', 'bbbbbbbb-0000-0000-0000-000000000002/listings/p2-old.jpg', now() - interval '3 days'),
  ('media', 'bbbbbbbb-0000-0000-0000-000000000002/listings/p2-old.t.jpg', now() - interval '3 days'),
  ('media', 'bbbbbbbb-0000-0000-0000-000000000002/listings/p2-new.jpg', now());
set role authenticated;
select t_as('bbbbbbbb-0000-0000-0000-000000000002');
insert into t_ids values ('b10', create_listing('Chess set', '', 'toys', 'good', '', array['bbbbbbbb-0000-0000-0000-000000000002/listings/p2-keep.jpg'], 12.98, 77.60));
select expect_error($$select * from orphan_media_paths()$$, 'permission denied');
reset role;
select check_((select array_agg(n order by n) from orphan_media_paths() n where n like 'bbbbbbbb%')
              = array['bbbbbbbb-0000-0000-0000-000000000002/listings/p2-old.jpg', 'bbbbbbbb-0000-0000-0000-000000000002/listings/p2-old.t.jpg'],
              'only old, unused files (and their small copies) are orphans');
update listings set status = 'removed', updated_at = now() - interval '8 days' where id = id_('b10');
alter table listings disable trigger trg_listings_updated;
update listings set updated_at = now() - interval '8 days' where id = id_('b10');
alter table listings enable trigger trg_listings_updated;
select check_(release_removed_listing_photos() = 1, 'photos of long-removed, never-offered items released');
select check_((select count(*) from orphan_media_paths() n where n like '%p2-keep%') = 2, 'released photos become orphans');
select purge_old_rows();

-- ---------- Browse everything (0012) ----------
set role authenticated;
select t_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into t_ids values ('a_far', create_listing('Sitar', '', 'music', 'good', '', array['aaaaaaaa-0000-0000-0000-000000000001/s.jpg'], 19.07, 72.87));
select t_as('eeeeeeee-0000-0000-0000-000000000005');
select check_(not exists (select 1 from nearby_listings(12.98, 77.60, 25) where id = id_('a_far')), '25 km filter leaves out Mumbai');
select check_(exists (select 1 from nearby_listings(12.98, 77.60, 0, null, null, 50) where id = id_('a_far')), 'Everywhere includes far items');
select check_((select distance_km from nearby_listings(12.98, 77.60, 0, null, null, 50) where id = id_('a_far')) > 800, 'far item shows its distance in km');
select check_((select distance_km from nearby_listings(12.98, 77.60, 0, null, null, 50) limit 1)
              <= (select max(distance_km) from nearby_listings(12.98, 77.60, 0, null, null, 50)), 'Everywhere is nearest first');
select check_((select count(*) from nearby_listings(null, null, 0, null, 'sitar')) = 1
              and (select distance_km from nearby_listings(null, null, 0, null, 'sitar')) is null, 'search everything without location, no distance');
select expect_error($$select * from nearby_listings(null, null, 5)$$, 'Location is needed');
select check_((select count(*) from nearby_listings(12.98, 77.60, 1)) <= (select count(*) from nearby_listings(12.98, 77.60, 10)), '1 km is a subset of 10 km');
reset role;

-- ---------- Shared item preview (0012) ----------
set role anon;
select check_((select title from listing_preview(id_('a_far'))) = 'Sitar', 'anyone with the link sees the item preview');
select check_((select count(*) from listing_preview(id_('d2'))) = 0, 'items of deleted accounts are not previewed');
select expect_error($$select lat from listings limit 1$$, 'permission denied');
reset role;

-- ---------- Neutral update link (0012) ----------
select check_(publish_release(8, 'https://github.com/someone/x.apk', 'Swap V 1.2'), 'release 8 recorded');
select check_((select value->>'url' from app_config where key = 'latest_release') = app_download_url(8), 'release link is Swap''s own address');
select check_((select data->>'url' from notification_queue where data->>'build' = '8') not like '%github%', 'update notice has no GitHub link');

\echo PLAY RELEASE TESTS PASSED
