#!/usr/bin/env node
/**
 * Create and immediately close a GitHub issue for traceability
 * 
 * Usage:
 *   node scripts/create-close-issue.js \
 *     --title "Feature: Add Device button" \
 *     --body "Implementation details..." \
 *     --label "enhancement" \
 *     --comment "✅ Completed and deployed"
 * 
 * Environment:
 *   GITHUB_TOKEN - Personal access token with repo scope
 */

const https = require('https');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const title = getArg('--title');
const body = getArg('--body');
const label = getArg('--label');
const closeComment = getArg('--comment') || '✅ Completed';

// Validate required arguments
if (!title || !body) {
  console.error('❌ Error: --title and --body are required');
  console.error('\nUsage:');
  console.error('  node scripts/create-close-issue.js \\');
  console.error('    --title "Feature title" \\');
  console.error('    --body "Feature description" \\');
  console.error('    --label "enhancement" \\');
  console.error('    --comment "Completion message"');
  process.exit(1);
}

// Get GitHub token
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('❌ Error: GITHUB_TOKEN or GH_TOKEN environment variable required');
  console.error('   Set via: export GITHUB_TOKEN=<your-token>');
  process.exit(1);
}

// GitHub API configuration
const REPO_OWNER = 'NetNeural';
const REPO_NAME = 'MonoRepo-Staging';

/**
 * Make GitHub API request
 */
function githubRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'NetNeural-Issue-Creator',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`GitHub API error ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Create GitHub issue
 */
async function createIssue() {
  const issueData = {
    title: title,
    body: body,
    labels: label ? [label] : []
  };

  console.log('📝 Creating issue...');
  const issue = await githubRequest(
    'POST',
    `/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
    issueData
  );
  
  console.log(`✅ Created issue #${issue.number}: ${issue.html_url}`);
  return issue;
}

/**
 * Close GitHub issue
 */
async function closeIssue(issueNumber) {
  console.log(`🔒 Closing issue #${issueNumber}...`);
  
  // Add closing comment
  await githubRequest(
    'POST',
    `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/comments`,
    { body: closeComment }
  );
  
  // Close the issue
  await githubRequest(
    'PATCH',
    `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}`,
    { state: 'closed' }
  );
  
  console.log(`✅ Closed issue #${issueNumber}`);
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 GitHub Issue Creator\n');
    console.log(`Repository: ${REPO_OWNER}/${REPO_NAME}`);
    console.log(`Title: ${title}`);
    console.log(`Label: ${label || 'none'}\n`);

    // Create issue
    const issue = await createIssue();
    
    // Close issue
    await closeIssue(issue.number);
    
    console.log('\n✅ Done! Issue created and closed for traceability.');
    console.log(`   View at: ${issue.html_url}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run
main();
