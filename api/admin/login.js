import { COOKIE_NAME, createToken, passwordsMatch, SESSION_HOURS } from '../_lib/auth.js'
import { serializeCookie } from '../_lib/cookies.js'
import { checkRateLimit, getClientIp, recordFailure, recordSuccess } from '../_lib/rateLimit.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
    return res.status(500).json({
      error:
        'Admin panel is not configured yet. Set ADMIN_PASSWORD and SESSION_SECRET in your Vercel project env vars, then redeploy.',
    })
  }

  const ip = getClientIp(req)
  const { blocked, retryAfterSeconds } = checkRateLimit(ip)
  if (blocked) {
    res.setHeader('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({
      error: `Too many failed attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
    })
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }

  const { password } = body || {}
  if (!password || !passwordsMatch(password, process.env.ADMIN_PASSWORD)) {
    recordFailure(ip)
    return res.status(401).json({ error: 'Incorrect password.' })
  }
  recordSuccess(ip)

  const token = createToken()
  res.setHeader(
    'Set-Cookie',
    serializeCookie(COOKIE_NAME, token, { maxAge: SESSION_HOURS * 60 * 60 })
  )
  return res.status(200).json({ ok: true })
}
