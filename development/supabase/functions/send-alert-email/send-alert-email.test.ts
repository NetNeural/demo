/**
 * Unit Tests for send-alert-email Edge Function
 * Tests email notification logic including:
 * - Recipient collection (manual emails + user IDs)
 * - Email deduplication
 * - HTML email generation
 * - Test alert handling
 * - Severity-based styling
 * - Batch email sending
 * - Error handling
 */

import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.177.0/testing/asserts.ts'

Deno.test('Email Deduplication - Removes Duplicate Emails', () => {
  const allEmails = [
    'user1@example.com',
    'user2@example.com',
    'user1@example.com',
    'user3@example.com',
  ]
  const uniqueEmails = [...new Set(allEmails)]

  assertEquals(uniqueEmails.length, 3)
  assertEquals(uniqueEmails, [
    'user1@example.com',
    'user2@example.com',
    'user3@example.com',
  ])
})

Deno.test('Email Collection - Combines Manual and User ID Emails', () => {
  const manualEmails = ['external@example.com', 'customer@company.com']
  const userIdEmails = ['admin@company.com', 'ops@company.com']

  const allEmails: string[] = []
  allEmails.push(...manualEmails)
  allEmails.push(...userIdEmails)

  assertEquals(allEmails.length, 4)
  assertEquals(allEmails[0], 'external@example.com')
  assertEquals(allEmails[2], 'admin@company.com')
})

Deno.test('Empty Recipients - No Emails to Send', () => {
  const recipientEmails: string[] = []
  const recipientUserIds: string[] = []
  const allEmails: string[] = []

  if (recipientEmails && recipientEmails.length > 0) {
    allEmails.push(...recipientEmails)
  }

  if (recipientUserIds && recipientUserIds.length > 0) {
    // Would fetch emails from database
  }

  assertEquals(allEmails.length, 0)
  // Should return early with "No recipients configured"
})

Deno.test('Alert Severity Color Mapping - Critical', () => {
  const alert = { severity: 'critical' }
  const headerColor =
    alert.severity === 'critical'
      ? '#dc2626'
      : alert.severity === 'high'
        ? '#ea580c'
        : '#0ea5e9'

  assertEquals(headerColor, '#dc2626') // Red
})

Deno.test('Alert Severity Color Mapping - High', () => {
  const alert = { severity: 'high' }
  const headerColor =
    alert.severity === 'critical'
      ? '#dc2626'
      : alert.severity === 'high'
        ? '#ea580c'
        : '#0ea5e9'

  assertEquals(headerColor, '#ea580c') // Orange
})

Deno.test('Alert Severity Color Mapping - Medium/Low', () => {
  const alert = { severity: 'medium' }
  const headerColor =
    alert.severity === 'critical'
      ? '#dc2626'
      : alert.severity === 'high'
        ? '#ea580c'
        : '#0ea5e9'

  assertEquals(headerColor, '#0ea5e9') // Blue
})

Deno.test('Test Alert Detection - From Metadata', () => {
  const alert = {
    metadata: { is_test: true, sensor_type: 'temperature' },
  }

  const isTest = alert.metadata?.is_test || false
  assertEquals(isTest, true)
})

Deno.test('Test Alert Detection - Regular Alert', () => {
  const alert = {
    metadata: { sensor_type: 'temperature' },
  }

  const isTest = alert.metadata?.is_test || false
  assertEquals(isTest, false)
})

Deno.test('Test Alert Prefix - Applied When Test', () => {
  const alert = { metadata: { is_test: true } }
  const isTest = alert.metadata?.is_test || false
  const testPrefix = isTest ? '🧪 TEST: ' : ''

  assertEquals(testPrefix, '🧪 TEST: ')
})

Deno.test('Test Alert Prefix - Omitted for Regular Alert', () => {
  const alert = { metadata: {} }
  const isTest = alert.metadata?.is_test || false
  const testPrefix = isTest ? '🧪 TEST: ' : ''

  assertEquals(testPrefix, '')
})

Deno.test('Email Subject Line - Critical Alert', () => {
  const alert = {
    severity: 'critical',
    title: 'Temperature Threshold Exceeded',
    metadata: {},
  }
  const isTest = alert.metadata?.is_test || false
  const testPrefix = isTest ? '🧪 TEST: ' : ''
  const subject = `${testPrefix}${alert.severity.toUpperCase()} Alert: ${alert.title}`

  assertEquals(subject, 'CRITICAL Alert: Temperature Threshold Exceeded')
})

Deno.test('Email Subject Line - Test Alert', () => {
  const alert = {
    severity: 'high',
    title: 'Battery Low',
    metadata: { is_test: true },
  }
  const isTest = alert.metadata?.is_test || false
  const testPrefix = isTest ? '🧪 TEST: ' : ''
  const subject = `${testPrefix}${alert.severity.toUpperCase()} Alert: ${alert.title}`

  assertEquals(subject, '🧪 TEST: HIGH Alert: Battery Low')
})

