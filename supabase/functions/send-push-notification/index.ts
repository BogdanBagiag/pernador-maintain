import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, title, body, url } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get user's subscriptions (public read access via RLS)
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const payload = JSON.stringify({
      title,
      body,
      data: { url },
      icon: '/icon-192.png',
      badge: '/icon-192.png'
    })

    // Send to each subscription
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const res = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'TTL': '86400',
            },
            body: payload
          })
          
          return { success: res.ok, status: res.status }
        } catch (err) {
          return { success: false, error: err.message }
        }
      })
    )

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: results.filter(r => r.success).length,
        total: results.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
