# UCInsights — login & cloud backup setup

The web app has a built-in account system (login / register / magic link / Google)
that backs up each user's **profile, tracker and meds** to a private, per-user row
in a Postgres database and syncs it across devices. It uses [Supabase](https://supabase.com)
(free tier is plenty to start).

Until you paste your two project keys (step 3) the app runs exactly as before —
fully local, no account button shown. Nothing breaks.

## 1. Create the project (≈3 min)

1. Go to https://supabase.com → sign in → **New project**.
2. Pick a name, a strong DB password, and **region = EU (Frankfurt)** — important
   for GDPR / Turkey KVKK since this is health data.
3. Wait for it to provision.

## 2. Create the table

- Dashboard → **SQL Editor** → **New query** → paste the contents of
  [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
- This creates the `user_state` table with Row-Level Security (each user can only
  see their own data).

## 3. Wire the web app to it

- Dashboard → **Project Settings → API**. Copy:
  - **Project URL** (looks like `https://abcd1234.supabase.co`)
  - **anon public** key (safe to ship in the browser — RLS protects the data)
- In `index.html`, find the two placeholders near the bottom (in the
  "AUTH + CLOUD SYNC" script) and replace them:

  ```js
  var SUPA_URL  = window.UC_SUPABASE_URL  || '__SUPABASE_URL__';
  var SUPA_ANON = window.UC_SUPABASE_ANON || '__SUPABASE_ANON_KEY__';
  ```

  → put your Project URL and anon key in place of the `__...__` strings.

That's it — a person icon appears in the nav; click it to register or sign in.

## 4. Turn on the login methods you want

Dashboard → **Authentication → Providers / Sign-in**:

- **Email** is on by default. For the smoothest UX you can disable "Confirm email"
  while testing (re-enable for production).
- **Magic link** works out of the box with Email.
- **Google**: enable the Google provider and paste a Google OAuth client ID/secret,
  then add your site URL under **Authentication → URL Configuration → Redirect URLs**
  (e.g. `https://your-vercel-domain.com`). The "Continue with Google" button only
  works once this is set; otherwise just use email.

## 5. (Recommended for health data)

- Add a short privacy policy + consent line at signup.
- Keep the **EU region**.
- Free tier has no automatic backups; flip to **Pro ($25/mo)** when you have real
  users to get daily backups + point-in-time recovery. You can also export anytime
  via Dashboard → Database → Backups, or `pg_dump`.
- Don't advertise "HIPAA compliant" unless you sign Supabase's BAA (Team tier).

## How sync behaves

- Data stays **local-first** (the app still works offline). When signed in, the
  local `uc-profile-v1` / `uc-tracker-v1` / `uc-meds-v1` are merged with the cloud
  copy on sign-in, then pushed up automatically (every 15s if changed, and when the
  tab is hidden). Tracker days are unioned so nothing is lost.

## Reusing this for iOS / Android

The same `user_state` table + RLS works for the native apps via `supabase-swift`
and `supabase-kt` — point them at the same Project URL + anon key and read/write
the same three JSON columns. Web first, then port.
