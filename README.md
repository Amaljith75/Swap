# Swap

*One man's trash, another man's treasure.*

Swap is an Android app for trading items with people nearby. No money is involved.

1. List things you no longer use, with photos.
2. Browse items near you, sorted by approximate distance.
3. Offer one or more of your items for something you want.
4. The owner can accept, decline, or ask for different items (a counter-offer).
5. Once an offer is accepted, chat to agree a public meeting place. Swap the items, then both people tap **We swapped**.
6. The chat closes 5 minutes after the swap is complete. After that, you can rate each other.

Built with Expo (React Native + TypeScript), and Supabase for the database, sign-in, photo storage and live chat.

---

## Set it up (all from a phone browser)

### 1. Supabase database (one time)

1. Open your project on supabase.com and go to **SQL Editor → New query**.
2. If you ran the old cash/UPI schema in this project, first paste and run `supabase/reset_old_cash_schema.sql`. This deletes the old tables.
3. Paste each file in `supabase/migrations/` in number order and press **Run**. Each should say "Success. No rows returned". (Already done for the current project.)
4. Go to **Authentication → Sign In / Providers → Email**:
   - Keep **Email** enabled.
   - While testing, turn **Confirm email** OFF. This lets people sign in straight away. Supabase's built-in email sender only allows a few emails per hour, so confirmation emails get stuck quickly.
   - Turn it back on before a real launch, ideally with your own SMTP set up (Authentication → Emails → SMTP).
5. Go to **Project Settings → API** and copy:
   - the **Project URL**
   - the **anon / public** key. Never use the `service_role` key in the app.

### 2. GitHub repo + APK build

1. Create a repository on GitHub and upload this project's files to it. Do not upload `node_modules`.
2. The Supabase URL and anon key are already set in `src/lib/config.ts`. The anon key is meant to be public; row-level security protects the data. To point a build at a different project, add the GitHub secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (Settings → Secrets and variables → Actions); they override the defaults.
3. Go to **Actions → Build Android APK → Run workflow**. The build also runs on every push to `main`. It takes about 15–25 minutes.
4. When it turns green, open **Releases** on the repo's main page (or the run's summary). Download `swap-<number>.apk` on your phone and install it. Android will ask you to allow installs from your browser.

New builds install over old ones because they are all signed with the same key. That key is a development key: fine for testing and sideloading, but not for the Play Store. The Play Store build is made separately; see "Google Play release" below.

### 3. Try a full swap

You need two accounts to test properly, for example your phone and a friend's.

1. Both of you: create an account, list an item, and allow location.
2. Person A opens B's item and taps **Offer a swap**.
3. Person B goes to the **Offers** tab and taps **Accept**, or **Ask for other items**.
4. Both of you chat, then both tap **We swapped**. The chat shows a 5-minute countdown, then closes.
5. Both of you rate each other.

---

## How it stays safe

- **Approximate location only.** Positions are snapped to a ~550 m grid on the server. Nobody can read even that grid value directly. Distances are shown rounded, like "1.5 km away", and the place you search from is never stored.
- **The server decides everything.** The app can only read data. Every change goes through a database function that checks who is asking and whether the step is allowed. So nobody can accept their own offer, complete a swap alone, offer items they don't own, or edit someone else's things.
- **Both people must confirm** before a swap is complete.
- **Editing an item closes any open offers on it**, so nobody accepts a version they didn't see.
- **No contact details in chats, offers or profiles.** Phone numbers and links are blocked there, so meetups get arranged inside the app. This can be switched off in `app_config` with the setting `chat_block_contact_info`.
- **Ratings resist gaming.** Ratings are allowed only after a completed swap. Only each person's latest rating of someone counts, so repeated swaps with the same account can't inflate a score.
- **Block and report.** Blocking closes all open offers between two people and hides their items from each other. Reports notify every admin by push, and admins handle them in the app (Profile → Reports). To make someone an admin, add their user id to the `admin_users` table.
- **18+ only.** Sign-up requires confirming age and accepting the Terms and Privacy Policy. Existing accounts are asked once in the app.
- **Account deletion** in the app (Profile → Delete account) and on the web (`docs/delete-account.html`). Swaps in progress are closed, photos and personal details deleted, and past chats stay for the other person as "Deleted user".
- **Rate limits** on offers, messages, reports and nearby search.

Limits can be changed without an app update, in the `app_config` table:

- chat close time
- maximum photos per item
- maximum active items
- maximum items per offer
- offers per hour
- messages per minute
- maximum search radius

## Two Android builds

