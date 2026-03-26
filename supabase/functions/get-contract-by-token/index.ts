// supabase/functions/get-contract-by-token/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token lipsă' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch contract cu created_by
    const { data: contract, error } = await supabase
      .from('contracts')
      .select(`
        id, contract_number, contract_date, status,
        seller_name, seller_address, seller_j_code, seller_cui,
        seller_representative, seller_representative_role,
        buyer_name, buyer_address, buyer_county, buyer_j_code,
        buyer_cui, buyer_representative, buyer_representative_role,
        buyer_email,
        payment_term_days, payment_term_text,
        advance_percent, delivery_percent,
        invoice_term_days, invoice_term_text, invoice_term_percent,
        notes, sign_token, signed_at, created_by
      `)
      .eq('sign_token', token)
      .single()

    if (error || !contract) {
      return new Response(JSON.stringify({ error: 'Contract negăsit sau link invalid' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch template activ
    const { data: template } = await supabase
      .from('contract_templates')
      .select('content')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Fetch semnatura vanzatorului (created_by)
    let sellerSignature = null
    if (contract.created_by) {
      const { data: sigData } = await supabase
        .from('user_signatures')
        .select('signature_data')
        .eq('user_id', contract.created_by)
        .maybeSingle()
      sellerSignature = sigData?.signature_data || null
    }

    return new Response(JSON.stringify({
      ...contract,
      template_content: template?.content || null,
      seller_signature: sellerSignature,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
