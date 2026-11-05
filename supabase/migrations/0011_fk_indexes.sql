-- Indexes for foreign keys the Supabase performance advisor flagged
-- (used by account deletion, moderation and the reports rate limit).
create index if not exists idx_notification_queue_user on notification_queue (user_id);
create index if not exists idx_ratings_rater on ratings (rater_id);
create index if not exists idx_reports_listing on reports (listing_id);
create index if not exists idx_reports_offer on reports (offer_id);
create index if not exists idx_reports_reported on reports (reported_user_id, status);
create index if not exists idx_reports_reporter on reports (reporter_id, created_at desc);
