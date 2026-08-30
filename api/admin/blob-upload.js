import { handleUpload } from '@vercel/blob/client'
import { requireAuth } from '../_lib/auth.js'

// This route never sees the APK's bytes. It only issues a short-lived
// client token so the browser can PUT the file straight to Vercel Blob,
// which is required because Vercel Functions reject any request body over
// 4.5MB (a real APK is almost always bigger than that). requireAuth() below
// is what stops a stranger from getting a token and uploading to your
// store — without it this route would allow anonymous uploads.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!requireAuth(req, res)) return

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'application/vnd.android.package-archive',
          'application/octet-stream',
        ],
        // Fixed pathname (not addRandomSuffix) so the file Vercel Blob
        // serves is always named "kall-konnect.apk" for anyone downloading
        // it -- addRandomSuffix would tack on a random string that ends up
        // as the filename in the visitor's Save As dialog. allowOverwrite
        // lets each new publish replace the previous build at that same
        // path. cacheControlMaxAge is kept short since this same URL now
        // changes content on every publish, unlike a normal immutable blob.
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        maximumSizeInBytes: 300 * 1024 * 1024, // 300MB, well above any real APK
      }),
      onUploadCompleted: async ({ blob }) => {
        // Vercel Blob calls this server-to-server once the upload finishes.
        // It won't reach you on localhost, only on a real deployment, and
        // that's fine — admin.html also gets the blob URL directly in the
        // browser response and patches index.html itself either way.
        console.log('APK upload completed:', blob.url)
      },
    })
    return res.status(200).json(jsonResponse)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
}
