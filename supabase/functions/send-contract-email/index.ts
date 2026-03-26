// supabase/functions/send-contract-email/index.ts
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
    // Verifică autentificarea
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Neautorizat' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verifică utilizatorul autentificat
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Sesiune invalidă' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { contractId } = await req.json()
    if (!contractId) {
      return new Response(JSON.stringify({ error: 'contractId lipsă' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch contract
    const { data: contract, error: contractError } = await supabaseAdmin
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single()

    if (contractError || !contract) {
      return new Response(JSON.stringify({ error: 'Contract negăsit' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!contract.buyer_email) {
      return new Response(JSON.stringify({ error: 'Contractul nu are email client setat' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://pernador.mentenanta.ro'
    const signingUrl = `${appUrl}/semna-contract/${contract.sign_token}`
    const gmailUser = Deno.env.get('GMAIL_USER')!
    const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')!

    // Configurare Gmail SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    })

    const emailHtml = `
<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; background: #f9fafb; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #1e40af; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 20px;">📄 Contract pentru semnare</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 15px;">Bună ziua,</p>
      <p style="color: #374151; font-size: 15px;">
        Vă transmitem spre semnare <strong>contractul de vânzare-cumpărare ${contract.contract_number}</strong> 
        din partea <strong>${contract.seller_name}</strong>.
      </p>
      
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; font-weight: bold; text-transform: uppercase;">Detalii contract</p>
        <p style="margin: 4px 0; color: #111827; font-size: 14px;"><strong>Nr:</strong> ${contract.contract_number}</p>
        <p style="margin: 4px 0; color: #111827; font-size: 14px;"><strong>Cumpărător:</strong> ${contract.buyer_name}</p>
        <p style="margin: 4px 0; color: #111827; font-size: 14px;"><strong>Data:</strong> ${contract.contract_date}</p>
      </div>
      
      <p style="color: #374151; font-size: 14px;">
        Vă rugăm să accesați link-ul de mai jos, să verificați datele companiei dvs. și să aplicați semnătura electronică:
      </p>
      
      <div style="text-align: center; margin: 28px 0;">
        <a href="${signingUrl}" 
           style="background: #059669; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: bold; display: inline-block;">
          ✍️ Semnez Contractul
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
        Sau copiați acest link în browser:<br/>
        <span style="color: #2563eb; word-break: break-all;">${signingUrl}</span>
      </p>
      
      <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">
        După semnare veți primi pe acest email o copie PDF a contractului semnat.<br/>
        Pentru întrebări ne puteți contacta la: <strong>${gmailUser}</strong>
      </p>
    </div>
    <div style="background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">${contract.seller_name} — Document generat electronic</p>
    </div>
  </div>
</body>
</html>`

    await transporter.sendMail({
      from: `"${contract.seller_name}" <${gmailUser}>`,
      to: contract.buyer_email,
      subject: `Contract ${contract.contract_number} — Semnare electronică`,
      html: emailHtml,
    })

    // Actualizează status la 'sent'
    await supabaseAdmin
      .from('contracts')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', contractId)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
