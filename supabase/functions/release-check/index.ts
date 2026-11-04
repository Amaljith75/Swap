// Runs on a schedule (pg_cron). Looks at the latest GitHub Release; if its build
// number is newer than the one recorded in app_config, records it and queues an
// "update available" notification for everyone (via publish_release()).
// The repo must be public for the unauthenticated GitHub API call to work.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const REPO = Deno.env.get('GITHUB_REPO') ?? 'Amaljith75/swap';
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async () => {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { 'User-Agent': 'swap-release-check', Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return json({ error: `GitHub ${res.status}` }, 502);
  const rel = await res.json();
  const build = Number(String(rel.tag_name ?? '').match(/(\d+)$/)?.[1] ?? 0);
  const apk = (rel.assets ?? []).find((a: { name: string }) => a.name.endsWith('.apk'));
  if (!build || !apk) return json({ skipped: 'no apk release' });
  const { data, error } = await sb.rpc('publish_release', {
    p_build: build,
    p_url: apk.browser_download_url,
    p_name: rel.name ?? `Build ${build}`,
  });
  if (error) return json({ error: error.message }, 500);
  return json({ build, published: data });
});
