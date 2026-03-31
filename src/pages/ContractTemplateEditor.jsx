import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Upload, Save, RefreshCw, Eye, EyeOff, FileText,
  ChevronDown, ChevronRight, AlertCircle, CheckCircle,
  Trash2, Plus, Info, PenLine, Star, StarOff
} from 'lucide-react'

// ─── Shortcodes disponibile ───────────────────────────────────────────────────
const SHORTCODE_GROUPS = [
  {
    label: 'Contract',
    color: 'purple',
    codes: [
      { code: '{{CONTRACT_NUMBER}}', label: 'Număr contract' },
      { code: '{{CONTRACT_DATE}}',   label: 'Data contract' },
    ],
  },
  {
    label: 'Vânzător',
    color: 'blue',
    codes: [
      { code: '{{SELLER_NAME}}',               label: 'Denumire' },
      { code: '{{SELLER_ADDRESS}}',            label: 'Adresă' },
      { code: '{{SELLER_COUNTY}}',             label: 'Județ' },
      { code: '{{SELLER_J_CODE}}',             label: 'Cod J' },
      { code: '{{SELLER_CUI}}',                label: 'CUI' },
      { code: '{{SELLER_REPRESENTATIVE}}',     label: 'Reprezentant' },
      { code: '{{SELLER_REPRESENTATIVE_ROLE}}', label: 'Calitate reprezentant' },
    ],
  },
  {
    label: 'Cumpărător',
    color: 'green',
    codes: [
      { code: '{{BUYER_NAME}}',                label: 'Denumire' },
      { code: '{{BUYER_ADDRESS}}',             label: 'Adresă' },
      { code: '{{BUYER_COUNTY}}',              label: 'Județ' },
      { code: '{{BUYER_J_CODE}}',              label: 'Cod J' },
      { code: '{{BUYER_CUI}}',                 label: 'CUI' },
      { code: '{{BUYER_REPRESENTATIVE}}',      label: 'Reprezentant' },
      { code: '{{BUYER_REPRESENTATIVE_ROLE}}', label: 'Calitate reprezentant' },
      { code: '{{BUYER_EMAIL}}',               label: 'Email' },
    ],
  },
  {
    label: 'Condiții Plată',
    color: 'amber',
    codes: [
      { code: '{{PAYMENT_CONDITIONS}}',   label: '⭐ Condiții plată (text complet auto)' },
      { code: '{{PAYMENT_TERM_DAYS}}',    label: 'Zile termen plată' },
      { code: '{{PAYMENT_TERM_TEXT}}',    label: 'Termen plată în litere' },
      { code: '{{ADVANCE_PERCENT}}',      label: 'Procent avans (%)' },
      { code: '{{DELIVERY_PERCENT}}',     label: 'Procent la livrare (%)' },
      { code: '{{INVOICE_TERM_DAYS}}',    label: 'Zile termen factură' },
      { code: '{{INVOICE_TERM_TEXT}}',    label: 'Termen factură în litere' },
      { code: '{{INVOICE_TERM_PERCENT}}', label: 'Procent termen factură (%)' },
    ],
  },
  {
    label: 'Semnături',
    color: 'rose',
    codes: [
      { code: '{{SIGNATURE_SELLER}}', label: 'Zonă semnătură Vânzător' },
      { code: '{{SIGNATURE_BUYER}}',  label: 'Zonă semnătură Cumpărător' },
    ],
  },
  {
    label: 'General',
    color: 'gray',
    codes: [
      { code: '{{NOTES}}', label: 'Observații / Clauze speciale' },
      { code: '{{PRODUCTS_TABLE}}', label: 'Tabel produse/servicii' },
      { code: '{{SIGNATURE_SELLER}}', label: 'Semnătură Vânzător' },
      { code: '{{SIGNATURE_BUYER}}', label: 'Semnătură Cumpărător' },
    ],
  },
]

