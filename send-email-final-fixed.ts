import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-secret-token',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check secret token
    const secretToken = req.headers.get('x-secret-token')
    
    if (!secretToken || secretToken !== 'pernador-email-secret-2026') {
      console.error('Missing or invalid secret token')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Secret token validated ✅')

    // Initialize Supabase - TRY ALL POSSIBLE KEY NAMES!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 
                          Deno.env.get('SERVICE_ROLE_KEY') || 
                          Deno.env.get('SUPABASE_SERVICE_KEY')
    
    if (!serviceRoleKey) {
      throw new Error('Service role key not found in environment')
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const body = await req.json()
    const { type, work_order_id, user_id } = body

    console.log('Processing:', { type, work_order_id, user_id })

    // Get user
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user_id)
      .single()

    if (profileError || !profile?.email) {
      console.error('User error:', profileError)
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get work order
    const { data: wo } = await supabase
      .from('work_orders')
      .select(`id, title, description, priority, equipment:equipment_id (name)`)
      .eq('id', work_order_id)
      .single()

    if (!wo) {
      return new Response(
        JSON.stringify({ error: 'Work order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Email
    const subject = '🔧 Comandă Nouă Asignată'
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">🔧 Pernador Maintenance</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <h2 style="color: #1e40af;">Comandă Nouă Asignată</h2>
          <p>Bună ${profile.full_name},</p>
          <p>Ți-a fost asignată o comandă de lucru nouă:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">${wo.title}</h3>
            ${wo.equipment ? `<p><strong>Echipament:</strong> ${wo.equipment.name}</p>` : ''}
            <p><strong>Prioritate:</strong> ${wo.priority?.toUpperCase()}</p>
            ${wo.description ? `<p>${wo.description}</p>` : ''}
          </div>
          <a href="https://mentenanta.pernador.ro/work-orders/${work_order_id}" 
             style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Vezi Detalii
          </a>
        </div>
      </div>
    `

    // Send
    console.log('Sending to:', profile.email)
    
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pernador Maintenance <noreply@resend.dev>',
        to: [profile.email],
        subject,
        html: htmlBody,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend error:', resendData)
      
      await supabase.from('email_logs').insert({
        to_email: profile.email,
        from_email: 'noreply@resend.dev',
        subject,
        template_type: type,
        work_order_id,
        user_id,
        status: 'failed',
        error_message: JSON.stringify(resendData),
      })

      throw new Error('Resend failed')
    }

    // Log
    await supabase.from('email_logs').insert({
      to_email: profile.email,
      from_email: 'noreply@resend.dev',
      subject,
      template_type: type,
      work_order_id,
      user_id,
      status: 'sent',
      sent_at: new Date().toISOString(),
      resend_id: resendData.id,
    })

    console.log('Email sent! ID:', resendData.id)

    return new Response(
      JSON.stringify({ success: true, email_id: resendData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
