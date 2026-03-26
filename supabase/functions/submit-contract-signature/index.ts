// supabase/functions/submit-contract-signature/index.ts
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
    const { token, signatureData, pdfBase64 } = await req.json()

    if (!token || !signatureData) {
      return new Response(JSON.stringify({ error: 'Date incomplete' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch contract by token
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('*')
      .eq('sign_token', token)
      .single()

    if (fetchError || !contract) {
      return new Response(JSON.stringify({ error: 'Contract negăsit sau token invalid' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (contract.status === 'signed') {
      return new Response(JSON.stringify({ error: 'Contractul a fost deja semnat' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (contract.status === 'cancelled') {
      return new Response(JSON.stringify({ error: 'Contractul a fost anulat' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let signedPdfPath: string | null = null

    // Upload PDF în Supabase Storage
    if (pdfBase64) {
      try {
        const base64Data = pdfBase64.split(',')[1]
        const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
        const fileName = `${contract.id}/contract-signed-${Date.now()}.pdf`

        const { error: uploadError } = await supabase.storage
          .from('contracts')
          .upload(fileName, pdfBytes, {
            contentType: 'application/pdf',
            upsert: true,
          })

        if (!uploadError) {
          signedPdfPath = fileName
        } else {
          console.error('PDF upload error:', uploadError)
        }
      } catch (pdfErr) {
        console.error('PDF processing error:', pdfErr)
      }
    }

    // Actualizează contractul
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        status: 'signed',
        signed_at: now,
        signature_data: signatureData,
        signed_pdf_path: signedPdfPath,
        updated_at: now,
      })
      .eq('id', contract.id)

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Eroare la salvare: ' + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Trimite email de confirmare cu Gmail SMTP
    const gmailUser = Deno.env.get('GMAIL_USER')
    const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')

    if (gmailUser && gmailPass && contract.buyer_email) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const pdfDownloadUrl = signedPdfPath
          ? `${supabaseUrl}/storage/v1/object/public/contracts/${signedPdfPath}`
          : null

        const signedDate = new Date(now).toLocaleDateString('ro-RO', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })

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
    <div style="background: #059669; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 20px;">✅ Contract semnat cu succes!</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 15px;">Bună ziua, <strong>${contract.buyer_representative || contract.buyer_name}</strong>,</p>
      <p style="color: #374151; font-size: 15px;">
        Vă confirmăm că ați semnat cu succes <strong>contractul ${contract.contract_number}</strong> 
        cu <strong>${contract.seller_name}</strong>.
      </p>
      
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px; color: #065f46; font-size: 13px; font-weight: bold;">DETALII SEMNARE</p>
        <p style="margin: 4px 0; color: #047857; font-size: 14px;"><strong>Contract:</strong> ${contract.contract_number}</p>
        <p style="margin: 4px 0; color: #047857; font-size: 14px;"><strong>Semnat la:</strong> ${signedDate}</p>
        <p style="margin: 4px 0; color: #047857; font-size: 14px;"><strong>Cumpărător:</strong> ${contract.buyer_name}</p>
        <p style="margin: 4px 0; color: #047857; font-size: 14px;"><strong>Vânzător:</strong> ${contract.seller_name}</p>
      </div>
      
      ${pdfDownloadUrl ? `
      <div style="text-align: center; margin: 28px 0;">
        <a href="${pdfDownloadUrl}" 
           style="background: #1e40af; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: bold; display: inline-block;">
          📥 Descarcă PDF-ul semnat
        </a>
      </div>
      ` : ''}
      
      <p style="color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
        Vă mulțumim pentru colaborare!<br/>
        <strong>${contract.seller_name}</strong>
      </p>
    </div>
    <div style="background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">Document generat electronic — ${contract.contract_number}</p>
    </div>
  </div>
</body>
</html>`

        await transporter.sendMail({
          from: `"${contract.seller_name}" <${gmailUser}>`,
          to: contract.buyer_email,
          subject: `✅ Contract ${contract.contract_number} — Copie semnată`,
          html: emailHtml,
        })
      } catch (emailErr) {
        // Nu blocăm răspunsul dacă emailul de confirmare eșuează
        console.error('Confirmation email error:', emailErr)
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      signedAt: now,
      pdfUrl: signedPdfPath 
        ? `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/contracts/${signedPdfPath}`
        : null,
    }), {
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
