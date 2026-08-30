# Kall Konnect — download page + admin panel

Static landing page (`index.html`) for the Android APK download, plus a
lightweight `/admin` panel to edit the page and publish new APK builds
without touching code.

## How it works

- `index.html` is served as-is by Vercel. No build step.
- `admin.html` is a plain HTML/JS page (no framework) behind a single
  password. Once signed in it can:
  - Edit the raw HTML of `index.html` and commit the change straight to
    GitHub via the Contents API — that commit is what triggers Vercel's
    normal auto-deploy.
  - Upload a new APK. The file goes **directly from your browser to Vercel
    Blob storage**, not through a Vercel function, because Vercel functions
    reject any request body over 4.5MB and a real APK is almost always
    bigger than that. Once the upload finishes, the admin panel patches the
    download link (`#apk-download-link`) and version note
    (`#apk-version-note`) in `index.html` and commits that too.
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

5. **Set the remaining env vars** in Vercel (Project → Settings →
   Environment Variables) — see `.env.example` for the full list:
   `ADMIN_PASSWORD`, `SESSION_SECRET`, `GITHUB_TOKEN`, `GITHUB_OWNER`,
   `GITHUB_REPO`, `GITHUB_BRANCH`.

6. Redeploy once after setting env vars (Vercel doesn't pick them up
   retroactively for an existing deployment).

7. Visit `yourdomain.com/admin`, sign in with `ADMIN_PASSWORD`, upload your
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
