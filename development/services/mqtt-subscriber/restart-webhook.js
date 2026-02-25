#!/usr/bin/env node
/**
 * Simple webhook server for restarting MQTT subscriber service
 * Runs on demo-stage.netneural.ai:9999 (or configured port)
 *
 * Usage:
 *   node restart-webhook.js
 *   curl -X POST http://demo-stage.netneural.ai:9999/restart -H "X-Restart-Token: YOUR_SECRET_TOKEN"
 */

const http = require('http')
const { exec } = require('child_process')
const crypto = require('crypto')

// Configuration
const PORT = process.env.WEBHOOK_PORT || 9999
const RESTART_TOKEN =
  process.env.RESTART_TOKEN || crypto.randomBytes(32).toString('hex')
const SERVICE_DIR = process.env.SERVICE_DIR || '/opt/mqtt-subscriber'

console.log('🚀 MQTT Restart Webhook Server')
console.log(`📡 Listening on port: ${PORT}`)
console.log(`🔐 Restart token: ${RESTART_TOKEN}`)
console.log(`📁 Service directory: ${SERVICE_DIR}`)
console.log('')

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Restart-Token')

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'healthy',
        service: 'mqtt-restart-webhook',
        timestamp: new Date().toISOString(),
      })
    )
    return
  }

  // Restart endpoint
  if (req.url === '/restart' && req.method === 'POST') {
    const token = req.headers['x-restart-token']

    // Verify token
    if (!token || token !== RESTART_TOKEN) {
      console.log('❌ Unauthorized restart attempt:', {
        ip: req.socket.remoteAddress,
        token: token ? 'invalid' : 'missing',
        timestamp: new Date().toISOString(),
      })
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    console.log('🔵 Restart request received:', {
      ip: req.socket.remoteAddress,
      timestamp: new Date().toISOString(),
    })

    // Execute restart command
    const restartCommand = `cd ${SERVICE_DIR} && git pull && docker-compose restart mqtt-subscriber`

    exec(restartCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Restart failed:', error)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            success: false,
            error: error.message,
            stderr: stderr,
            timestamp: new Date().toISOString(),
          })
        )
        return
      }

      console.log('✅ MQTT service restarted successfully')
      console.log('📤 stdout:', stdout)
      if (stderr) console.log('📤 stderr:', stderr)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: true,
          message: 'MQTT subscriber restarted successfully',
          stdout: stdout,
          stderr: stderr,
          timestamp: new Date().toISOString(),
        })
      )
    })
    return
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`✅ Webhook server running on http://0.0.0.0:${PORT}`)
  console.log(`📋 Endpoints:`)
  console.log(`   GET  /health  - Health check`)
  console.log(
    `   POST /restart - Restart service (requires X-Restart-Token header)`
  )
  console.log('')
})

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})
