// Nightly cleanup, started by pg_cron (see migration 0010):
//   * clears photos of items removed over a week ago that were never offered on
//   * deletes stored photo files that no item or profile uses any more
//     (replaced photos, old avatars, abandoned uploads), only if older than a day
//   * deletes old error logs, sent notifications and rate-limit counters
// Safe to call any time: it only ever removes things nothing points to.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async () => {
  try {
    const { data: released, error: relErr } = await sb.rpc('release_removed_listing_photos');
    if (relErr) throw relErr;

    let deleted = 0;
    for (let round = 0; round < 5; round++) {
      const { data, error } = await sb.rpc('orphan_media_paths', { p_limit: 500 });
      if (error) throw error;
      const paths = (data ?? []) as string[];
      if (paths.length === 0) break;
      for (let i = 0; i < paths.length; i += 100) {
        const { error: rmErr } = await sb.storage.from('media').remove(paths.slice(i, i + 100));
        if (rmErr) throw rmErr;
      }
      deleted += paths.length;
      if (paths.length < 500) break;
    }

    const { error: purgeErr } = await sb.rpc('purge_old_rows');
    if (purgeErr) throw purgeErr;

    return json({ releasedListings: released, deletedFiles: deleted });
  } catch (e) {
    console.error('maintenance failed', e);
    return json({ error: String(e) }, 500);
  }
});
