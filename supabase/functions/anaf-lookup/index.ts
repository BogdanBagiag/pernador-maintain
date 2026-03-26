// supabase/functions/anaf-lookup/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    const body = await req.json()
    const cuiRaw = String(body.cui || '').trim()

    // Curăță CUI — acceptă "RO12345678" sau "12345678"
    const cui = cuiRaw.replace(/[^0-9]/g, '')

    if (!cui || cui.length < 2) {
      return new Response(JSON.stringify({ error: 'CUI invalid — introdu doar cifrele (ex: 12345678)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const today = new Date().toISOString().split('T')[0]

    console.log(`ANAF lookup CUI: ${cui}, data: ${today}`)

    const anafRes = await fetch('https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify([{ cui: Number(cui), data: today }]),
    })

    console.log(`ANAF HTTP status: ${anafRes.status}`)

    if (!anafRes.ok) {
      const text = await anafRes.text()
      console.error(`ANAF error body: ${text}`)
      return new Response(JSON.stringify({ error: `ANAF indisponibil (${anafRes.status}). Încearcă din nou.` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const anafData = await anafRes.json()
    console.log(`ANAF response keys: ${Object.keys(anafData).join(', ')}`)

    // ANAF returnează platitorii TVA în "found" și restul în "notFound"
    // Ambele array-uri conțin date_generale cu informațiile firmei
    let firma = null

    if (anafData?.found?.length > 0) {
      firma = anafData.found[0]
      console.log('Found in "found" array (platitor TVA)')
    } else if (anafData?.notFound?.length > 0) {
      // Firmele non-TVA apar în notFound DAR pot tot avea date_generale
      firma = anafData.notFound[0]
      console.log('Found in "notFound" array (non-platitor TVA)')
    }

    if (!firma || !firma.date_generale) {
      console.error(`No data found. Full response: ${JSON.stringify(anafData)}`)
      return new Response(JSON.stringify({ error: `Nu s-au găsit date pentru CUI ${cui}. Verifică că CUI-ul este corect.` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const dg = firma.date_generale

    console.log(`Firma: ${dg.denumire}, adresa: ${dg.adresa}`)

    // Extrage județul din adresă (format ANAF: "JUD. IAȘI, LOC. IAȘI, ...")
    let judet = ''
    const adresa = dg.adresa || ''
    const judMatch = adresa.match(/JUD(?:ET)?\.?\s*([^,]+)/i)
    if (judMatch) {
      judet = judMatch[1].trim()
      // Capitalizează corect (ex: "IAȘI" → "Iași")
      judet = judet.charAt(0).toUpperCase() + judet.slice(1).toLowerCase()
    }

    return new Response(JSON.stringify({
      cui:        String(dg.cui || cui),
      denumire:   dg.denumire || '',
      adresa:     adresa,
      judet:      judet,
      nrRegCom:   dg.nrRegCom || '',
      tva:        !!anafData?.found?.length, // true dacă e platitor TVA
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(`Exception: ${err.message}`, err)
    return new Response(JSON.stringify({ error: `Eroare internă: ${err.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
