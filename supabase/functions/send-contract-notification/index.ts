// supabase/functions/send-contract-notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.9'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Neautorizat' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Sesiune invalidă' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // type: 'cancelled' | 'restored'
    const { contractId, type } = await req.json()
    if (!contractId || !type) {
      return new Response(JSON.stringify({ error: 'contractId și type sunt obligatorii' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: contract, error: contractError } = await supabaseAdmin
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single()

    if (contractError || !contract) {
      return new Response(JSON.stringify({ error: 'Contract negăsit' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!contract.buyer_email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_email' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const gmailUser = Deno.env.get('GMAIL_USER')!
    const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')!

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    })

    const isCancelled = type === 'cancelled'

    const subject = isCancelled
      ? `Contractul ${contract.contract_number} a fost anulat`
      : `Contractul ${contract.contract_number} a fost reactivat`

    const headerColor = isCancelled ? '#dc2626' : '#059669'
    const headerIcon = isCancelled ? '🚫' : '✅'
    const headerTitle = isCancelled ? 'Contract Anulat' : 'Contract Reactivat'

    const bodyText = isCancelled
      ? `Vă informăm că <strong>contractul ${contract.contract_number}</strong> încheiat cu <strong>${contract.seller_name}</strong> a fost <strong style="color:#dc2626">anulat</strong>.`
      : `Vă informăm că <strong>contractul ${contract.contract_number}</strong> încheiat cu <strong>${contract.seller_name}</strong> a fost <strong style="color:#059669">reactivat</strong> și este din nou în vigoare.`

    const footerText = isCancelled
      ? 'Dacă aveți întrebări legate de anularea acestui contract, vă rugăm să ne contactați.'
      : 'Contractul este acum activ. Dacă aveți întrebări, vă rugăm să ne contactați.'

    const emailHtml = `
<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; background: #f9fafb; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: ${headerColor}; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 20px;">${headerIcon} ${headerTitle}</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 15px;">Stimate ${contract.buyer_representative || contract.buyer_name},</p>
      <p style="color: #374151; font-size: 15px;">${bodyText}</p>

      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; font-weight: bold; text-transform: uppercase;">Detalii contract</p>
        <p style="margin: 4px 0; color: #111827; font-size: 14px;"><strong>Nr:</strong> ${contract.contract_number}</p>
        <p style="margin: 4px 0; color: #111827; font-size: 14px;"><strong>Cumpărător:</strong> ${contract.buyer_name}</p>
        <p style="margin: 4px 0; color: #111827; font-size: 14px;"><strong>Vânzător:</strong> ${contract.seller_name}</p>
        <p style="margin: 4px 0; color: #111827; font-size: 14px;"><strong>Data contract:</strong> ${contract.contract_date}</p>
      </div>

      <p style="color: #6b7280; font-size: 14px;">${footerText}</p>
      <p style="color: #6b7280; font-size: 13px;">Contact: <strong>${gmailUser}</strong></p>
    </div>
    <div style="background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">${contract.seller_name} — Notificare automată</p>
    </div>
  </div>
</body>
</html>`

    await transporter.sendMail({
      from: `"${contract.seller_name}" <${gmailUser}>`,
      to: contract.buyer_email,
      subject,
      html: emailHtml,
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
