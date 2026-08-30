import crypto from 'node:crypto'
import { parseCookies } from './cookies.js'

const SECRET = process.env.SESSION_SECRET

const SESSION_HOURS = 8
const COOKIE_NAME = 'admin_session'

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function createToken() {
  const exp = Date.now() + SESSION_HOURS * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifyToken(token) {
  if (!token || !SECRET) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false

  const expected = sign(payload)
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length) return false
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false

  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    return typeof exp === 'number' && Date.now() < exp
  } catch {
    return false
  }
}

// Constant-time-ish string compare for the login password check.
export function passwordsMatch(a, b) {
  const aBuf = Buffer.from(String(a ?? ''))
  const bBuf = Buffer.from(String(b ?? ''))
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}

// Call at the top of any protected API route. Sends a 401 and returns false
// if the request isn't authenticated; otherwise returns true.
export function requireAuth(req, res) {
  if (!SECRET) {
    res.status(500).json({ error: 'SESSION_SECRET is not configured on the server.' })
    return false
  }
  const cookies = parseCookies(req.headers.cookie)
  if (!verifyToken(cookies[COOKIE_NAME])) {
    res.status(401).json({ error: 'Not signed in.' })
    return false
  }
  return true
}

export { COOKIE_NAME, SESSION_HOURS }
