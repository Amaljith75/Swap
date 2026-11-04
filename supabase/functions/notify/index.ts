// Sends queued push notifications through Firebase Cloud Messaging (HTTP v1).
// Body: { "id": <notification_queue id> } or { "retry": true } to flush stuck rows.
// Only rows already in the queue are ever sent, so this endpoint needs no caller auth.
// Secret required: FCM_SERVICE_ACCOUNT = the Firebase service-account JSON.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

interface QueueRow {
  id: number;
  user_id: string | null;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = new TextEncoder();

let cached: { token: string; exp: number } | null = null;

async function googleAccessToken(sa: { client_email: string; private_key: string }) {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(
    enc.encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${claims}`)));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google auth failed: ${res.status} ${await res.text()}`);
  const out = await res.json();
  cached = { token: out.access_token, exp: Date.now() + out.expires_in * 1000 };
  return cached.token;
}

async function sendOne(row: QueueRow) {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!raw) {
    await sb.from('notification_queue').update({ status: 'skipped', error: 'FCM_SERVICE_ACCOUNT not set' }).eq('id', row.id);
    return { id: row.id, status: 'skipped' };
  }
  const sa = JSON.parse(raw);
  let q = sb.from('push_tokens').select('token,platform');
  q = row.user_id ? q.eq('user_id', row.user_id) : q.limit(5000);
  const { data: tokens, error } = await q;
  if (error) throw error;

  const access = await googleAccessToken(sa);
  const data = Object.fromEntries(Object.entries(row.data ?? {}).map(([k, v]) => [k, String(v ?? '')]));
  const dead: string[] = [];
  let sent = 0;
  for (const t of tokens ?? []) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: t.token,
          notification: { title: row.title, body: row.body },
          data,
          android: {
            priority: 'HIGH',
            notification: { channel_id: 'default', sound: 'default', tag: data.offer_id || data.type },
          },
          apns: { payload: { aps: { sound: 'default' } } },
        },
      }),
    });
    if (res.ok) sent++;
    else if (res.status === 404 || res.status === 400) dead.push(t.token); // unregistered / invalid token
  }
  if (dead.length) await sb.from('push_tokens').delete().in('token', dead);
  await sb
    .from('notification_queue')
    .update({ status: 'sent', sent_at: new Date().toISOString(), error: dead.length ? `${dead.length} dead tokens removed` : null })
    .eq('id', row.id);
  return { id: row.id, status: 'sent', sent };
}

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  try {
    let ids: number[] = [];
    if (body.id) ids = [Number(body.id)];
    else if (body.retry) {
      const { data } = await sb
        .from('notification_queue')
        .select('id')
        .eq('status', 'pending')
        .lt('created_at', new Date(Date.now() - 30_000).toISOString())
        .gt('created_at', new Date(Date.now() - 6 * 3600_000).toISOString())
        .limit(50);
      ids = (data ?? []).map((r) => r.id);
    } else return json({ error: 'id required' }, 400);

    const results = [];
    for (const id of ids) {
      // Claim the row so a retry and a trigger can't both send it.
      const { data: rows } = await sb
        .from('notification_queue')
        .update({ status: 'sending' })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id,user_id,title,body,data');
      const row = rows?.[0] as QueueRow | undefined;
      if (!row) continue;
      try {
        results.push(await sendOne(row));
      } catch (e) {
        await sb.from('notification_queue').update({ status: 'failed', error: String(e).slice(0, 500) }).eq('id', id);
        results.push({ id, status: 'failed' });
      }
    }
    return json({ results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
