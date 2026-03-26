import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Upload, Save, RefreshCw, Eye, EyeOff, FileText,
  ChevronDown, ChevronRight, AlertCircle, CheckCircle,
  Trash2, Plus, Info
} from 'lucide-react'

// ─── Toate shortcode-urile disponibile ───────────────────────────────────────
const SHORTCODE_GROUPS = [
  {
    label: 'Contract',
    color: 'purple',
    codes: [
      { code: '{{CONTRACT_NUMBER}}',    label: 'Număr contract' },
      { code: '{{CONTRACT_DATE}}',      label: 'Data contract' },
    ],
  },
  {
    label: 'Vânzător',
    color: 'blue',
    codes: [
      { code: '{{SELLER_NAME}}',              label: 'Denumire' },
      { code: '{{SELLER_ADDRESS}}',           label: 'Adresă' },
      { code: '{{SELLER_J_CODE}}',            label: 'Cod J' },
      { code: '{{SELLER_CUI}}',              label: 'CUI' },
      { code: '{{SELLER_REPRESENTATIVE}}',    label: 'Reprezentant' },
      { code: '{{SELLER_REPRESENTATIVE_ROLE}}', label: 'Calitate reprezentant' },
    ],
  },
  {
    label: 'Cumpărător',
    color: 'green',
    codes: [
      { code: '{{BUYER_NAME}}',               label: 'Denumire' },
      { code: '{{BUYER_ADDRESS}}',            label: 'Adresă' },
      { code: '{{BUYER_COUNTY}}',             label: 'Județ' },
      { code: '{{BUYER_J_CODE}}',             label: 'Cod J' },
      { code: '{{BUYER_CUI}}',               label: 'CUI' },
      { code: '{{BUYER_REPRESENTATIVE}}',     label: 'Reprezentant' },
      { code: '{{BUYER_REPRESENTATIVE_ROLE}}', label: 'Calitate reprezentant' },
      { code: '{{BUYER_EMAIL}}',              label: 'Email' },
    ],
  },
  {
    label: 'Condiții Plată',
    color: 'amber',
    codes: [
      { code: '{{PAYMENT_TERM_DAYS}}',      label: 'Zile termen plată' },
      { code: '{{PAYMENT_TERM_TEXT}}',      label: 'Termen plată în litere' },
      { code: '{{ADVANCE_PERCENT}}',        label: 'Procent avans (%)' },
      { code: '{{DELIVERY_PERCENT}}',       label: 'Procent la livrare (%)' },
      { code: '{{INVOICE_TERM_DAYS}}',      label: 'Zile termen factură' },
      { code: '{{INVOICE_TERM_TEXT}}',      label: 'Termen factură în litere' },
      { code: '{{INVOICE_TERM_PERCENT}}',   label: 'Procent termen factură (%)' },
    ],
  },
  {
    label: 'General',
    color: 'gray',
    codes: [
      { code: '{{NOTES}}', label: 'Observații / Clauze speciale' },
    ],
  },
]

