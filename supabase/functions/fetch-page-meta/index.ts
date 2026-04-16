import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extractText(html: string, regex: RegExp): string {
  return (html.match(regex)?.[1] || '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/<[^>]+>/g, '').trim()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: 'URL invalid' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ro,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `HTTP ${response.status}` }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const html = await response.text()

    // Title
    const title = extractText(html, /<title[^>]*>([\s\S]*?)<\/title>/i)

    // Meta description — multiple formats
    const metaDesc =
      extractText(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,500})["']/i) ||
      extractText(html, /<meta[^>]+content=["']([^"']{1,500})["'][^>]+name=["']description["']/i) ||
      extractText(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,500})["']/i) ||
      ''

    // H1
    const h1 = extractText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)

    // H2s — primele 6
    const h2Matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
    const h2s = h2Matches.slice(0, 6).map(m => extractText(m[0], /<h2[^>]*>([\s\S]*?)<\/h2>/i)).filter(Boolean)

    // Canonical URL
    const canonical = extractText(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
                      extractText(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i) || url

    // OG Title ca fallback
    const ogTitle = extractText(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,200})["']/i)

    return new Response(JSON.stringify({
      url,
      title:    title || ogTitle || '',
      metaDesc: metaDesc,
      h1:       h1,
      h2s:      h2s,
      canonical: canonical,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Eroare la fetch' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
