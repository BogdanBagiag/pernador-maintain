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
    // SKIP JWT - Check secret token instead
    const secretToken = req.headers.get('x-secret-token')
    const expectedToken = Deno.env.get('EMAIL_SECRET_TOKEN') || 'pernador-email-secret-2026'
    
    if (secretToken !== expectedToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid secret token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 
                           Deno.env.get('SERVICE_ROLE_KEY') ||
                           Deno.env.get('SUPABASE_SERVICE_KEY')
    
    if (!serviceRoleKey) {
      throw new Error('Service role key not found')
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured')
    }

    const body = await req.json()
    const { type, work_order_id, user_id } = body

    console.log('Email request:', { type, work_order_id, user_id })

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user_id)
      .single()

    if (profileError || !profile?.email) {
      return new Response(
        JSON.stringify({ error: 'User not found or no email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get work order data
    const { data: wo } = await supabase
      .from('work_orders')
      .select(`
        id, title, description, priority, status, scheduled_date,
        equipment:equipment_id (name, serial_number)
      `)
      .eq('id', work_order_id)
      .single()

    if (!wo) {
      return new Response(
        JSON.stringify({ error: 'Work order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate email content
    const appUrl = 'https://mentenanta.pernador.ro'
    let subject = ''
    let htmlBody = ''

    if (type === 'wo_assigned') {
      subject = '🔧 Comandă Nouă Asignată'
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">🔧 Pernador Maintenance</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #1e40af;">Comandă Nouă Asignată</h2>
            <p>Bună ${profile.full_name},</p>
            <p>Ți-a fost asignată o comandă de lucru nouă:</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #111827;">${wo.title}</h3>
              ${wo.equipment ? `<p><strong>Echipament:</strong> ${wo.equipment.name}</p>` : ''}
              <p><strong>Prioritate:</strong> ${wo.priority?.toUpperCase()}</p>
              ${wo.scheduled_date ? `<p><strong>Termen:</strong> ${new Date(wo.scheduled_date).toLocaleDateString('ro-RO')}</p>` : ''}
              ${wo.description ? `<p style="color: #6b7280;">${wo.description}</p>` : ''}
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/work-orders/${work_order_id}" 
                 style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Vezi Detalii →
              </a>
            </div>
          </div>
          <div style="background: #e5e7eb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px;">
            <p>© 2026 Pernador Maintenance System</p>
          </div>
        </div>
      `
    }

    // Send via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pernador Maintenance <noreply@resend.dev>',
        to: [profile.email],
        subject: subject,
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

      throw new Error(`Resend error: ${JSON.stringify(resendData)}`)
    }

    // Log success
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

    console.log('Email sent:', resendData.id)

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