| | Sideload APK | Google Play |
|---|---|---|
| Workflow | `android-apk.yml`, on every push to `main` | `android-play.yml`, run by hand |
| Output | GitHub Release `build-N` (public `.apk`) | private `.aab` artifact to upload in Play Console |
| Signed with | the public debug key | your upload key (GitHub secrets) |
| Updates | in the app ("Update now") | Google Play |
| Version code | run number | 1000 + run number |

`APP_CHANNEL` (`sideload` or `play`) switches the in-app updater and the `REQUEST_INSTALL_PACKAGES` permission. Update notices only go to sideload installs.

## Google Play release

1. **Upload key.** On a computer (or ask someone to): `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`. Keep the file and passwords safe and backed up.
2. **GitHub secrets** (Settings → Secrets and variables → Actions): `UPLOAD_KEYSTORE_BASE64` (the output of `base64 -w0 upload.jks`), `UPLOAD_KEYSTORE_PASSWORD`, `UPLOAD_KEY_ALIAS` (`upload`), `UPLOAD_KEY_PASSWORD`. Optional: `GOOGLE_MAPS_API_KEY`.
3. **Web pages.** Settings → Pages → Deploy from a branch → `main`, folder `/docs`. This publishes the privacy policy, terms, account deletion and password reset pages at `https://amaljith75.github.io/swap/`. Put a contact email in `docs/site.js` first.
4. **Supabase Auth** (Authentication → URL Configuration): Site URL `https://amaljith75.github.io/swap/`; Redirect URLs add `https://amaljith75.github.io/swap/**`. Under Sign In / Providers → Email: minimum password length 8.
5. Actions → **Build for Google Play (AAB)** → Run workflow. Download the `.aab` from the run and upload it in Play Console.

## Sharing items

The share button on an item opens the phone's share sheet (WhatsApp, Instagram, Telegram, SMS and so on) with a link to
`docs/item.html?id=<item>`. That page shows a preview of the item and an **Open in Swap** button, which opens the item in
the app if it's installed and otherwise goes to the Google Play listing. Once Swap is live on Play, set `PLAY_LIVE: true`
in `docs/site.js` so the page also shows a "Get Swap on Google Play" button.

The web pages' address is one setting: `EXPO_PUBLIC_SITE_URL` (or the default in `src/lib/config.ts`) for the app, and
wherever `docs/` is hosted.

## Error reports

Uncaught errors and screen crashes are sent to the `client_errors` table (Table Editor → `client_errors`), with the screen, build and phone model. Rows are deleted after 90 days. A nightly job (`maintenance` Edge Function) also deletes photo files nothing uses any more.

## Project layout

```
app/                  screens (Expo Router)
  (auth)/             welcome, sign in / sign up
  (tabs)/             Explore, Offers, My items, Profile
  item/               item detail, new item, edit item
  offer/              make an offer, trade + chat screen, counter-offer
  user/ rate/ report  public profile, rating, report
  settings/           edit profile, blocked people, safety tips, delete account, version
  admin/              report queue (admins only)
  consent.tsx         18+ and terms confirmation
src/api/              data access (TanStack Query hooks around Supabase)
src/components/       Swap-specific components
src/ui/               small design-system primitives
src/lib/              config, Supabase client, location, photo upload, helpers
supabase/migrations/  the database schema, in order (*_schedules files need Supabase's pg_cron)
supabase/functions/   Edge Functions: notify, release-check, delete-account, maintenance
supabase/tests/       end-to-end SQL tests of the trade flow, security rules and release changes
plugins/              Expo config plugin that signs Play builds with your upload key
docs/                 public web pages (GitHub Pages): privacy, terms, delete account, reset password
.github/workflows/    APK build, Play (AAB) build, and checks on every push
```

## Developing on a computer (optional)

```bash
npm install
cp .env.example .env        # fill in URL + anon key
npx expo run:android        # needs Android Studio, or build with the workflow instead
npm run typecheck
```

Run the database tests against any local Postgres 16:

```bash
createdb swaptest
files=""; for m in supabase/migrations/0*.sql; do case "$m" in *_schedules*) ;; *) files="$files -f $m";; esac; done
psql -d swaptest -v ON_ERROR_STOP=1 -c 'create extension pgcrypto' -f supabase/tests/supabase_stubs.sql $files \
  -f supabase/tests/trade_flow_test.sql -f supabase/tests/play_release_test.sql
```

The same tests run on GitHub for every push (`checks.yml`).

## Going further

- **Phone number sign-in** (OTP) instead of email.
