# Kall Konnect — download page + admin panel

Static landing page (`index.html`) for the Android APK download, plus a
lightweight `/admin` panel to edit the page and publish new APK builds
without touching code.

## How it works

- `index.html` is served as-is by Vercel. No build step.
- `admin.html` is a plain HTML/JS page (no framework) behind a single
  password. It never shows raw HTML to whoever is signed in — every editable
  bit of copy on the page (headline, card text, download section, footer,
  etc.) has a stable `id` in `index.html`, and the admin panel reads/writes
  those elements as plain text via a simple form. Once signed in it can:
  - Edit the page's text through labeled fields and commit the change
    straight to GitHub via the Contents API — that commit is what triggers
    Vercel's normal auto-deploy. Under the hood this still fetches and saves
    the full `index.html`, it's just parsed/patched by element `id` instead
    of being shown as a textarea.
  - Upload a new APK. The file goes **directly from your browser to Vercel
    Blob storage**, not through a Vercel function, because Vercel functions
    reject any request body over 4.5MB and a real APK is almost always
    bigger than that. Once the upload finishes, the admin panel patches the
    download link and version label (`#apk-download-link`,
    `#apk-version-note`) in `index.html` and commits that too. The
    permanent "allow installs from unknown sources" line lives in its own
    element (`#android-note`) so it's never duplicated by a publish.
  - If you ever add a new piece of copy to `index.html` that should be
    editable from the admin, give that element a stable `id` and add a
    matching entry to the `FIELDS` array near the top of the `<script>` in
    `admin.html`.
  - The **Downloads** stats on the admin panel show total taps on the
    Android and iPhone buttons, read from Vercel Web Analytics. Tracking
    happens client-side in `index.html` (the `va('event', ...)` calls on
    each button); the admin panel reads the totals back out through
    `api/admin/analytics.js`, which queries Vercel's Web Analytics API.
    Nothing is stored outside Vercel's own analytics — this endpoint is
    read-only.
- Nothing is stored in a database. GitHub is the only source of truth for
  the page content; Vercel Blob is the only storage for APK files.

## One-time setup

1. **Push this to a new GitHub repo** (or add it to an existing one — just
   update `GITHUB_REPO` below to match).

2. **Create a Vercel project** from that repo. No build command needed —
   leave the framework preset as "Other".

3. **Create a Vercel Blob store**: in the Vercel dashboard, go to
   Storage → Create Database → Blob, and connect it to this project. That
   automatically adds `BLOB_READ_WRITE_TOKEN` to your project's env vars —
   you don't set it by hand.

4. **Create a GitHub token** scoped to just this repo:
   - GitHub → Settings → Developer settings → Personal access tokens →
     Fine-grained tokens → Generate new token.
   - Repository access: "Only select repositories" → pick this repo.
   - Permissions: Contents → Read and write. Nothing else.

5. **Turn on Web Analytics**: in the Vercel dashboard, open this project →
   Analytics tab → Enable. This is what powers the "Downloads" stats on
   the admin panel and needs no extra package since `index.html` already
   includes the tracking script tag directly.

6. **Create a Vercel access token** for the admin panel to read those stats
   back: Account Settings → Tokens → Create Token (read access is enough).
   Also grab this project's Project ID (Project → Settings → General) and,
   if this project lives inside a team rather than your personal account,
   the Team ID (Team Settings → General).

7. **Set the remaining env vars** in Vercel (Project → Settings →
   Environment Variables) — see `.env.example` for the full list:
   `ADMIN_PASSWORD`, `SESSION_SECRET`, `GITHUB_TOKEN`, `GITHUB_OWNER`,
   `GITHUB_REPO`, `GITHUB_BRANCH`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and
   `VERCEL_TEAM_ID` if applicable.

8. Redeploy once after setting env vars (Vercel doesn't pick them up
   retroactively for an existing deployment).

9. Visit `yourdomain.com/admin`, sign in with `ADMIN_PASSWORD`, upload your
   first real APK, add a version label, hit publish. The placeholder
   warning note on the download page disappears automatically once a real
   link is set.

## Security notes

- `ADMIN_PASSWORD`, `SESSION_SECRET`, and `GITHUB_TOKEN` all live only as
  server-side Vercel env vars — never sent to the browser.
- Login sets an HMAC-signed session token in an `HttpOnly`, `Secure` cookie,
  so page JavaScript can't read it and it's never sent over plain HTTP.
- Password comparisons use a timing-safe compare, and failed login attempts
  are rate-limited per IP (5 per 15 minutes).
- The GitHub token should be a **fine-grained** token scoped to only this
  repo's Contents permission — not a classic token with full account
  access — so a leak is contained to this one repo.
- For a harder guarantee than the built-in rate limiter, you can put
  `/admin` behind Vercel's Deployment Protection or an IP allowlist.

## Local development

There's no dev server needed for the static page — just open `index.html`.
For the `/admin` API routes, use the Vercel CLI: `vercel dev`, after running
`vercel env pull` to get your env vars locally. Note that the
`onUploadCompleted` callback in `api/admin/blob-upload.js` won't fire on
localhost (Vercel Blob can't reach it) — that's expected and doesn't block
the upload itself.
