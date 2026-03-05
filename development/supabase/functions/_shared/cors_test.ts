/**
 * Quick Deno test for CORS origin validation
 * Run: deno test --allow-none supabase/functions/_shared/cors_test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { getAllowedOrigin, getCorsHeaders } from './cors.ts'

function fakeReq(origin?: string): Request {
  const headers = new Headers()
  if (origin) headers.set('origin', origin)
  return new Request('https://example.com', { headers })
}

Deno.test('allows sentinel.netneural.ai', () => {
  assertEquals(getAllowedOrigin(fakeReq('https://sentinel.netneural.ai')), 'https://sentinel.netneural.ai')
})

Deno.test('allows demo-stage.netneural.ai', () => {
  assertEquals(getAllowedOrigin(fakeReq('https://demo-stage.netneural.ai')), 'https://demo-stage.netneural.ai')
})

Deno.test('allows demo.netneural.ai', () => {
  assertEquals(getAllowedOrigin(fakeReq('https://demo.netneural.ai')), 'https://demo.netneural.ai')
})

Deno.test('allows localhost:3000', () => {
  assertEquals(getAllowedOrigin(fakeReq('http://localhost:3000')), 'http://localhost:3000')
})

Deno.test('allows localhost:54321', () => {
  assertEquals(getAllowedOrigin(fakeReq('http://localhost:54321')), 'http://localhost:54321')
})

Deno.test('rejects unknown origin', () => {
  assertEquals(getAllowedOrigin(fakeReq('https://evil.com')), '')
})

Deno.test('rejects http variant of prod domain', () => {
  assertEquals(getAllowedOrigin(fakeReq('http://sentinel.netneural.ai')), '')
})

Deno.test('rejects subdomain spoofing', () => {
  assertEquals(getAllowedOrigin(fakeReq('https://fake-sentinel.netneural.ai')), '')
})

Deno.test('handles missing origin header', () => {
  assertEquals(getAllowedOrigin(fakeReq()), '')
})

Deno.test('getCorsHeaders returns validated origin', () => {
  const headers = getCorsHeaders(fakeReq('https://sentinel.netneural.ai'))
  assertEquals(headers['Access-Control-Allow-Origin'], 'https://sentinel.netneural.ai')
  assertEquals(headers['Access-Control-Allow-Methods'], 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
})

Deno.test('getCorsHeaders returns empty origin for unknown', () => {
  const headers = getCorsHeaders(fakeReq('https://evil.com'))
  assertEquals(headers['Access-Control-Allow-Origin'], '')
})

// Edge cases
Deno.test('rejects origin with trailing slash', () => {
  assertEquals(getAllowedOrigin(fakeReq('https://sentinel.netneural.ai/')), '')
})

Deno.test('rejects origin with port on prod domain', () => {
  assertEquals(getAllowedOrigin(fakeReq('https://sentinel.netneural.ai:443')), '')
})

Deno.test('rejects null origin string', () => {
  assertEquals(getAllowedOrigin(fakeReq('null')), '')
})