const COLOR_MAP = {
  purple: { btn: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100', header: 'text-purple-700', dot: 'bg-purple-400' },
  blue:   { btn: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',         header: 'text-blue-700',   dot: 'bg-blue-400' },
  green:  { btn: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',     header: 'text-green-700',  dot: 'bg-green-400' },
  amber:  { btn: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',     header: 'text-amber-700',  dot: 'bg-amber-400' },
  rose:   { btn: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',         header: 'text-rose-700',   dot: 'bg-rose-400' },
  gray:   { btn: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',         header: 'text-gray-700',   dot: 'bg-gray-400' },
}

function highlightShortcodes(html) {
  return html
    .replace(/\{\{SIGNATURE_SELLER\}\}/g,
      '<span style="display:inline-block;background:#fce7f3;border:2px dashed #f43f5e;border-radius:6px;padding:8px 24px;color:#be185d;font-size:11px;font-weight:bold;min-width:160px;text-align:center">✍ Semnătură Vânzător</span>')
    .replace(/\{\{SIGNATURE_BUYER\}\}/g,
      '<span style="display:inline-block;background:#ecfdf5;border:2px dashed #10b981;border-radius:6px;padding:8px 24px;color:#065f46;font-size:11px;font-weight:bold;min-width:160px;text-align:center">✍ Semnătură Cumpărător</span>')
    .replace(/\{\{([A-Z_]+)\}\}/g,
      '<mark style="background:#fef08a;color:#92400e;padding:0 3px;border-radius:3px;font-family:monospace;font-size:0.85em">{{$1}}</mark>')
}

function buildPaymentConditions(c, paymentConditionContent) {
  // Use custom template content if provided
  const content = paymentConditionContent || null

  const ptDays = String(c.payment_term_days || '')
  const ptText = c.payment_term_text || ''
  const adv = String(c.advance_percent || '0')
  const del = String(c.delivery_percent || '0')
  const invDays = String(c.invoice_term_days || '')
  const invText = c.invoice_term_text || ''
  const inv = String(c.invoice_term_percent || '')

  if (content) {
    return content
      .replace(/\{\{PAYMENT_TERM_DAYS\}\}/g, ptDays)
      .replace(/\{\{PAYMENT_TERM_TEXT\}\}/g, ptText)
      .replace(/\{\{ADVANCE_PERCENT\}\}/g, adv)
      .replace(/\{\{DELIVERY_PERCENT\}\}/g, del)
      .replace(/\{\{INVOICE_TERM_DAYS\}\}/g, invDays)
      .replace(/\{\{INVOICE_TERM_TEXT\}\}/g, invText)
      .replace(/\{\{INVOICE_TERM_PERCENT\}\}/g, inv)
  }

  // Fallback: auto-generate from data
  const advN = Number(c.advance_percent || 0)
  const delN = Number(c.delivery_percent || 0)
  if (advN > 0 && delN > 0) {
    return `Plata se va efectua astfel: (i) ${advN}% avans la semnarea comenzii și (ii) ${delN}% la livrarea produselor.`
  }
  if (advN > 0) {
    const restPct = Number(c.invoice_term_percent || (100 - advN))
    return `Plata se va efectua astfel: (i) ${advN}% avans la semnarea comenzii și (ii) ${restPct}% în termen de ${invDays}${invText ? ` (${invText})` : ''} zile de la emiterea facturii.`
  }
  return `Plata se va efectua integral în termen de ${ptDays}${ptText ? ` (${ptText})` : ''} zile calendaristice de la data emiterii facturii.`
}

export function applyTemplate(templateHtml, contract, paymentConditionContent) {
  if (!templateHtml || !contract) return templateHtml
  const map = {
    '{{CONTRACT_NUMBER}}':            contract.contract_number || '',
    '{{CONTRACT_DATE}}':              contract.contract_date || '',
    '{{SELLER_NAME}}':                contract.seller_name || '',
    '{{SELLER_ADDRESS}}':             contract.seller_address || '',
    '{{SELLER_COUNTY}}':              contract.seller_county || '',
    '{{SELLER_J_CODE}}':              contract.seller_j_code || '',
    '{{SELLER_CUI}}':                 contract.seller_cui || '',
    '{{SELLER_REPRESENTATIVE}}':      contract.seller_representative || '',
    '{{SELLER_REPRESENTATIVE_ROLE}}': contract.seller_representative_role || '',
    '{{BUYER_NAME}}':                 contract.buyer_name || '',
    '{{BUYER_ADDRESS}}':              contract.buyer_address || '',
    '{{BUYER_COUNTY}}':               contract.buyer_county || '',
    '{{BUYER_J_CODE}}':               contract.buyer_j_code || '',
    '{{BUYER_CUI}}':                  contract.buyer_cui || '',
    '{{BUYER_REPRESENTATIVE}}':       contract.buyer_representative || '',
    '{{BUYER_REPRESENTATIVE_ROLE}}':  contract.buyer_representative_role || '',
    '{{BUYER_EMAIL}}':                contract.buyer_email || '',
    '{{PAYMENT_CONDITIONS}}':          buildPaymentConditions(contract, paymentConditionContent),
    '{{PAYMENT_TERM_DAYS}}':          String(contract.payment_term_days || ''),
    '{{PAYMENT_TERM_TEXT}}':          contract.payment_term_text || '',
    '{{ADVANCE_PERCENT}}':            String(contract.advance_percent || '0'),
    '{{DELIVERY_PERCENT}}':           String(contract.delivery_percent || '0'),
    '{{INVOICE_TERM_DAYS}}':          String(contract.invoice_term_days || ''),
    '{{INVOICE_TERM_TEXT}}':          contract.invoice_term_text || '',
    '{{INVOICE_TERM_PERCENT}}':       String(contract.invoice_term_percent || ''),
    '{{NOTES}}':                      contract.notes || '',
    '{{SIGNATURE_SELLER}}':           '[Semnătură Vânzător]',
    '{{SIGNATURE_BUYER}}':            '[Semnătură Cumpărător]',
    '{{PRODUCTS_TABLE}}':             (() => {
      const prods = Array.isArray(contract.products) ? contract.products.filter(p => p && p.name) : []
      if (!prods.length) return ''
      const trs = prods.map((p, i) => {
        const sub = (Number(p.quantity)||0)*(Number(p.price)||0)
        const tot = sub*(1+(Number(p.vat)||0)/100)
        return `<tr><td style="border:1px solid #ddd;padding:3px 6px;text-align:center">${i+1}</td><td style="border:1px solid #ddd;padding:3px 6px">${p.name}</td><td style="border:1px solid #ddd;padding:3px 6px;text-align:center">${p.quantity} ${p.unit}</td><td style="border:1px solid #ddd;padding:3px 6px;text-align:right">${Number(p.price||0).toFixed(2)}</td><td style="border:1px solid #ddd;padding:3px 6px;text-align:center">${p.vat}%</td><td style="border:1px solid #ddd;padding:3px 6px;text-align:right;font-weight:bold">${tot.toFixed(2)}</td></tr>`
      }).join('')
      const totalFara = prods.reduce((s,p)=>s+(Number(p.quantity)||0)*(Number(p.price)||0),0)
      const totalCu = prods.reduce((s,p)=>{const sub=(Number(p.quantity)||0)*(Number(p.price)||0);return s+sub*(1+(Number(p.vat)||0)/100)},0)
      return `<table style="width:100%;border-collapse:collapse;font-size:10.5px;margin:8px 0"><thead><tr style="background:#f3f4f6"><td style="border:1px solid #ddd;padding:4px 6px;text-align:center;font-weight:bold">Nr.</td><td style="border:1px solid #ddd;padding:4px 6px;font-weight:bold">Denumire</td><td style="border:1px solid #ddd;padding:4px 6px;text-align:center;font-weight:bold">Cant.</td><td style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-weight:bold">Pret fara TVA</td><td style="border:1px solid #ddd;padding:4px 6px;text-align:center;font-weight:bold">TVA</td><td style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-weight:bold">Total</td></tr></thead><tbody>${trs}</tbody><tfoot><tr><td colspan="5" style="border:1px solid #ddd;padding:4px 6px;text-align:right;background:#fafafa">Total fara TVA:</td><td style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-weight:bold;background:#fafafa">${totalFara.toFixed(2)} RON</td></tr><tr><td colspan="5" style="border:1px solid #ddd;padding:4px 6px;text-align:right;background:#eff6ff;font-weight:bold">Total cu TVA:</td><td style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-weight:bold;color:#1e40af;background:#eff6ff">${totalCu.toFixed(2)} RON</td></tr></tfoot></table>`
    })(),
  }
  let result = templateHtml
  for (const [key, val] of Object.entries(map)) {
    result = result.replaceAll(key, val)
  }
  return result
}

export function applyAnnex(annexHtml, contract) {
  if (!annexHtml || !contract) return null
  const prods = Array.isArray(contract.products) ? contract.products.filter(p => p && p.name) : []
  if (!prods.length) return null // Don't render annex if no products
  return applyTemplate(annexHtml, contract)
}

export default function ContractTemplateEditor() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const editorRef = useRef(null)
  const annexEditorRef = useRef(null)
  const fileInputRef = useRef(null)
  const savedSelectionRef = useRef(null)

  const [templateName, setTemplateName] = useState('Șablon Contract')
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [converting, setConverting] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [openGroups, setOpenGroups] = useState({ 'Contract': true, 'Vânzător': true, 'Cumpărător': true, 'Condiții Plată': true, 'Semnături': true, 'General': true })
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [editorTab, setEditorTab] = useState('contract') // 'contract' | 'annex'
  const canEdit = profile?.role === 'admin' || profile?.role === 'technician'

  // Fetch toate șabloanele
  const { data: templates = [] } = useQuery({
    queryKey: ['contract-templates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contract_templates')
        .select('id, name, is_active, updated_at')
        .order('updated_at', { ascending: false })
      return data || []
    },
  })

  // Fetch șablonul selectat complet
  const { data: selectedTemplate } = useQuery({
    queryKey: ['contract-template', selectedTemplateId],
    queryFn: async () => {
      if (!selectedTemplateId) return null
      const { data } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('id', selectedTemplateId)
        .single()
      return data
    },
    enabled: !!selectedTemplateId,
  })

  // La prima încărcare — selectează șablonul activ dacă există
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      const active = templates.find(t => t.is_active) || templates[0]
      setSelectedTemplateId(active.id)
    }
  }, [templates])

  // Când se schimbă șablonul selectat — încarcă în editor
  useEffect(() => {
    if (selectedTemplate && editorRef.current) {
      editorRef.current.innerHTML = selectedTemplate.content || ''
      setTemplateName(selectedTemplate.name)
    }
    if (selectedTemplate && annexEditorRef.current) {
      annexEditorRef.current.innerHTML = selectedTemplate.annex_content || ''
    }
  }, [selectedTemplate])

  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedSelectionRef.current = range.cloneRange()
      }
    }
  }

  const restoreSelection = () => {
    if (savedSelectionRef.current) {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(savedSelectionRef.current)
      return true
    }
    return false
  }

  const insertShortcode = useCallback((code) => {
    const editor = editorTab === 'annex' ? annexEditorRef.current : editorRef.current
    if (!editor) return
    editor.focus()
    restoreSelection()
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      if (!editor.contains(range.commonAncestorContainer)) {
        editor.appendChild(document.createTextNode(code))
        return
      }
      range.deleteContents()
      const node = document.createTextNode(code)
      range.insertNode(node)
      range.setStartAfter(node)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      savedSelectionRef.current = range.cloneRange()
    } else {
      editor.appendChild(document.createTextNode(code))
    }
  }, [editorTab])

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.endsWith('.docx')) { setError('Acceptăm doar fișiere .docx'); return }
    setConverting(true)
    setError(null)
    try {
      if (!window.mammoth) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
          s.onload = resolve; s.onerror = () => reject(new Error('Nu s-a putut încărca convertorul'))
          document.head.appendChild(s)
        })
      }
      const arrayBuffer = await file.arrayBuffer()
      const result = await window.mammoth.convertToHtml({ arrayBuffer })
      if (editorRef.current) editorRef.current.innerHTML = result.value
    } catch (err) {
      setError('Eroare la conversie: ' + err.message)
    } finally {
      setConverting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Salvare șablon (nou sau update)
  const saveMutation = useMutation({
    mutationFn: async ({ asNew }) => {
      const content = editorRef.current?.innerHTML || ''
      const annexContent = annexEditorRef.current?.innerHTML || ''
      if (!content.trim()) throw new Error('Șablonul este gol')
      const { data: { user } } = await supabase.auth.getUser()

      if (asNew || !selectedTemplateId) {
        // Crează șablon nou
        const { data, error } = await supabase
          .from('contract_templates')
          .insert({ name: templateName, content, annex_content: annexContent, is_active: false, created_by: user?.id })
          .select('id').single()
        if (error) throw error
        setSelectedTemplateId(data.id)
      } else {
        // Update șablon existent
        const { error } = await supabase
          .from('contract_templates')
          .update({ name: templateName, content, annex_content: annexContent, updated_at: new Date().toISOString() })
          .eq('id', selectedTemplateId)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contract-templates'])
      queryClient.invalidateQueries(['contract-template', selectedTemplateId])
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
    onError: (err) => setError(err.message),
  })

  // Setează șablon ca activ (cel folosit la contracte noi)
  const setActiveMutation = useMutation({
    mutationFn: async (id) => {
      // Dezactivează toate
      await supabase.from('contract_templates').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
      // Activează cel selectat
      const { error } = await supabase.from('contract_templates').update({ is_active: true }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(['contract-templates']),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('contract_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contract-templates'])
      if (selectedTemplateId === deleteConfirm?.id) {
        setSelectedTemplateId(null)
        if (editorRef.current) editorRef.current.innerHTML = ''
      }
      setDeleteConfirm(null)
    },
  })

  const handleNewTemplate = () => {
    setSelectedTemplateId(null)
    setTemplateName('Șablon nou')
    if (editorRef.current) editorRef.current.innerHTML = ''
    if (annexEditorRef.current) annexEditorRef.current.innerHTML = ''
  }

  const toggleGroup = (label) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Șabloane Contract</h2>
          <p className="text-xs text-gray-500 mt-0.5">Gestionează șabloanele folosite la generarea contractelor</p>
        </div>
        {canEdit && (
          <button
            onClick={handleNewTemplate}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Șablon nou
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── COLOANA STÂNGA: Lista șabloane + Editor ── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Lista șabloane existente */}
          {templates.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Șabloane salvate</span>
              </div>
              <div className="divide-y divide-gray-100">
                {templates.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTemplateId(t.id)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      selectedTemplateId === t.id ? 'bg-primary-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <FileText className={`w-4 h-4 shrink-0 ${selectedTemplateId === t.id ? 'text-primary-600' : 'text-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${selectedTemplateId === t.id ? 'text-primary-700' : 'text-gray-800'}`}>
                        {t.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(t.updated_at).toLocaleDateString('ro-RO')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Activ badge */}
                      {t.is_active && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          Activ
                        </span>
                      )}
                      {canEdit && (
                        <>
                          {/* Setează ca activ */}
                          <button
                            onClick={e => { e.stopPropagation(); setActiveMutation.mutate(t.id) }}
                            title={t.is_active ? 'Deja activ' : 'Setează ca șablon activ'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              t.is_active
                                ? 'text-yellow-500 cursor-default'
                                : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                            }`}
                          >
                            <Star className="w-3.5 h-3.5" fill={t.is_active ? 'currentColor' : 'none'} />
                          </button>
                          {/* Șterge */}
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteConfirm(t) }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Toolbar editor */}
          {!previewMode && canEdit && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={converting}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {converting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {converting ? 'Se convertește...' : 'Încarcă .docx'}
              </button>

              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Nume șablon..."
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 w-52"
              />

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setPreviewMode(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                {selectedTemplateId && (
                  <button
                    onClick={() => saveMutation.mutate({ asNew: false })}
                    disabled={saveMutation.isPending}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      saveSuccess
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {saveSuccess ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saveSuccess ? 'Salvat!' : 'Salvează'}
                  </button>
                )}
                <button
                  onClick={() => saveMutation.mutate({ asNew: true })}
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Salvează ca nou
                </button>
              </div>
            </div>
          )}

          {previewMode && (
            <button
              onClick={() => setPreviewMode(false)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-primary-50 border border-primary-300 text-primary-700 rounded-lg"
            >
              <EyeOff className="w-4 h-4" />
              Înapoi la editare
            </button>
          )}

          {/* Editor tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-3">
            <button
              onClick={() => setEditorTab('contract')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                editorTab === 'contract' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Contract
            </button>
            <button
              onClick={() => setEditorTab('annex')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                editorTab === 'annex' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Anexă Produse
            </button>
          </div>

          {/* Editor / Preview — Contract (mereu în DOM, ascuns cu display) */}
          <div style={{ display: editorTab === 'contract' ? '' : 'none' }}>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {!previewMode ? (
                <>
                  <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2 text-xs text-gray-500">
                    <FileText className="w-3.5 h-3.5" />
                    {selectedTemplateId
                      ? `Editezi: ${templateName}`
                      : 'Șablon nou — dă click în text, apoi pe un shortcode din dreapta'}
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable={canEdit}
                    suppressContentEditableWarning
                    onMouseUp={saveSelection}
                    onKeyUp={saveSelection}
                    onBlur={saveSelection}
                    className="min-h-[500px] p-6 focus:outline-none contract-editor"
                    style={{ fontFamily: 'Times New Roman, serif', fontSize: '13px', lineHeight: '1.7' }}
                    data-placeholder="Încarcă un .docx sau scrie direct contractul..."
                  />
                </>
              ) : (
                <div className="p-6">
                  <p className="text-xs text-amber-600 font-medium mb-4 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    Previzualizare — shortcodes evidențiate
                  </p>
                  <div
                    className="prose prose-sm max-w-none"
                    style={{ fontFamily: 'Times New Roman, serif', fontSize: '13px', lineHeight: '1.6' }}
                    dangerouslySetInnerHTML={{
                      __html: highlightShortcodes(editorRef.current?.innerHTML || '<p><em>Editorul este gol.</em></p>')
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Editor — Anexă Produse (mereu în DOM, ascuns cu display) */}
          <div style={{ display: editorTab === 'annex' ? '' : 'none' }}>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-700">Anexă Produse</span>
                <span className="text-xs text-amber-600">— adăugată automat când contractul are produse</span>
              </div>
              <div
                ref={annexEditorRef}
                contentEditable={canEdit && !previewMode}
                suppressContentEditableWarning
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                onBlur={saveSelection}
                className="min-h-[300px] p-6 focus:outline-none"
                style={{ fontFamily: 'Times New Roman, serif', fontSize: '13px', lineHeight: '1.7' }}
                data-placeholder="Scrie conținutul anexei... Folosește {{PRODUCTS_TABLE}} pentru tabelul de produse"
              />
            </div>
          </div>

          {/* Info shortcodes semnătură */}
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" />
              Zone de semnătură
            </p>
            <p>Folosește <code className="bg-rose-100 px-1 rounded">{'{{SIGNATURE_SELLER}}'}</code> și <code className="bg-rose-100 px-1 rounded">{'{{SIGNATURE_BUYER}}'}</code> pentru a marca exact unde apare fiecare semnătură în PDF.</p>
          </div>
        </div>

        {/* ── PANOU SHORTCODES ── */}
        <div className="lg:w-72 shrink-0 space-y-2">
          <div className="sticky top-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Shortcodes</p>

            {SHORTCODE_GROUPS.map(group => {
              const colors = COLOR_MAP[group.color]
              const isOpen = openGroups[group.label] !== false
              return (
                <div key={group.label} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      <span className={`text-xs font-semibold ${colors.header}`}>{group.label}</span>
                    </div>
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-2 space-y-1">
                      {group.codes.map(({ code, label }) => (
                        <button
                          key={code}
                          onClick={() => insertShortcode(code)}
                          disabled={!canEdit || previewMode}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colors.btn}`}
                        >
                          <span className="block font-medium truncate">{label}</span>
                          <span className="block font-mono text-[10px] opacity-60 truncate">{code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 mb-1">Șablon activ</p>
              <p className="text-xs text-gray-600">
                Șablonul marcat cu <Star className="w-3 h-3 text-yellow-500 inline" fill="currentColor" /> este folosit la generarea PDF-urilor pentru contractele noi.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal confirmare ștergere */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Șterge șablonul</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Ești sigur că vrei să ștergi șablonul <strong>"{deleteConfirm.name}"</strong>? Acțiunea este ireversibilă.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Anulează
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Se șterge...' : 'Șterge'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .contract-editor:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
        .contract-editor p { margin: 0 0 8px; }
        .contract-editor h1 { font-size: 1.4em; font-weight: bold; margin: 16px 0 8px; text-align: center; }
        .contract-editor h2 { font-size: 1.1em; font-weight: bold; margin: 12px 0 6px; }
        .contract-editor h3 { font-size: 1em; font-weight: bold; margin: 10px 0 4px; }
        .contract-editor table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .contract-editor td, .contract-editor th { border: 1px solid #ccc; padding: 4px 8px; font-size: 12px; }
      `}</style>
    </div>
  )
}
