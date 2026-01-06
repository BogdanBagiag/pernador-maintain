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
    
    console.log('Request received:', { userId, title })

    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create Supabase client with user's auth token (not service role)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Get user's push subscriptions
    const { data: subscriptions, error: dbError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (dbError) {
      console.error('DB Error:', dbError)
      throw dbError
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`)

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No subscriptions found',
          subscriptionsCount: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // For now, just return success
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Found ${subscriptions.length} subscription(s). Push sending will be implemented next.`,
        subscriptionsCount: subscriptions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
