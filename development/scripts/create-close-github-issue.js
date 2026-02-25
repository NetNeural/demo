#!/usr/bin/env node

/**
 * Create and immediately close a GitHub issue for documentation/traceability
 * Usage: node scripts/create-close-issue.js "Issue Title" "Issue Body"
 */

const https = require('https')

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO_OWNER = 'NetNeural'
const REPO_NAME = 'MonoRepo-Staging'

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN environment variable required')
  process.exit(1)
}

function githubRequest(method, path, body = null) {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${REPO_OWNER}/${REPO_NAME}${path}`,
    method: method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'NetNeural-Issue-Creator',
      'Content-Type': 'application/json',
    },
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data))
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function createIssue(title, body) {
  return githubRequest('POST', '/issues', { title, body })
}

async function closeIssue(issueNumber, comment) {
  await githubRequest('POST', `/issues/${issueNumber}/comments`, {
    body: comment,
  })
  return githubRequest('PATCH', `/issues/${issueNumber}`, { state: 'closed' })
}

async function main() {
  const title = process.argv[2]
  const body = process.argv[3]
  const closeComment = process.argv[4] || 'Completed and documented.'

  if (!title || !body) {
    console.error(
      'Usage: node create-close-issue.js "Title" "Body" ["Close Comment"]'
    )
    process.exit(1)
  }

  try {
    console.log('📝 Creating issue...')
    const issue = await createIssue(title, body)
    console.log(`✅ Created issue #${issue.number}: ${issue.html_url}`)

    console.log('🔒 Closing issue...')
    await closeIssue(issue.number, closeComment)
    console.log('✅ Issue closed with completion comment')

    console.log('')
    console.log('🎉 Done! Issue created and closed for traceability.')
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

main()
