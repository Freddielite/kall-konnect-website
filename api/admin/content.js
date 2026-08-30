import { requireAuth } from '../_lib/auth.js'
import { getFile, putFile } from '../_lib/github.js'

const FILE_PATH = 'index.html'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return

  if (req.method === 'GET') {
    try {
      const { content, sha } = await getFile(FILE_PATH)
      if (content === null) {
        return res.status(404).json({ error: `${FILE_PATH} not found in the repo yet.` })
      }
      return res.status(200).json({ content, sha })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        body = {}
      }
    }
    const { content, sha, message } = body || {}
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required.' })
    }
    try {
      const result = await putFile(
        FILE_PATH,
        content,
        sha,
        message || 'Update index.html via admin panel'
      )
      return res.status(200).json({ ok: true, sha: result.content.sha })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