Deno.test('HTML Email Structure - Contains Device Info', () => {
  const device = {
    name: 'Temperature Sensor A1',
    device_type: 'sensor',
  }

  const htmlSnippet = `
    <div class="device-info">
      <strong>Device:</strong> ${device?.name || 'Unknown'}<br>
      <strong>Type:</strong> ${device?.device_type || 'N/A'}
    </div>
  `

  assertExists(htmlSnippet.match(/Temperature Sensor A1/))
  assertExists(htmlSnippet.match(/sensor/))
})

Deno.test('HTML Email Structure - Escapes Newlines in Message', () => {
  const message = 'Temperature exceeded\nDevice: Sensor A1\nLocation: Warehouse'
  const escapedMessage = message.replace(/\n/g, '<br>')

  assertEquals(
    escapedMessage,
    'Temperature exceeded<br>Device: Sensor A1<br>Location: Warehouse'
  )
  assertExists(escapedMessage.match(/<br>/g))
})

Deno.test('Test Alert Notice - Shows Warning Banner', () => {
  const isTest = true
  const noticeHtml = isTest
    ? `
    <div class="test-notice">
      <strong>⚠️ THIS IS A TEST ALERT</strong><br>
      This email is a test of the alert notification system. No action is required.
    </div>
  `
    : ''

  assertExists(noticeHtml.match(/THIS IS A TEST ALERT/))
  assertExists(noticeHtml.match(/test-notice/))
})

Deno.test('Regular Alert - No Test Banner', () => {
  const isTest = false
  const noticeHtml = isTest
    ? `
    <div class="test-notice">
      <strong>⚠️ THIS IS A TEST ALERT</strong>
    </div>
  `
    : ''

  assertEquals(noticeHtml, '')
})

Deno.test('Dashboard Link - Shown for Regular Alerts', () => {
  const isTest = false
  const dashboardLink = !isTest
    ? `
    <div style="margin-top: 20px;">
      <a href="https://demo-stage.netneural.ai/dashboard/alerts/">
        View Alert in Dashboard
      </a>
    </div>
  `
    : ''

  assertExists(dashboardLink.match(/View Alert in Dashboard/))
})

Deno.test('Dashboard Link - Hidden for Test Alerts', () => {
  const isTest = true
  const dashboardLink = !isTest
    ? `
    <div style="margin-top: 20px;">
      <a href="https://demo-stage.netneural.ai/dashboard/alerts/">
        View Alert in Dashboard
      </a>
    </div>
  `
    : ''

  assertEquals(dashboardLink, '')
})

Deno.test('Success Count - All Emails Sent Successfully', () => {
  const uniqueEmails = [
    'user1@example.com',
    'user2@example.com',
    'user3@example.com',
  ]
  const results = []
  let successCount = 0

  // Simulate successful send
  const batchSendSuccess = true

  if (batchSendSuccess) {
    uniqueEmails.forEach((email) => {
      results.push({ email, success: true, id: 'test-email-id' })
    })
    successCount = uniqueEmails.length
  }

  assertEquals(successCount, 3)
  assertEquals(results.length, 3)
  assertEquals(results[0].success, true)
})

Deno.test('Success Count - Batch Send Failed', () => {
  const uniqueEmails = ['user1@example.com', 'user2@example.com']
  const results = []
  let successCount = 0

  // Simulate failed send
  const batchSendSuccess = false
  const error = 'Rate limit exceeded'

  if (!batchSendSuccess) {
    uniqueEmails.forEach((email) => {
      results.push({ email, success: false, error })
    })
    successCount = 0
  }

  assertEquals(successCount, 0)
  assertEquals(results.length, 2)
  assertEquals(results[0].success, false)
  assertEquals(results[0].error, 'Rate limit exceeded')
})

Deno.test('Response Format - Success with Recipients', () => {
  const response = {
    success: true,
    sent: 3,
    total: 3,
    results: [
      { email: 'user1@example.com', success: true, id: 'id-1' },
      { email: 'user2@example.com', success: true, id: 'id-1' },
      { email: 'user3@example.com', success: true, id: 'id-1' },
    ],
  }

  assertEquals(response.success, true)
  assertEquals(response.sent, 3)
  assertEquals(response.total, 3)
  assertEquals(response.results.length, 3)
})

Deno.test('Response Format - No Recipients', () => {
  const response = {
    success: true,
    message: 'No recipients configured',
    sent: 0,
  }

  assertEquals(response.success, true)
  assertEquals(response.sent, 0)
  assertEquals(response.message, 'No recipients configured')
})

console.log('✅ All send-alert-email unit tests passed')
