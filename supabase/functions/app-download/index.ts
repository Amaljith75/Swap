// Swap's own download address for app updates:
//   GET /functions/v1/app-download?build=8
// The app (and update notifications) only ever see this address. It forwards
// the download to where the APK file is stored, so nothing in the app links to
// or shows the GitHub account that builds it.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const STORE = 'https://github.com/Amaljith75/Swap/releases/download';

Deno.serve((req) => {
  const build = Number(new URL(req.url).searchParams.get('build'));
  if (!Number.isInteger(build) || build < 1 || build > 1_000_000) {
    return new Response('Unknown version.', { status: 404 });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: `${STORE}/build-${build}/swap-${build}.apk`, 'Cache-Control': 'public, max-age=300' },
  });
});
