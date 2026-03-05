/**
 * CORS Headers for Edge Functions
 * Origin-validated: only allows requests from known NetNeural domains.
 *
 * Usage:
 *   // At the top of your handler (where `req` is available):
 *   const corsHeaders = makeCorsHeaders(req)
 *
 *   // For CORS preflight:
 *   if (req.method === 'OPTIONS') {
 *     return new Response('ok', { headers: corsHeaders })
 *   }
 *
 *   // For responses:
 *   return new Response(body, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
 */

const ALLOWED_ORIGINS = [
  'https://sentinel.netneural.ai',
  'https://demo-stage.netneural.ai',
  'https://demo.netneural.ai',
  'http://localhost:3000',
  'http://localhost:54321',
]

/**
 * Returns the request origin if it's in the allow-list, empty string otherwise.
 */
export function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get('origin') || ''
  return ALLOWED_ORIGINS.includes(origin) ? origin : ''
}

/**
 * Build CORS headers with validated origin for a given request.
 * This is the preferred way to get CORS headers in edge functions.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(req),
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-device-id, x-protocol',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin',
  }
}

/**
 * Alias for getCorsHeaders — drop-in replacement for legacy `corsHeaders` constant.
 * Import as: `import { makeCorsHeaders } from '../_shared/cors.ts'`
 * Then at handler top: `const corsHeaders = makeCorsHeaders(req)`
 */
export const makeCorsHeaders = getCorsHeaders

/** @deprecated Use makeCorsHeaders(req) or getCorsHeaders(req) for origin-validated responses */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-device-id, x-protocol',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}