const COLOR_MAP = {
  purple: { btn: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100', header: 'text-purple-700', dot: 'bg-purple-400' },
  blue:   { btn: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',         header: 'text-blue-700',   dot: 'bg-blue-400' },
  green:  { btn: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',     header: 'text-green-700',  dot: 'bg-green-400' },
  amber:  { btn: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',     header: 'text-amber-700',  dot: 'bg-amber-400' },
  gray:   { btn: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',         header: 'text-gray-700',   dot: 'bg-gray-400' },
}

// Highlight shortcodes in preview
function highlightShortcodes(html) {
  return html.replace(
    /\{\{([A-Z_]+)\}\}/g,
    '<mark style="background:#fef08a;color:#92400e;padding:0 3px;border-radius:3px;font-family:monospace;font-size:0.85em">{{$1}}</mark>'
  )
}

// Replace shortcodes with actual contract values
export function applyTemplate(templateHtml, contract) {
  if (!templateHtml || !contract) return templateHtml
  const map = {
    '{{CONTRACT_NUMBER}}':           contract.contract_number || '',
    '{{CONTRACT_DATE}}':             contract.contract_date || '',
    '{{SELLER_NAME}}':               contract.seller_name || '',
    '{{SELLER_ADDRESS}}':            contract.seller_address || '',
    '{{SELLER_J_CODE}}':             contract.seller_j_code || '',
    '{{SELLER_CUI}}':                contract.seller_cui || '',
    '{{SELLER_REPRESENTATIVE}}':     contract.seller_representative || '',
    '{{SELLER_REPRESENTATIVE_ROLE}}':contract.seller_representative_role || '',
    '{{BUYER_NAME}}':                contract.buyer_name || '',
    '{{BUYER_ADDRESS}}':             contract.buyer_address || '',
    '{{BUYER_COUNTY}}':              contract.buyer_county || '',
    '{{BUYER_J_CODE}}':              contract.buyer_j_code || '',
    '{{BUYER_CUI}}':                 contract.buyer_cui || '',
    '{{BUYER_REPRESENTATIVE}}':      contract.buyer_representative || '',
    '{{BUYER_REPRESENTATIVE_ROLE}}': contract.buyer_representative_role || '',
    '{{BUYER_EMAIL}}':               contract.buyer_email || '',
    '{{PAYMENT_TERM_DAYS}}':         String(contract.payment_term_days || ''),
    '{{PAYMENT_TERM_TEXT}}':         contract.payment_term_text || '',
    '{{ADVANCE_PERCENT}}':           String(contract.advance_percent || '0'),
    '{{DELIVERY_PERCENT}}':          String(contract.delivery_percent || '0'),
    '{{INVOICE_TERM_DAYS}}':         String(contract.invoice_term_days || ''),
    '{{INVOICE_TERM_TEXT}}':         contract.invoice_term_text || '',
    '{{INVOICE_TERM_PERCENT}}':      String(contract.invoice_term_percent || ''),
    '{{NOTES}}':                     contract.notes || '',
  }
  let result = templateHtml
  for (const [key, val] of Object.entries(map)) {
    result = result.replaceAll(key, val)
  }
  return result
}

export default function ContractTemplateEditor() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const editorRef = useRef(null)
  const fileInputRef = useRef(null)
  const savedSelectionRef = useRef(null)

  const [templateName, setTemplateName] = useState('Șablon Contract')
  const [loading, setLoading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [openGroups, setOpenGroups] = useState({ 'Contract': true, 'Vânzător': true, 'Cumpărător': true, 'Condiții Plată': true, 'General': true })
  const canEdit = profile?.role === 'admin' || profile?.role === 'technician'

  // Fetch template activ
  const { data: existingTemplate } = useQuery({
    queryKey: ['contract-template'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data
    },
  })

  // Încarcă template în editor când e disponibil
  useEffect(() => {
    if (existingTemplate && editorRef.current) {
      editorRef.current.innerHTML = existingTemplate.content
      setTemplateName(existingTemplate.name)
    }
  }, [existingTemplate])

  // Salvare cursor înainte de click pe butoane shortcode
  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      // Verifică că selecția e în editor
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedSelectionRef.current = range.cloneRange()
      }
    }
  }

  // Restabilire cursor
  const restoreSelection = () => {
    if (savedSelectionRef.current) {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(savedSelectionRef.current)
      return true
    }
    return false
  }

  // Insert shortcode la poziția cursorului
  const insertShortcode = useCallback((code) => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()

    // Încearcă să restabilim selecția salvată
    const restored = restoreSelection()

    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      // Verifică că e în editor
      if (!editor.contains(range.commonAncestorContainer)) {
        // Inserează la final
        const textNode = document.createTextNode(code)
        editor.appendChild(textNode)
        const newRange = document.createRange()
        newRange.setStartAfter(textNode)
        newRange.collapse(true)
        sel.removeAllRanges()
        sel.addRange(newRange)
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
      // Inserează la final dacă nu e selecție
      const textNode = document.createTextNode(code)
      editor.appendChild(textNode)
    }
  }, [])

  // Upload și conversie .docx
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.endsWith('.docx')) {
      setError('Acceptăm doar fișiere .docx')
      return
    }
    setConverting(true)
    setError(null)
    try {
      // Mammoth din CDN
      if (!window.mammoth) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
          s.onload = resolve
          s.onerror = () => reject(new Error('Nu s-a putut încărca convertorul'))
          document.head.appendChild(s)
        })
      }
      const arrayBuffer = await file.arrayBuffer()
      const result = await window.mammoth.convertToHtml({ arrayBuffer })
      if (editorRef.current) {
        editorRef.current.innerHTML = result.value
      }
      if (result.messages?.length > 0) {
        console.warn('Mammoth warnings:', result.messages)
      }
    } catch (err) {
      setError('Eroare la conversie: ' + err.message)
    } finally {
      setConverting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Salvare template în DB
  const saveMutation = useMutation({
    mutationFn: async () => {
      const content = editorRef.current?.innerHTML || ''
      if (!content.trim()) throw new Error('Șablonul este gol')

      const payload = {
        name: templateName,
        content,
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      if (existingTemplate) {
        const { error } = await supabase
          .from('contract_templates')
          .update(payload)
          .eq('id', existingTemplate.id)
        if (error) throw error
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase
          .from('contract_templates')
          .insert({ ...payload, created_by: user?.id })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contract-template'])
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
    onError: (err) => setError(err.message),
  })

  // Golire editor
  const handleClear = () => {
    if (window.confirm('Ești sigur că vrei să ștergi tot conținutul editorului?')) {
      if (editorRef.current) editorRef.current.innerHTML = ''
    }
  }

  const toggleGroup = (label) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Șablon Contract</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Încarcă contractul tău .docx, plasează shortcodes în text și salvează
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              previewMode ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {previewMode ? 'Editare' : 'Previzualizare'}
          </button>
          {canEdit && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : saveSuccess ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveSuccess ? 'Salvat!' : 'Salvează șablonul'}
            </button>
          )}
        </div>
      </div>

      {/* Erori */}
      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Instrucțiuni */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium mb-1">Cum se folosește:</p>
          <ol className="space-y-0.5 text-xs text-blue-600 list-decimal list-inside">
            <li>Încarcă contractul tău <strong>.docx</strong> sau scrie direct în editor</li>
            <li>Dă click în text <strong>exact unde</strong> vrei să apară o valoare</li>
            <li>Dă click pe butonul shortcode-ului dorit din panoul din dreapta</li>
            <li>Salvează șablonul — va fi folosit la generarea tuturor contractelor</li>
          </ol>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">

        {/* ── EDITOR ────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Toolbar */}
          {!previewMode && canEdit && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Upload .docx */}
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
                {converting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {converting ? 'Se convertește...' : 'Încarcă .docx'}
              </button>

              {/* Nume șablon */}
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Nume șablon..."
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent w-48"
              />

              <button
                onClick={handleClear}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4" />
                Golește
              </button>
            </div>
          )}

          {/* Editor / Preview */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {previewMode ? (
              <div className="p-6">
                <p className="text-xs text-amber-600 font-medium mb-4 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  Previzualizare — shortcodes evidențiate cu galben
                </p>
                <div
                  className="prose prose-sm max-w-none contract-preview"
                  style={{ fontFamily: 'Times New Roman, serif', fontSize: '13px', lineHeight: '1.6' }}
                  dangerouslySetInnerHTML={{
                    __html: highlightShortcodes(editorRef.current?.innerHTML || '<p><em>Editorul este gol.</em></p>')
                  }}
                />
              </div>
            ) : (
              <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-1 text-xs text-gray-500">
                <FileText className="w-3.5 h-3.5" />
                Editor — dă click în text, apoi pe un shortcode din dreapta
              </div>
            )}

            {!previewMode && (
              <div
                ref={editorRef}
                contentEditable={canEdit}
                suppressContentEditableWarning
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                onBlur={saveSelection}
                className="min-h-[500px] p-6 focus:outline-none contract-editor"
                style={{
                  fontFamily: 'Times New Roman, serif',
                  fontSize: '13px',
                  lineHeight: '1.7',
                }}
                data-placeholder="Încarcă un fișier .docx sau scrie direct contractul aici..."
              />
            )}
          </div>

          {existingTemplate && (
            <p className="text-xs text-gray-400">
              Ultima salvare: {new Date(existingTemplate.updated_at).toLocaleString('ro-RO')}
            </p>
          )}
        </div>

        {/* ── PANOU SHORTCODES ──────────────────────────────────────────── */}
        <div className="lg:w-72 shrink-0 space-y-2">
          <div className="sticky top-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
              Shortcodes disponibile
            </p>

            {SHORTCODE_GROUPS.map(group => {
              const colors = COLOR_MAP[group.color]
              const isOpen = openGroups[group.label] !== false

              return (
                <div key={group.label} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      <span className={`text-xs font-semibold ${colors.header}`}>{group.label}</span>
                    </div>
                    {isOpen
                      ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    }
                  </button>

                  {/* Group codes */}
                  {isOpen && (
                    <div className="px-2 pb-2 space-y-1">
                      {group.codes.map(({ code, label }) => (
                        <button
                          key={code}
                          onClick={() => insertShortcode(code)}
                          disabled={!canEdit || previewMode}
                          title={`Inserează ${code}`}
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

            {/* Legend */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 mb-2">Exemplu</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Text: <em>"semnat de <span className="bg-yellow-100 text-yellow-800 px-1 rounded font-mono text-[10px]">{"{{BUYER_REPRESENTATIVE}}"}</span>"</em>
                <br />devine:<br />
                <em>"semnat de <strong>Ion Popescu</strong>"</em>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CSS pentru placeholder și stiluri editor */}
      <style>{`
        .contract-editor:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        .contract-editor p { margin: 0 0 8px; }
        .contract-editor h1 { font-size: 1.4em; font-weight: bold; margin: 16px 0 8px; text-align: center; }
        .contract-editor h2 { font-size: 1.1em; font-weight: bold; margin: 12px 0 6px; }
        .contract-editor h3 { font-size: 1em; font-weight: bold; margin: 10px 0 4px; }
        .contract-editor table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .contract-editor td, .contract-editor th { border: 1px solid #ccc; padding: 4px 8px; font-size: 12px; }
        .contract-preview p { margin: 0 0 8px; }
        .contract-preview h1 { font-size: 1.4em; font-weight: bold; margin: 16px 0 8px; text-align: center; }
        .contract-preview h2 { font-size: 1.1em; font-weight: bold; margin: 12px 0 6px; }
        .contract-preview table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .contract-preview td, .contract-preview th { border: 1px solid #ccc; padding: 4px 8px; font-size: 12px; }
      `}</style>
    </div>
  )
}
