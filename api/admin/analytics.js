import { requireAuth } from '../_lib/auth.js'

// Reads click totals from Vercel's Web Analytics API. This is a read-only
// query against the same aggregated data the Vercel dashboard shows — it
// does not track anything itself. Tracking happens client-side in
// index.html via the `va('event', ...)` calls on the download buttons.
//
// Requires Web Analytics to be enabled for this project in Vercel, plus
// VERCEL_TOKEN and VERCEL_PROJECT_ID env vars (VERCEL_TEAM_ID only if this
// project lives inside a team). See .env.example.

const API = 'https://api.vercel.com/v1/query/web-analytics'

function env() {
  const { VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID } = process.env
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) return null
  return { VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID }
}

async function countEvent(eventName, config) {
  const params = new URLSearchParams({
    projectId: config.VERCEL_PROJECT_ID,
    filter: `eventName eq '${eventName}'`,
  })
  if (config.VERCEL_TEAM_ID) params.set('teamId', config.VERCEL_TEAM_ID)

  const res = await fetch(`${API}/events/count?${params.toString()}`, {
    headers: { Authorization: `Bearer ${config.VERCEL_TOKEN}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Vercel Analytics API error (${res.status}): ${body || res.statusText}`)
  }
  const data = await res.json()
  return data?.data?.count ?? 0
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const config = env()
  if (!config) {
    return res.status(200).json({
      configured: false,
      message:
        'Analytics isn\u2019t connected yet. Add VERCEL_TOKEN and VERCEL_PROJECT_ID in your Vercel project\u2019s env vars, then redeploy. See README.md.',
    })
  }

  try {
    const [android, ios] = await Promise.all([
      countEvent('Android Click', config),
      countEvent('iPhone Click', config),
    ])
    return res.status(200).json({ configured: true, android, ios })
  } catch (err) {
    return res.status(200).json({ configured: false, message: err.message })
  }
}
