#!/usr/bin/env node
/**
 * Database-based restart monitor for MQTT subscriber
 * Polls Supabase for restart requests and executes them
 *
 * This approach works when SSH/webhook access is not available
 * The MQTT subscriber container runs this alongside the main process
 */

const { createClient } = require('@supabase/supabase-js')
const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

// Configuration
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://atgbmxicqikmapfqouco.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const POLL_INTERVAL = parseInt(process.env.RESTART_POLL_INTERVAL || '30') * 1000 // Default 30s
const SERVICE_NAME = 'mqtt-subscriber'
const SERVICE_DIR = process.env.SERVICE_DIR || '/opt/mqtt-subscriber'

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable required')
  process.exit(1)
}

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

console.log('🔍 MQTT Restart Monitor Started')
console.log(
  `📡 Polling Supabase every ${POLL_INTERVAL / 1000}s for restart requests`
)
console.log(`🏷️  Service: ${SERVICE_NAME}`)
console.log(`📁 Directory: ${SERVICE_DIR}`)
console.log('')

/**
 * Execute restart command
 */
async function executeRestart(requestId) {
  console.log(`🔄 Executing restart for request ${requestId}`)

  try {
    // Update status to processing
    await supabase
      .from('service_restart_requests')
      .update({
        status: 'processing',
        processed_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    // Pull latest code (only if this is a git repo)
    let pullOutput = 'skipped (not a git repo)'
    try {
      const { stdout, stderr } = await execAsync('git pull', {
        cwd: SERVICE_DIR,
        timeout: 30000,
      })
      pullOutput = stdout.trim() || stderr.trim()
      if (
        stderr &&
        !stdout.includes('Already up to date') &&
        !stdout.includes('Updating')
      ) {
        console.warn('⚠️  git pull stderr:', stderr.trim())
      }
    } catch (gitErr) {
      console.warn('⚠️  git pull skipped:', gitErr.message)
    }

    console.log('✅ Code updated:', pullOutput.trim())

    // Rebuild TypeScript if tsc is available
    try {
      console.log('🔨 Rebuilding TypeScript...')
      const { stdout: tscOutput } = await execAsync('npx tsc', {
        cwd: SERVICE_DIR,
        timeout: 60000,
      })
      console.log('✅ TypeScript built:', tscOutput.trim() || 'ok')
    } catch (tscErr) {
      console.warn('⚠️  tsc failed (continuing anyway):', tscErr.message)
    }

    // Restart via PM2 (preferred) or docker-compose fallback
    console.log('🔄 Restarting service...')
    let restartOutput = ''
    try {
      const { stdout } = await execAsync('pm2 restart mqtt-subscriber', {
        cwd: SERVICE_DIR,
        timeout: 60000,
      })
      restartOutput = stdout.trim()
    } catch {
      // Fallback to docker-compose
      const { stdout } = await execAsync(
        'docker-compose restart mqtt-subscriber',
        { cwd: SERVICE_DIR, timeout: 60000 }
      )
      restartOutput = stdout.trim()
    }

    console.log('✅ Service restarted:', restartOutput)

    // Update status to completed
    await supabase
      .from('service_restart_requests')
      .update({
        status: 'completed',
        result: {
          success: true,
          pull_output: pullOutput.trim(),
          restart_output: restartOutput.trim(),
          completed_at: new Date().toISOString(),
        },
      })
      .eq('id', requestId)

    console.log(`✅ Restart completed successfully for request ${requestId}`)
  } catch (error) {
    console.error(`❌ Restart failed for request ${requestId}:`, error.message)

    // Update status to failed
    await supabase
      .from('service_restart_requests')
      .update({
        status: 'failed',
        result: {
          success: false,
          error: error.message,
          failed_at: new Date().toISOString(),
        },
      })
      .eq('id', requestId)
  }
}

/**
 * Poll for pending restart requests
 */
async function pollForRestarts() {
  try {
    const { data: requests, error } = await supabase
      .from('service_restart_requests')
      .select('*')
      .eq('service_name', SERVICE_NAME)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true })
      .limit(1)

    if (error) {
      console.error('❌ Error polling for restarts:', error.message)
      return
    }

    if (requests && requests.length > 0) {
      const request = requests[0]
      console.log(`🔔 Restart request found: ${request.id}`)
      await executeRestart(request.id)
    }
  } catch (error) {
    console.error('❌ Error in poll loop:', error.message)
  }
}

// Start polling
console.log('✅ Starting poll loop...')
setInterval(pollForRestarts, POLL_INTERVAL)

// Do an immediate poll on startup
pollForRestarts()

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down...')
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down...')
  process.exit(0)
})
