import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft, Edit2, Send, CheckCircle, FileText, Download,
  Copy, Clock, XCircle, AlertCircle, Building2, User, CreditCard,
  Mail, Eye, ExternalLink
} from 'lucide-react'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import { applyTemplate, applyAnnex } from './ContractTemplateEditor'

const STATUS_CONFIG = {
  draft:     { label: 'Ciornă',  color: 'bg-gray-100 text-gray-700',   border: 'border-gray-300' },
  sent:      { label: 'Trimis',  color: 'bg-blue-100 text-blue-700',   border: 'border-blue-300' },
  signed:    { label: 'Semnat',  color: 'bg-green-100 text-green-700', border: 'border-green-300' },
  cancelled: { label: 'Anulat', color: 'bg-red-100 text-red-700',     border: 'border-red-300' },
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide sm:w-48 shrink-0">{label}</span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  )
}

export default function ContractDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [sending, setSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const canEdit = profile?.role === 'admin' || profile?.role === 'technician'
  const isAdmin = profile?.role === 'admin'

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*, creator:created_by(full_name)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: contractTemplate } = useQuery({
    queryKey: ['contract-template', contract?.template_id],
    queryFn: async () => {
      // Folosește șablonul ales pe contract dacă există
      if (contract?.template_id) {
        const { data } = await supabase
          .from('contract_templates')
          .select('content, annex_content')
          .eq('id', contract.template_id)
          .maybeSingle()
        if (data) return data
      }
      // Fallback: șablonul activ global
      const { data } = await supabase
        .from('contract_templates')
        .select('content, annex_content')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data
    },
    enabled: !!contract,
  })

  const { data: paymentConditionTemplate } = useQuery({
    queryKey: ['payment-condition-template', contract?.payment_condition_template_id],
    queryFn: async () => {
      if (!contract?.payment_condition_template_id) return null
      const { data } = await supabase
        .from('payment_condition_templates')
        .select('content')
        .eq('id', contract.payment_condition_template_id)
        .maybeSingle()
      return data
    },
    enabled: !!contract?.payment_condition_template_id,
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('contracts').update({ status: 'cancelled' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(['contract', id]),
  })

  const signingUrl = contract ? `${window.location.origin}/semna-contract/${contract.sign_token}` : ''

  const handleCopyLink = () => {
    navigator.clipboard.writeText(signingUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendEmail = async () => {
    if (!contract?.buyer_email) return
    setSending(true)
    setSendError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contract-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ contractId: id }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Eroare la trimitere')
      setSendSuccess(true)
      queryClient.invalidateQueries(['contract', id])
      queryClient.invalidateQueries(['contracts'])
      setTimeout(() => setSendSuccess(false), 5000)
    } catch (err) {
      setSendError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Contractul nu a fost găsit.</p>
        <Link to="/contracte" className="mt-2 text-primary-600 hover:underline text-sm">← Înapoi la contracte</Link>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[contract.status]
  const pdfPublicUrl = contract.signed_pdf_path
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/contracts/${contract.signed_pdf_path}`
    : null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/contracte')} className="mt-1 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{contract.contract_number}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {format(new Date(contract.contract_date || contract.created_at), 'dd MMMM yyyy', { locale: ro })}
            {contract.creator?.full_name && ` • Creat de ${contract.creator.full_name}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && contract.status !== 'signed' && contract.status !== 'cancelled' && (
            <Link
              to={`/contracte/${id}/editeaza`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline">Editează</span>
            </Link>
          )}
        </div>
      </div>

      {/* Contract semnat — download PDF */}
      {contract.status === 'signed' && pdfPublicUrl && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Contract semnat</p>
              <p className="text-xs text-green-600">
                Semnat la {format(new Date(contract.signed_at), 'dd MMM yyyy, HH:mm', { locale: ro })}
              </p>
            </div>
          </div>
          <a
            href={pdfPublicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Descarcă PDF
          </a>
        </div>
      )}

      {/* Semnatură preview dacă e semnat dar fără PDF stocat */}
      {contract.status === 'signed' && contract.signature_data && !pdfPublicUrl && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm font-semibold text-green-800">
              Contract semnat la {format(new Date(contract.signed_at), 'dd MMM yyyy, HH:mm', { locale: ro })}
            </p>
          </div>
          <div className="bg-white border border-green-200 rounded-lg p-3 inline-block">
            <p className="text-xs text-gray-500 mb-2">Semnătura cumpărătorului:</p>
            <img src={contract.signature_data} alt="Semnătură" className="max-h-20" />
          </div>
        </div>
      )}

      {/* Acțiuni trimitere */}
      {canEdit && (contract.status === 'draft' || contract.status === 'sent') && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Trimite pentru semnare</h3>
          <div className="space-y-3">
            {/* Link copiere */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Link semnat contract (poți trimite manual):</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                  <span className="text-xs text-gray-600 truncate font-mono">{signingUrl}</span>
                </div>
                <button
                  onClick={handleCopyLink}
                  className={`shrink-0 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {copied ? 'Copiat!' : <Copy className="w-4 h-4" />}
                </button>
                <a href={signingUrl} target="_blank" rel="noreferrer" className="shrink-0 p-2 text-gray-400 hover:text-primary-600 rounded-lg">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Trimitere email */}
            {contract.buyer_email ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  {sending ? 'Se trimite...' : `Trimite email la ${contract.buyer_email}`}
                </button>
                {contract.status === 'sent' && (
                  <span className="text-xs text-blue-600 font-medium">✓ Email trimis anterior</span>
                )}
              </div>
            ) : (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Adaugă emailul clientului pentru a trimite automat.
              </p>
            )}

            {sendSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                ✓ Email trimis cu succes! Contractul a fost actualizat la status "Trimis".
              </div>
            )}
            {sendError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                Eroare: {sendError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detalii Vânzător */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Vânzătorul</h3>
        </div>
        <div className="divide-y divide-gray-50">
          <InfoRow label="Denumire" value={contract.seller_name} />
          <InfoRow label="Adresă" value={contract.seller_address} />
          <InfoRow label="Cod J" value={contract.seller_j_code} />
          <InfoRow label="CUI" value={contract.seller_cui} />
          <InfoRow label="Reprezentat prin" value={contract.seller_representative} />
          <InfoRow label="În calitate de" value={contract.seller_representative_role} />
        </div>
      </div>

      {/* Detalii Cumpărător */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Cumpărătorul</h3>
        </div>
        <div className="divide-y divide-gray-50">
          <InfoRow label="Denumire" value={contract.buyer_name} />
          <InfoRow label="Adresă" value={contract.buyer_address} />
          <InfoRow label="Județ" value={contract.buyer_county} />
          <InfoRow label="Cod J" value={contract.buyer_j_code} />
          <InfoRow label="CUI" value={contract.buyer_cui} />
          <InfoRow label="Reprezentat prin" value={contract.buyer_representative} />
          <InfoRow label="În calitate de" value={contract.buyer_representative_role} />
          <InfoRow label="Email" value={contract.buyer_email} />
        </div>
      </div>

      {/* Condiții de plată */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Condiții de Plată</h3>
        </div>
        <div className="space-y-3">
          <div className="p-3 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-700 font-medium mb-1">Art. 7.2 — Termen general de plată</p>
            <p className="text-sm text-gray-800">
              {contract.payment_term_days} ({contract.payment_term_text}) zile calendaristice de la data emiterii facturii
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700 font-medium mb-2">Art. 7.4 — Modalități de plată per comandă</p>
            <div className="space-y-1.5 text-sm text-gray-800">
              <div className="flex justify-between">
                <span>(i) Avans:</span>
                <span className="font-semibold">{contract.advance_percent}%</span>
              </div>
              <div className="flex justify-between">
                <span>(ii) Plată la livrare:</span>
                <span className="font-semibold">{contract.delivery_percent}%</span>
              </div>
              <div className="flex justify-between">
                <span>(iii) Plată în {contract.invoice_term_days} ({contract.invoice_term_text}) zile:</span>
                <span className="font-semibold">{contract.invoice_term_percent}%</span>
              </div>
              <div className="border-t border-blue-200 pt-1.5 flex justify-between font-semibold text-blue-700">
                <span>Total:</span>
                <span>{Number(contract.advance_percent) + Number(contract.delivery_percent) + Number(contract.invoice_term_percent)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Note */}
      {contract.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Observații</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{contract.notes}</p>
        </div>
      )}

      {/* Preview Contract */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-2 w-full text-sm font-semibold text-gray-900"
        >
          <Eye className="w-4 h-4" />
          {showPreview ? 'Ascunde' : 'Previzualizează'} textul contractului
          <span className={`ml-auto transition-transform ${showPreview ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {showPreview && (
          <div className="mt-4 overflow-auto max-h-[600px]">
            {contractTemplate?.content ? (
              <div
                className="p-4 bg-white border border-gray-200 rounded-lg text-sm leading-relaxed"
                style={{ fontFamily: 'Times New Roman, serif', fontSize: '13px' }}
                dangerouslySetInnerHTML={{ __html: applyTemplate(contractTemplate.content, contract, paymentConditionTemplate?.content) }}
              />
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                Nu există un șablon de contract salvat. Mergi la{' '}
                <a href="/contracte/sablon" className="underline font-medium">Șablon Contract</a>{' '}
                pentru a configura unul.
              </div>
            )}
            {/* Anexă produse */}
            {contractTemplate?.content && (() => {
              const annexHtml = applyAnnex(contractTemplate.annex_content, contract)
              if (!annexHtml) return null
              return (
                <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300">
                  <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">Anexă Produse</p>
                  <div
                    className="p-4 bg-white border border-gray-200 rounded-lg text-sm leading-relaxed"
                    style={{ fontFamily: 'Times New Roman, serif', fontSize: '13px' }}
                    dangerouslySetInnerHTML={{ __html: annexHtml }}
                  />
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Anulare */}
      {isAdmin && contract.status !== 'cancelled' && contract.status !== 'signed' && (
        <div className="flex justify-end pb-8">
          <button
            onClick={() => {
              if (window.confirm('Ești sigur că vrei să anulezi acest contract?')) {
                cancelMutation.mutate()
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
          >
            <XCircle className="w-4 h-4" />
            Anulează contractul
          </button>
        </div>
      )}
    </div>
  )
}

// Generare text contract complet
function generateContractText(c) {
  const today = c.contract_date
    ? format(new Date(c.contract_date), 'dd MMMM yyyy', { locale: ro })
    : format(new Date(), 'dd MMMM yyyy', { locale: ro })
  
  return `CONTRACT DE VÂNZARE-CUMPĂRARE PRODUSE TEXTILE
${c.contract_number}
Încheiat astăzi, ${today}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VÂNZĂTORUL:
  Denumire:        ${c.seller_name || '___________'}
  Sediul social:   ${c.seller_address || '___________'}
  Înregistrat la:  ${c.seller_j_code || '___________'}
  CUI:             ${c.seller_cui || '___________'}
  Reprezentat de:  ${c.seller_representative || '___________'}
  În calitate de:  ${c.seller_representative_role || '___________'}

CUMPĂRĂTORUL:
  Denumire:        ${c.buyer_name || '___________'}
  Sediul social:   ${c.buyer_address || '___________'}${c.buyer_county ? ', jud. ' + c.buyer_county : ''}
  Înregistrat la:  ${c.buyer_j_code || '___________'}
  CUI:             ${c.buyer_cui || '___________'}
  Reprezentat de:  ${c.buyer_representative || '___________'}
  În calitate de:  ${c.buyer_representative_role || '___________'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ARTICOLUL 1 — OBIECTUL CONTRACTULUI
1.1. Vânzătorul se obligă să vândă, iar Cumpărătorul se obligă să cumpere produse textile, 
conform comenzilor transmise și confirmate.
1.2. Tipul, cantitatea, specificațiile tehnice și prețul produselor textile vor fi stabilite 
prin comenzi individuale emise de Cumpărător și confirmate de Vânzător.

ARTICOLUL 2 — DURATA CONTRACTULUI
2.1. Prezentul contract se încheie pe o durată de 1 (un) an de la data semnării lui, 
cu posibilitate de prelungire prin acordul scris al Părților.

ARTICOLUL 3 — LIVRAREA PRODUSELOR
3.1. Vânzătorul va livra Produsele textile conform termenelor agreate în comenzile individuale.
3.2. Locul de livrare va fi specificat în fiecare comandă în parte.
3.3. Riscul pierderii sau deteriorării Produselor textile trece asupra Cumpărătorului 
la momentul livrării.

ARTICOLUL 4 — RECEPȚIA PRODUSELOR
4.1. La primirea produselor, Cumpărătorul va verifica cantitativ și calitativ Produsele textile.
4.2. Orice neconformitate va fi notificată Vânzătorului în scris în termen de 48 de ore 
de la recepție.

ARTICOLUL 5 — GARANȚII
5.1. Vânzătorul garantează că Produsele textile livrate corespund specificațiilor tehnice 
din comenzile confirmate.
5.2. Termenul de garanție este cel prevăzut de legislația în vigoare.

ARTICOLUL 6 — PREȚUL PRODUSELOR
6.1. Prețurile Produselor textile sunt cele convenite în comenzile individuale confirmate.
6.2. Prețurile sunt exprimate în lei (RON) și nu includ TVA, dacă nu se specifică altfel.
6.3. Vânzătorul își rezervă dreptul de a modifica prețurile cu notificarea prealabilă a 
Cumpărătorului cu cel puțin 30 zile înainte.

ARTICOLUL 7 — PLATA
7.1. Prețul Produselor textile se stabilește prin comenzile transmise și confirmate.

7.2. CUMPĂRĂTORUL va achita contravaloarea Produselor textile facturate, în lei (RON),
în termen de ${c.payment_term_days} (${c.payment_term_text}) zile calendaristice de la
data emiterii facturii.

7.3. Întârzierea la plată va atrage dobânzi penalizatoare conform legislației în vigoare.

7.4. Modalitățile de plată agreate de Părți pentru fiecare comandă sunt:
  (i)   Avans:                                        ${c.advance_percent}%
  (ii)  Plată la livrare:                             ${c.delivery_percent}%
  (iii) Plată în termen de ${c.invoice_term_days} (${c.invoice_term_text}) zile 
        calendaristice de la data emiterii facturii:  ${c.invoice_term_percent}%

ARTICOLUL 8 — CONFIDENȚIALITATE
8.1. Fiecare Parte se obligă să păstreze confidențialitatea tuturor informațiilor comerciale 
și tehnice primite în cadrul acestui contract.

ARTICOLUL 9 — FORȚA MAJORĂ
9.1. Niciuna dintre Părți nu va fi responsabilă pentru neexecutarea obligațiilor sale 
contractuale atunci când aceasta este cauzată de forță majoră.
9.2. Forța majoră trebuie notificată în scris celeilalte Părți în termen de 5 zile de 
la producerea evenimentului.

ARTICOLUL 10 — LITIGII
10.1. Orice litigiu decurgând din sau în legătură cu prezentul contract va fi soluționat 
pe cale amiabilă.
10.2. Dacă soluționarea amiabilă nu este posibilă, litigiul va fi supus instanței judecătorești 
competente.

ARTICOLUL 11 — DISPOZIȚII FINALE
11.1. Prezentul contract a fost încheiat în 2 (două) exemplare originale, câte unul pentru 
fiecare Parte.
11.2. Orice modificare a prezentului contract se face numai prin act adițional semnat de 
ambele Părți.

${c.notes ? `CLAUZE SPECIALE:\n${c.notes}\n\n` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SEMNĂTURI

VÂNZĂTOR                          CUMPĂRĂTOR
${c.seller_name || '___________'}    ${c.buyer_name || '___________'}
${c.seller_representative || '___'} ${c.buyer_representative || '___'}


_______________________           _______________________
Semnătură și ștampilă              Semnătură și ștampilă
`
}
