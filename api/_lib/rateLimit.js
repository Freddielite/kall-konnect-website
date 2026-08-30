// Minimal in-memory rate limiter for the admin login endpoint.
//
// Caveat: this state lives in the serverless function's memory, so it resets
// on cold start and isn't shared across concurrent instances. It is NOT a
// hard guarantee against a determined distributed attacker. What it does do
// cheaply, with zero extra infra: stop the common case (a script hammering
// the endpoint from one place) and add real cost to guessing ADMIN_PASSWORD.
// For a harder guarantee, put /admin.html behind Vercel Deployment
// Protection or an IP allowlist instead.

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 5

const attempts = new Map() // ip -> { count, firstAttemptAt }

function prune(now) {
  for (const [ip, entry] of attempts) {
    if (now - entry.firstAttemptAt > WINDOW_MS) attempts.delete(ip)
  }
}

export function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

// Returns { blocked, retryAfterSeconds } — call before checking the
// password. Does not itself record an attempt.
export function checkRateLimit(ip) {
  const now = Date.now()
  prune(now)
  const entry = attempts.get(ip)
  if (!entry) return { blocked: false }
  if (now - entry.firstAttemptAt > WINDOW_MS) return { blocked: false }
  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((entry.firstAttemptAt + WINDOW_MS - now) / 1000)
    return { blocked: true, retryAfterSeconds }
  }
  return { blocked: false }
}

// Call after a failed password check.
export function recordFailure(ip) {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAttemptAt: now })
  } else {
    entry.count += 1
  }
}

// Call after a successful login to clear the counter for that IP.
export function recordSuccess(ip) {
  attempts.delete(ip)
}
