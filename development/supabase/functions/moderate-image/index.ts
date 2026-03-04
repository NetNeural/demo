/**
 * moderate-image Edge Function
 * Uses OpenAI GPT-4o-mini vision to detect adult, violent, or suspect imagery.
 * Returns { safe: boolean, reason?: string }
 *
 * Expects POST with JSON body: { imageBase64: string } (data-URL or raw base64)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface ModerationResult {
  safe: boolean
  reason?: string
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      // If no API key, fail-open with a warning (don't block uploads)
      console.warn('⚠️ OPENAI_API_KEY not configured — skipping image moderation')
      return new Response(
        JSON.stringify({ safe: true, reason: 'moderation_unavailable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    let { imageBase64 } = body as { imageBase64: string }

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ensure it's a proper data URL for OpenAI vision
    if (!imageBase64.startsWith('data:')) {
      imageBase64 = `data:image/jpeg;base64,${imageBase64}`
    }

    // Call OpenAI GPT-4o-mini with vision
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 150,
        messages: [
          {
            role: 'system',
            content:
              'You are a content moderation system. Analyze the image and determine if it contains adult, sexually explicit, violent, gory, hateful, or otherwise inappropriate content. Respond ONLY with a JSON object: { "safe": true } if the image is acceptable, or { "safe": false, "reason": "<brief reason>" } if it is not. Be strict about nudity, violence, and hate symbols. Logos, diagrams, floor plans, product photos, landscapes, and professional images are safe.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageBase64, detail: 'low' },
              },
              {
                type: 'text',
                text: 'Is this image safe for a professional IoT platform? Respond with JSON only.',
              },
            ],
          },
        ],
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', openaiResponse.status, errorText)
      // Fail-open on API errors — don't block uploads because of transient issues
      return new Response(
        JSON.stringify({ safe: true, reason: 'moderation_api_error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await openaiResponse.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''

    // Parse the JSON response from GPT
    let result: ModerationResult = { safe: true }
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\s*/g, '').replace(/```/g, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      console.warn('Failed to parse moderation response, defaulting to safe:', content)
      result = { safe: true, reason: 'parse_error' }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Moderation error:', error)
    // Fail-open on unexpected errors
    return new Response(
      JSON.stringify({ safe: true, reason: 'moderation_error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
