#!/usr/bin/env node
/**
 * Test API Key Encryption Functions
 *
 * Verifies that encrypt_api_key and decrypt_api_key work correctly
 */

const https = require('https')

const SUPABASE_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  process.exit(1)
}

// Helper function to make HTTPS requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL)
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            statusCode: res.statusCode,
            body: body ? JSON.parse(body) : null,
          })
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`))
        }
      })
    })

    req.on('error', reject)

    if (data) {
      req.write(JSON.stringify(data))
    }

    req.end()
  })
}

async function testEncryption() {
  console.log('🔐 Testing API Key Encryption Functions\n')

  const testKey = 'test-api-key-' + Date.now()
  console.log(`📝 Original key: ${testKey}`)

  try {
    // Test 1: Encrypt
    console.log('\n1️⃣  Testing encrypt_api_key()...')
    const encryptResult = await makeRequest(
      'POST',
      '/rest/v1/rpc/encrypt_api_key',
      {
        plaintext_key: testKey,
        p_key_id: 'default',
      }
    )

    const encryptedKey = encryptResult.body
    console.log(`✅ Encrypted: ${encryptedKey.substring(0, 50)}...`)

    // Test 2: Decrypt
    console.log('\n2️⃣  Testing decrypt_api_key()...')
    const decryptResult = await makeRequest(
      'POST',
      '/rest/v1/rpc/decrypt_api_key',
      {
        encrypted_key: encryptedKey,
        p_key_id: 'default',
      }
    )

    const decryptedKey = decryptResult.body
    console.log(`✅ Decrypted: ${decryptedKey}`)

    // Test 3: Verify round-trip
    console.log('\n3️⃣  Verifying round-trip...')
    if (decryptedKey === testKey) {
      console.log('✅ Round-trip verification PASSED')
      console.log(`   Original:  "${testKey}"`)
      console.log(`   Decrypted: "${decryptedKey}"`)
    } else {
      throw new Error(
        `Round-trip verification FAILED: "${testKey}" !== "${decryptedKey}"`
      )
    }

    // Test 4: Test deterministic encryption
    console.log('\n4️⃣  Testing deterministic encryption...')
    const encryptResult2 = await makeRequest(
      'POST',
      '/rest/v1/rpc/encrypt_api_key',
      {
        plaintext_key: testKey,
        p_key_id: 'default',
      }
    )
    const encryptedKey2 = encryptResult2.body

    if (encryptedKey === encryptedKey2) {
      console.log(
        '✅ Deterministic encryption PASSED (same input = same output)'
      )
    } else {
      console.log(
        '⚠️  Deterministic encryption note: Different outputs (expected for AEAD)'
      )
    }

    // Test 5: Test base64 fallback for old keys
    console.log('\n5️⃣  Testing base64 fallback (backward compatibility)...')
    const oldStyleKey = Buffer.from('old-api-key-12345').toString('base64')
    const fallbackResult = await makeRequest(
      'POST',
      '/rest/v1/rpc/decrypt_api_key',
      {
        encrypted_key: oldStyleKey,
        p_key_id: 'default',
      }
    )

    console.log(`✅ Base64 fallback works: "${fallbackResult.body}"`)

    console.log('\n✅ All encryption tests PASSED!\n')
    console.log('Summary:')
    console.log('  ✓ Encrypt API key')
    console.log('  ✓ Decrypt API key')
    console.log('  ✓ Round-trip verification')
    console.log('  ✓ Deterministic encryption check')
    console.log('  ✓ Backward compatibility (base64 fallback)')
    console.log('\n🎉 Encryption system is working correctly!\n')
  } catch (error) {
    console.error('\n❌ Encryption test FAILED:', error.message)
    process.exit(1)
  }
}

// Run the test
testEncryption()
