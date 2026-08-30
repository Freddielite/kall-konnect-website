// Minimal, dependency-free cookie handling — just enough for one signed
// session cookie. No need to pull in a package for this.

export function parseCookies(header = '') {
  const out = {}
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=')
    if (idx === -1) return
    const key = pair.slice(0, idx).trim()
    const val = pair.slice(idx + 1).trim()
    if (key) out[key] = decodeURIComponent(val)
  })
  return out
}

export function serializeCookie(name, value, { maxAge } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  // Vercel previews and production are always served over https, so this is
  // safe to set unconditionally; only local plain-http testing would lose
  // the cookie, and the admin panel isn't meant to be used that way anyway.
  parts.push('Secure')
  parts.push(typeof maxAge === 'number' ? `Max-Age=${maxAge}` : 'Max-Age=0')
  return parts.join('; ')
}
