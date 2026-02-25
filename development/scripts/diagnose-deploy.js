#!/usr/bin/env node

/**
 * Deployment Diagnostic Script
 * Checks git status, verifies workflows, and triggers manual deployments
 */

const { execSync } = require('child_process')
const path = require('path')

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function exec(command, options = {}) {
  try {
    const result = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    })
    return { success: true, output: result }
  } catch (error) {
    return {
      success: false,
      output: error.stdout || error.stderr || error.message,
    }
  }
}

function section(title) {
  log('\n' + '='.repeat(60), 'cyan')
  log(title, 'bright')
  log('='.repeat(60), 'cyan')
}

// Change to repo root
try {
  const repoRoot = path.resolve(__dirname, '../..')
  process.chdir(repoRoot)
  log(`Working directory: ${repoRoot}`, 'blue')
} catch (error) {
  log(`Failed to change directory: ${error.message}`, 'red')
  process.exit(1)
}

section('1️⃣ Git Status')
log('Current branch and status:', 'yellow')
exec('git status -sb')

section('2️⃣ Recent Commits (Local)')
log('Last 5 commits on current branch:', 'yellow')
exec('git log --oneline -5')

section('3️⃣ Remote Status')
log('Fetching from remote...', 'yellow')
const fetchResult = exec('git fetch origin main', { silent: true })
if (fetchResult.success) {
  log('✅ Fetch succeeded', 'green')
} else {
  log('⚠️  Fetch failed', 'yellow')
}

log('\nRemote commits (origin/main):', 'yellow')
exec('git log origin/main --oneline -5')

section('4️⃣ Local vs Remote Comparison')
const localCommit = exec('git rev-parse HEAD', { silent: true })
const remoteCommit = exec('git rev-parse origin/main', { silent: true })

if (localCommit.success && remoteCommit.success) {
  const local = localCommit.output.trim()
  const remote = remoteCommit.output.trim()

  if (local === remote) {
    log('✅ Local and remote are in sync', 'green')
  } else {
    log('⚠️  Local and remote are different', 'yellow')
    log(`   Local:  ${local}`, 'yellow')
    log(`   Remote: ${remote}`, 'yellow')

    // Check for unpushed commits
    const unpushed = exec('git log origin/main..HEAD --oneline', {
      silent: true,
    })
    if (unpushed.success && unpushed.output.trim()) {
      log('\n📤 Unpushed commits:', 'yellow')
      console.log(unpushed.output)
    }
  }
}

section('5️⃣ GitHub CLI Status')
const ghVersion = exec('gh --version', { silent: true })
if (ghVersion.success) {
  log('✅ GitHub CLI installed', 'green')
  console.log(ghVersion.output.split('\n')[0])

  log('\nAuthentication status:', 'yellow')
  exec('gh auth status')
} else {
  log('❌ GitHub CLI not installed', 'red')
}

section('6️⃣ Recent Workflow Runs')
log('Fetching recent workflow runs...', 'yellow')
const runs = exec('gh run list --limit 5', { silent: true })
if (runs.success) {
  console.log(runs.output)
} else {
  log('⚠️  Could not fetch workflow runs', 'yellow')
  log(runs.output, 'yellow')
}

section('7️⃣ Available Workflows')
log('Listing workflows in repository...', 'yellow')
const workflows = exec('gh workflow list', { silent: true })
if (workflows.success) {
  console.log(workflows.output)
} else {
  log('⚠️  Could not list workflows', 'yellow')
}

section('8️⃣ Manual Workflow Trigger')
log(
  'Would you like to manually trigger workflows? (requires user confirmation)',
  'yellow'
)
log('You can run these commands manually:', 'cyan')
log('  gh workflow run test.yml', 'bright')
log('  gh workflow run deploy-staging.yml -f force_deploy=true', 'bright')

section('9️⃣ Dependencies Check')
log('Checking for @testing-library/dom in package.json...', 'yellow')
const pkgJsonPath = path.join(process.cwd(), 'development', 'package.json')
try {
  const pkgJson = require(pkgJsonPath)
  if (pkgJson.devDependencies?.['@testing-library/dom']) {
    log(
      `✅ @testing-library/dom found: ${pkgJson.devDependencies['@testing-library/dom']}`,
      'green'
    )
  } else {
    log('❌ @testing-library/dom NOT found in devDependencies', 'red')
  }
} catch (error) {
  log(`⚠️  Could not read package.json: ${error.message}`, 'yellow')
}

section('🔟 Summary & Next Steps')
log('\n📋 Action Items:', 'bright')
log('1. If unpushed commits exist, push them: git push origin main', 'cyan')
log(
  '2. View workflows at: https://github.com/NetNeural/MonoRepo-Staging/actions',
  'cyan'
)
log('3. Manually trigger test workflow: gh workflow run test.yml', 'cyan')
log(
  '4. Manually trigger deploy: gh workflow run deploy-staging.yml -f force_deploy=true',
  'cyan'
)
log(
  '5. Check staging site: https://demo-stage.netneural.ai/dashboard/devices/',
  'cyan'
)

log('\n✅ Diagnostic complete!', 'green')
