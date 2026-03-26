import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, AlertCircle, Pen, Upload, RotateCcw, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'

const STEPS = [
  { id: 1, label: 'Verificare date' },
  { id: 2, label: 'Semnătură' },
  { id: 3, label: 'Confirmare' },
]

export default function ContractSign() {
  const { token } = useParams()
  const [step, setStep] = useState(1)
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [signMode, setSignMode] = useState('draw') // 'draw' | 'upload'
  const [uploadedSig, setUploadedSig] = useState(null)
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const fileInputRef = useRef(null)

  // Fetch contract by token via Edge Function
  useEffect(() => {
    const fetchContract = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-contract-by-token?token=${token}`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
          }
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Contract negăsit')
        setContract(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    if (token) fetchContract()
  }, [token])

  // Canvas setup
  useEffect(() => {
    if (step !== 2 || signMode !== 'draw') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [step, signMode])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0] || e
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    }
  }

  const draw = useCallback((e) => {
    e.preventDefault()
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }, [])

  // Load jsPDF from CDN
  const loadJsPDF = () =>
    new Promise((resolve, reject) => {
      if (window.jspdf) return resolve(window.jspdf.jsPDF)
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      script.onload = () => resolve(window.jspdf.jsPDF)
      script.onerror = reject
      document.head.appendChild(script)
    })

  const generatePDF = async (signatureData) => {
    const JsPDF = await loadJsPDF()
    const doc = new JsPDF({ format: 'a4', unit: 'mm' })
    const c = contract
    const pageW = 210
    const margin = 20
    const textW = pageW - margin * 2
    let y = 20

    // Normalizare diacritice - NFD descompune orice diacritic Latin
    const nl = (t) => {
      if (!t) return ''
      return String(t)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x00-\x7F]/g, '?')
    }

    const checkNewPage = (needed = 15) => {
      if (y + needed > 280) { doc.addPage(); y = 20 }
    }

    // Marcaje speciale pentru semnaturi
    const SIG_BUYER  = '__SIG_BUYER__'
    const SIG_SELLER = '__SIG_SELLER__'

    // Aplica shortcodes — semnaturile devin marcaje speciale
    const applyShortcodes = (text) => {
      if (!text) return ''
      const map = {
        '{{CONTRACT_NUMBER}}':            nl(c.contract_number || ''),
        '{{CONTRACT_DATE}}':              c.contract_date || '',
        '{{SELLER_NAME}}':                nl(c.seller_name || ''),
        '{{SELLER_ADDRESS}}':             nl(c.seller_address || ''),
        '{{SELLER_J_CODE}}':              nl(c.seller_j_code || ''),
        '{{SELLER_CUI}}':                 nl(c.seller_cui || ''),
        '{{SELLER_REPRESENTATIVE}}':      nl(c.seller_representative || ''),
        '{{SELLER_REPRESENTATIVE_ROLE}}': nl(c.seller_representative_role || ''),
        '{{BUYER_NAME}}':                 nl(c.buyer_name || ''),
        '{{BUYER_ADDRESS}}':              nl(c.buyer_address || ''),
        '{{BUYER_COUNTY}}':               nl(c.buyer_county || ''),
        '{{BUYER_J_CODE}}':               nl(c.buyer_j_code || ''),
        '{{BUYER_CUI}}':                  nl(c.buyer_cui || ''),
        '{{BUYER_REPRESENTATIVE}}':       nl(c.buyer_representative || ''),
        '{{BUYER_REPRESENTATIVE_ROLE}}':  nl(c.buyer_representative_role || ''),
        '{{BUYER_EMAIL}}':                nl(c.buyer_email || ''),
        '{{PAYMENT_TERM_DAYS}}':          String(c.payment_term_days || ''),
        '{{PAYMENT_TERM_TEXT}}':          nl(c.payment_term_text || ''),
        '{{ADVANCE_PERCENT}}':            String(c.advance_percent || '0'),
        '{{DELIVERY_PERCENT}}':           String(c.delivery_percent || '0'),
        '{{INVOICE_TERM_DAYS}}':          String(c.invoice_term_days || ''),
        '{{INVOICE_TERM_TEXT}}':          nl(c.invoice_term_text || ''),
        '{{INVOICE_TERM_PERCENT}}':       String(c.invoice_term_percent || ''),
        '{{NOTES}}':                      nl(c.notes || ''),
        '{{SIGNATURE_BUYER}}':            SIG_BUYER,
        '{{SIGNATURE_SELLER}}':           SIG_SELLER,
      }
      let result = text
      for (const [key, val] of Object.entries(map)) {
        result = result.replaceAll(key, val)
      }
      return result
    }

    // Extrage linii din HTML folosind DOM
    const htmlToLines = (html) => {
      if (!html) return []
      const div = document.createElement('div')
      div.innerHTML = html
      div.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li').forEach(el => {
        el.insertAdjacentText('afterend', '\n')
      })
      div.querySelectorAll('br').forEach(el => {
        el.replaceWith(document.createTextNode('\n'))
      })
      let text = div.textContent || ''
      text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n')
      return text.split('\n')
    }

    // Insereaza imaginea semnaturii cumparatorului
    const insertBuyerSignature = () => {
      checkNewPage(30)
      try {
        doc.addImage(signatureData, 'PNG', margin, y, 70, 22)
        y += 24
      } catch (e) {
        doc.setDrawColor(180, 180, 180)
        doc.rect(margin, y, 70, 22)
        y += 24
      }
    }

    // Insereaza box gol pentru semnatura vanzatorului
    const insertSellerSignature = () => {
      checkNewPage(30)
      doc.setDrawColor(180, 180, 180)
      doc.rect(margin, y, 70, 22)
      doc.setFontSize(7)
      doc.setTextColor(160, 160, 160)
      doc.text('Semnatura si stampila', margin + 3, y + 18)
      doc.setTextColor(0, 0, 0)
      y += 26
    }

    // Randeaza linii in PDF
    const renderLines = (lines) => {
      for (const rawLine of lines) {
        const line = rawLine.trim()

        // Semnaturi speciale
        if (line === SIG_BUYER) { insertBuyerSignature(); continue }
        if (line === SIG_SELLER) { insertSellerSignature(); continue }

        if (line === '') { y += 3; continue }

        const isAllCaps = line === line.toUpperCase() && line.length > 4 && !/\d/.test(line)
        const isRomanTitle = /^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI|XXII)\./.test(line)
        const isNumTitle   = /^\d{1,2}\.\d?\s/.test(line)

        let fSize = 9
        let bold  = false
        let color = [0, 0, 0]
        let align = 'left'

        if (isAllCaps && !isRomanTitle && !isNumTitle) {
          fSize = 10; bold = true; color = [30, 64, 175]; align = 'center'
        } else if (isRomanTitle) {
          fSize = 10; bold = true
        } else if (isNumTitle) {
          fSize = 9; bold = false
        }

        doc.setFontSize(fSize)
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setTextColor(color[0], color[1], color[2])

        const wrapped = doc.splitTextToSize(line, textW)
        const blockH  = wrapped.length * (fSize * 0.42 + 1.5)
        checkNewPage(blockH + 3)

        const x = align === 'center' ? pageW / 2 : margin
        doc.text(wrapped, x, y, { align, maxWidth: textW })
        doc.setTextColor(0, 0, 0)
        y += blockH + (isAllCaps ? 3 : 1.5)
      }
    }

    // GENEREAZA PDF
    if (c.template_content) {
      const withData = applyShortcodes(c.template_content)
      const lines    = htmlToLines(withData)
      renderLines(lines)
    } else {
      // Fallback minimal daca nu exista template
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 64, 175)
      doc.text('CONTRACT DE VANZARE-CUMPARARE', pageW / 2, y, { align: 'center' })
      y += 8
      doc.setFontSize(10); doc.setTextColor(0, 0, 0)
      doc.text(nl(c.contract_number || ''), pageW / 2, y, { align: 'center' })
      y += 10
      const addRow = (lbl, val) => {
        doc.setFont('helvetica', 'bold')
        doc.text(nl(lbl), margin, y)
        doc.setFont('helvetica', 'normal')
        const w = doc.splitTextToSize(nl(val || ''), textW - 45)
        doc.text(w, margin + 45, y)
        y += Math.max(w.length, 1) * 5 + 1
      }
      doc.setFont('helvetica', 'bold'); doc.text('VANZATOR:', margin, y); y += 6
      addRow('Denumire:', c.seller_name); addRow('CUI:', c.seller_cui)
      addRow('Reprezentant:', c.seller_representative); y += 4
      doc.setFont('helvetica', 'bold'); doc.text('CUMPARATOR:', margin, y); y += 6
      addRow('Denumire:', c.buyer_name); addRow('CUI:', c.buyer_cui)
      addRow('Reprezentant:', c.buyer_representative); y += 6
      insertSellerSignature(); y += 6
      insertBuyerSignature()
    }

    // Data semnarii electronice
    y += 4
    doc.setFontSize(8); doc.setTextColor(120, 120, 120)
    const signedAt = format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: ro })
    doc.text(nl('Contract semnat electronic la ' + signedAt), margin, y)

    return doc.output('datauristring')
  }

  const handleSubmit = async () => {
    if (!signatureData) {
      alert('Te rugăm să adaugi semnătura înainte de a trimite.')
      return
    }

    setSubmitting(true)
    try {
      // Generate PDF client-side
      let pdfBase64 = null
      try {
        pdfBase64 = await generatePDF(signatureData)
      } catch (pdfErr) {
        console.warn('PDF generation failed, continuing without PDF:', pdfErr)
      }

      // Submit to Edge Function
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-contract-signature`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            token,
            signatureData,
            pdfBase64,
          }),
        }
      )
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Eroare la salvare')
      setDone(true)
      setStep(3)
    } catch (err) {
      alert(`Eroare: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="text-sm">Se încarcă contractul...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Contract indisponibil</h1>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (contract?.status === 'signed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Contract deja semnat</h1>
          <p className="text-sm text-gray-500">
            Acest contract a fost semnat. Dacă aveți întrebări, contactați furnizorul.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Pen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Semnare Contract</h1>
              <p className="text-xs text-gray-500 font-mono">{contract?.contract_number}</p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-0 mt-4">
            {STEPS.map((s, idx) => (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step > s.id ? 'bg-green-500 text-white' :
                    step === s.id ? 'bg-primary-600 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {step > s.id ? '✓' : s.id}
                  </div>
                  <span className={`text-[10px] mt-1 whitespace-nowrap ${step === s.id ? 'text-primary-600 font-medium' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-4 mx-1 transition-colors ${step > s.id ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">

        {/* STEP 1 — Verificare date */}
        {step === 1 && contract && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Verificați datele companiei dvs.</h2>
              <p className="text-xs text-gray-500 mb-4">
                Vă rugăm să verificați informațiile de mai jos și să confirmați că sunt corecte 
                înainte de a trece la semnare.
              </p>

              <div className="space-y-2 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">Cumpărător</p>
                  <div className="space-y-1.5">
                    <Row label="Denumire" value={contract.buyer_name} />
                    <Row label="Adresă" value={[contract.buyer_address, contract.buyer_county ? `Jud. ${contract.buyer_county}` : null].filter(Boolean).join(', ')} />
                    <Row label="Cod J" value={contract.buyer_j_code} />
                    <Row label="CUI" value={contract.buyer_cui} />
                    <Row label="Reprezentant" value={contract.buyer_representative} />
                    <Row label="Calitate" value={contract.buyer_representative_role} />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-500 font-medium mb-2 uppercase tracking-wide">Condiții de plată</p>
                  <div className="space-y-1.5 text-sm">
                    <Row label="Termen plată" value={`${contract.payment_term_days} (${contract.payment_term_text}) zile`} />
                    <Row label="Avans" value={`${contract.advance_percent}%`} />
                    <Row label="La livrare" value={`${contract.delivery_percent}%`} />
                    <Row label={`La ${contract.invoice_term_days} zile factură`} value={`${contract.invoice_term_percent}%`} />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
              <p className="font-medium mb-1">⚠️ Atenție</p>
              <p>
                Prin continuarea procesului și aplicarea semnăturii, confirmați că ați citit și 
                agreați termenii contractului {contract.contract_number} cu {contract.seller_name}.
              </p>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
            >
              Datele sunt corecte, continuă
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* STEP 2 — Semnătură */}
        {step === 2 && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Semnați contractul</h2>
              <p className="text-xs text-gray-500 mb-4">
                Desenați semnătura sau folosiți una salvată în contul dvs.
              </p>
              <SignaturePad
                onSignature={setSignatureData}
                showSaveOption={false}
                height={160}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Înapoi
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !signatureData}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Se procesează...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Semnez și trimit
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* STEP 3 — Confirmare */}
        {step === 3 && done && (
          <div className="bg-white rounded-xl border border-green-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Contract semnat cu succes!</h2>
            <p className="text-sm text-gray-600 mb-4">
              Semnătura dvs. a fost înregistrată. Veți primi pe email o copie PDF a contractului semnat.
            </p>
            {contract?.buyer_email && (
              <p className="text-xs text-gray-400">
                PDF-ul a fost trimis la <strong>{contract.buyer_email}</strong>
              </p>
            )}
            <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
              <p className="font-medium text-gray-700 mb-1">{contract?.contract_number}</p>
              <p>{contract?.seller_name} — {contract?.buyer_name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}:</span>
      <span className="text-gray-800 font-medium text-right">{value}</span>
    </div>
  )
}
