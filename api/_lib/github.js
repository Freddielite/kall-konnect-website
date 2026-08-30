// Thin wrapper around the GitHub Contents API. Every save is a real git
// commit to the repo, which is what triggers Vercel's normal auto-deploy —
// no separate CMS, no separate dataset, nothing else to keep in sync.
//
// This is only used for text content (index.html). Binary APK uploads go
// through Vercel Blob instead — see api/admin/blob-upload.js — because
// GitHub's Contents API and Vercel's function payload limit both make it a
// poor fit for large files.

const API = 'https://api.github.com'

function env() {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } = process.env
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error(
      'GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO must all be set in the Vercel project env vars.'
    )
  }
  return { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH: GITHUB_BRANCH || 'main' }
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

// Returns { content, sha } with content decoded as utf-8 text, or throws.
// If the file doesn't exist, returns { content: null, sha: null } instead of
// throwing, so callers can tell "file missing" apart from "request failed".
export async function getFile(path) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } = env()
  const url = `${API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`
  const res = await fetch(url, { headers: headers(GITHUB_TOKEN) })
  if (res.status === 404) return { content: null, sha: null }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub GET ${path} failed (${res.status}): ${body}`)
  }
  const data = await res.json()
  const content = Buffer.from(data.content, 'base64').toString('utf-8')
  return { content, sha: data.sha }
}

// content: utf-8 string. sha: pass the current file's sha to update it, or
// omit/undefined to create a new file.
export async function putFile(path, content, sha, message) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } = env()
  const url = `${API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(GITHUB_TOKEN), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      sha: sha || undefined,
      branch: GITHUB_BRANCH,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub PUT ${path} failed (${res.status}): ${body}`)
  }
  return res.json()
}
