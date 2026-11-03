-- Small hardening flagged by the Supabase security advisor.
alter function validate_photos(uuid, text[]) set search_path = public;
alter function snap_coord(double precision) set search_path = public;
alter function distance_km(double precision, double precision, double precision, double precision) set search_path = public;
alter function display_distance(double precision) set search_path = public;
alter function has_contact_info(text) set search_path = public;
alter function set_updated_at() set search_path = public;
-- Supabase's own helper; only used as an event trigger, never needs to be callable.
do $$ begin
  if exists (select 1 from pg_proc where proname = 'rls_auto_enable') then
    revoke execute on function rls_auto_enable() from authenticated, anon, public;
  end if;
end $$;
