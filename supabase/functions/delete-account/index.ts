// Deletes the signed-in person's Swap account. Called from the app (Profile →
// Delete account) and from the web page docs/delete-account.html.
//
// Body: { "confirm": "DELETE" }   Header: Authorization: Bearer <the user's access token>
//
// 1. Works out who is asking from their own access token (nobody can delete someone else).
// 2. Deletes every file in their photo folder (media/<user id>/...).
// 3. Deletes the auth user. A database trigger (scrub_account) then closes their
//    open swaps, removes their items and anonymises their profile as "Deleted user".
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Sign in first.' }, 401);
  const { data: who, error: whoErr } = await admin.auth.getUser(jwt);
  const user = who?.user;
  if (whoErr || !user) return json({ error: 'Your session has expired. Sign in again.' }, 401);

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== 'DELETE') return json({ error: 'Type DELETE to confirm.' }, 400);

  try {
    // Photos first: Supabase won't delete a user who still owns storage objects.
    const { data: paths, error: pathErr } = await admin.rpc('account_media_paths', { p_uid: user.id });
    if (pathErr) throw pathErr;
    const files = (paths ?? []) as string[];
    for (let i = 0; i < files.length; i += 100) {
      const { error } = await admin.storage.from('media').remove(files.slice(i, i + 100));
      if (error) throw error;
    }

    // Close swaps and anonymise now, so the other person is told even if the
    // auth delete below has to be retried. (The auth trigger runs it again; it is idempotent.)
    const { error: scrubErr } = await admin.rpc('scrub_account', { p_uid: user.id });
    if (scrubErr) throw scrubErr;

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) throw delErr;

    return json({ deleted: true, files: files.length });
  } catch (e) {
    console.error('delete-account failed', user.id, e);
    return json({ error: 'Could not delete the account right now. Please try again in a few minutes.' }, 500);
  }
});
