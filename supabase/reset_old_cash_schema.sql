-- Run this ONLY if you already ran the old cash/UPI migration (0001_schema.sql)
-- in this Supabase project. It deletes those old tables and everything in them.
-- Then run migrations/0001_barter.sql.

drop view if exists public_profiles cascade;

drop table if exists
  messages, ratings, reports, blocks, notifications, transaction_events, transactions,
  matches, requests, availability, exchange_points, institution_members, institutions,
  app_config, admin_users, profiles
cascade;

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists handle_new_user() cascade;
drop function if exists is_admin() cascade;
drop function if exists set_updated_at() cascade;

drop type if exists verification_level, institution_type, member_role, member_status,
  offer_direction, need_direction, listing_status, txn_status, report_reason, report_status
cascade;
