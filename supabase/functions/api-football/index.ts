import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const API_HOST = 'v3.football.api-sports.io'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('API_FOOTBALL_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API_FOOTBALL_KEY no configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    // Path after /api-football/ becomes the API-Football endpoint
    const match = url.pathname.match(/\/api-football\/(.*)$/)
    const endpoint = match ? match[1] : ''
    if (!endpoint) {
      return new Response(JSON.stringify({ error: 'Endpoint requerido. Ej: /api-football/fixtures' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const target = `https://${API_HOST}/${endpoint}${url.search}`
    const upstream = await fetch(target, {
      headers: { 'x-apisports-key': apiKey },
    })

    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'public, max-age=30',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
