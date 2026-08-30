import { COOKIE_NAME } from '../_lib/auth.js'
import { serializeCookie } from '../_lib/cookies.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', { maxAge: 0 }))
  return res.status(200).json({ ok: true })
}
