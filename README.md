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
3. Paste all of `supabase/migrations/0001_barter.sql` and press **Run**. It should say "Success. No rows returned".
4. Go to **Authentication → Sign In / Providers → Email**:
   - Keep **Email** enabled.
   - While testing, turn **Confirm email** OFF. This lets people sign in straight away. Supabase's built-in email sender only allows a few emails per hour, so confirmation emails get stuck quickly.
   - Turn it back on before a real launch, ideally with your own SMTP set up (Authentication → Emails → SMTP).
5. Go to **Project Settings → API** and copy:
   - the **Project URL**
   - the **anon / public** key. Never use the `service_role` key in the app.

### 2. GitHub repo + APK build

1. Create a repository on GitHub and upload this project's files to it. Do not upload `node_modules`.
2. In the repo, go to **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `SUPABASE_URL`: your Project URL
   - `SUPABASE_ANON_KEY`: your anon key
3. Go to **Actions → Build Android APK → Run workflow**. The build also runs on every push to `main`. It takes about 15–25 minutes.
4. When it turns green, open **Releases** on the repo's main page (or the run's summary). Download `swap-<number>.apk` on your phone and install it. Android will ask you to allow installs from your browser.

New builds install over old ones because they are all signed with the same key. That key is a development key: fine for testing and sideloading, but not for the Play Store. See "Going further" below.

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
- **Block and report.** Blocking closes all open offers between two people and hides their items from each other. Reports go into the `reports` table for review.

Limits can be changed without an app update, in the `app_config` table:

- chat close time
- maximum photos per item
- maximum active items
- maximum items per offer
- offers per hour
- messages per minute
- maximum search radius

## Project layout

```
app/                  screens (Expo Router)
  (auth)/             welcome, sign in / sign up
  (tabs)/             Explore, Offers, My items, Profile
  item/               item detail, new item, edit item
  offer/              make an offer, trade + chat screen, counter-offer
  user/ rate/ report  public profile, rating, report
  settings/           edit profile, blocked people, safety tips
src/api/              data access (TanStack Query hooks around Supabase)
src/components/       Swap-specific components
src/ui/               small design-system primitives
src/lib/              config, Supabase client, location, photo upload, helpers
supabase/migrations/  the database schema (run once)
supabase/tests/       end-to-end SQL test of the trade flow and security rules
.github/workflows/    the APK build
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
psql -d swaptest -c 'create extension pgcrypto' \
  -f supabase/tests/supabase_stubs.sql \
  -f supabase/migrations/0001_barter.sql \
  -f supabase/tests/trade_flow_test.sql
```

## Going further

- **Push notifications** for new offers and messages. Right now updates arrive live while the app is open, and the Offers tab shows a badge. Push needs a Firebase project and an Expo account.
- **Play Store release.** This needs a private signing key (kept as GitHub secrets), an account-deletion option in the app, and a privacy policy.
- **Password reset.** Supabase can send reset emails; the app needs a screen and a deep link to handle the reset.
- **Admin tools** for reviewing reports and suspending accounts. For now, do this in the Supabase table editor: set `profiles.is_suspended`.
