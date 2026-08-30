import { COOKIE_NAME, verifyToken } from '../_lib/auth.js'
import { parseCookies } from '../_lib/cookies.js'

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie)
  const authenticated = verifyToken(cookies[COOKIE_NAME])
  return res.status(200).json({ authenticated })
}
