// src/pages/seo/SeoPageDetail.jsx
import { useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  ArrowLeft,
  Globe,
  ChevronRight,
  Save,
  Tag,
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  RotateCcw,
  Info,
  Sparkles,
  FileText,
  List,
  BarChart2,
  Edit3,
  Check,
  X,
  AlertCircle,
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import AiAssistant from '../../components/seo/AiAssistant'
import { SEO_CHECKLIST, TOTAL_CHECKLIST_ITEMS, PHASE_COLORS } from '../../constants/seoChecklist'

// ─── Contoare meta ────────────────────────────────────────
function CharCounter({ value, max, label }) {
  const len = value?.length || 0
  const color =
    len === 0          ? 'text-gray-400' :
    len > max          ? 'text-red-600 font-semibold' :
    len > max * 0.85   ? 'text-yellow-600' :
    'text-green-600'

  return (
    <span className={`text-xs ${color}`}>
      {len}/{max} caractere
    </span>
  )
}

// ─── Tab: Date generale ───────────────────────────────────
function TabGeneral({ page, onSave, saving }) {
  const [form, setForm] = useState({
    name:            page.name            || '',
    page_type:       page.page_type       || 'produs',
    url_slug:        page.url_slug        || '',
    primary_keyword: page.primary_keyword || '',
    status:          page.status          || 'in_progress',
    notes:           page.notes           || '',
  })

  const PAGE_TYPES = ['produs', 'categorie', 'blog', 'homepage', 'altul']
  const STATUS_OPTIONS = [
    { value: 'in_progress',  label: 'În lucru' },
    { value: 'needs_review', label: 'Necesită review' },
    { value: 'done',         label: 'Finalizat' },
  ]

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Denumire pagină *</label>
          <input type="text" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tip pagină</label>
          <select value={form.page_type} onChange={e => setForm(f => ({ ...f, page_type: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            {PAGE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cuvânt cheie principal</label>
          <input type="text" value={form.primary_keyword}
            onChange={e => setForm(f => ({ ...f, primary_keyword: e.target.value }))}
            placeholder="ex: huse protectie pat impermeabile"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug</label>
          <input type="text" value={form.url_slug}
            onChange={e => setForm(f => ({ ...f, url_slug: e.target.value }))}
            placeholder="ex: huse-protectie-pat"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
        </div>
      </div>

      <button onClick={() => onSave(form)} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
        <Save className="w-4 h-4" />
        {saving ? 'Se salvează...' : 'Salvează modificările'}
      </button>
    </div>
  )
}

// ─── Tab: Meta SEO ────────────────────────────────────────
function TabMeta({ page, onSave, saving }) {
  const [form, setForm] = useState({
    title_tag:       page.title_tag       || '',
    meta_description: page.meta_description || '',
    h1:              page.h1              || '',
  })

  const titleStatus =
    !form.title_tag ? null :
    form.title_tag.length > 60 ? 'long' :
    form.title_tag.length > 50 ? 'ok' : 'short'

  const metaStatus =
    !form.meta_description ? null :
    form.meta_description.length > 155 ? 'long' :
    form.meta_description.length > 120 ? 'ok' : 'short'

  const StatusBar = ({ value, max, label }) => {
    const len = value?.length || 0
    const pct = Math.min((len / max) * 100, 100)
    const color = len > max ? 'bg-red-500' : len > max * 0.8 ? 'bg-yellow-400' : 'bg-green-500'
    return (
      <div className="mt-1">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{label}</span>
          <span className={len > max ? 'text-red-600 font-semibold' : len > max * 0.8 ? 'text-yellow-600' : 'text-green-600'}>
            {len}/{max}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Previzualizare SERP */}
      {(form.title_tag || form.meta_description) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Previzualizare SERP</p>
          <div className="font-sans">
            <p className="text-[#1a0dab] text-lg leading-tight hover:underline cursor-pointer truncate">
              {form.title_tag || 'Title tag...'}
            </p>
            <p className="text-[#006621] text-sm">{page.url_slug ? `https://... / ${page.url_slug}` : 'https://...'}</p>
            <p className="text-[#545454] text-sm mt-1 line-clamp-2">
              {form.meta_description || 'Meta description...'}
            </p>
          </div>
        </div>
      )}

      {/* Title Tag */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title Tag
          <span className="text-gray-400 font-normal ml-1">(recomandat: 50-60 caractere)</span>
        </label>
        <input type="text" value={form.title_tag}
          onChange={e => setForm(f => ({ ...f, title_tag: e.target.value }))}
          placeholder="ex: Huse Pat Impermeabile — Protecție Premium | Pernador.ro"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <StatusBar value={form.title_tag} max={60} label="Lungime title tag" />
      </div>

      {/* Meta Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Meta Description
          <span className="text-gray-400 font-normal ml-1">(recomandat: 120-155 caractere)</span>
        </label>
        <textarea value={form.meta_description}
          onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
          rows={3}
          placeholder="ex: Descoperă husele impermeabile pentru pat ✓ Lavabile la 60°C ✓ Livrare rapidă ✓ Garanție 2 ani. Comandă acum!"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
        <StatusBar value={form.meta_description} max={155} label="Lungime meta description" />
      </div>

      {/* H1 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          H1
          <span className="text-gray-400 font-normal ml-1">(diferit de title tag)</span>
        </label>
        <input type="text" value={form.h1}
          onChange={e => setForm(f => ({ ...f, h1: e.target.value }))}
          placeholder="ex: Huse de Pat Impermeabile — Protecție Totală"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        {form.h1 && form.title_tag && form.h1 === form.title_tag && (
          <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            H1 ar trebui să fie diferit de title tag
          </p>
        )}
      </div>

      <button onClick={() => onSave(form)} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
        <Save className="w-4 h-4" />
        {saving ? 'Se salvează...' : 'Salvează meta tags'}
      </button>
    </div>
  )
}

// ─── Import CSV Google Keyword Planner ───────────────────
function GKPImportModal({ pageId, onClose, onImported }) {
  const [rows, setRows]         = useState([])     // parsed rows
  const [selected, setSelected] = useState({})     // id → bool
  const [importing, setImporting] = useState(false)
  const [parseError, setParseError] = useState(null)
  const [step, setStep] = useState('upload')       // 'upload' | 'preview'

  // GKP Competition → dificultate
  const compToDiff = (comp) => {
    if (!comp) return 'medie'
    const v = comp.toString().toLowerCase()
    if (v === 'low'    || v === 'scazuta'  || v === 'low competition')    return 'mica'
    if (v === 'high'   || v === 'ridicata' || v === 'high competition')   return 'mare'
    return 'medie'
  }

  const parseCSV = (text) => {
    // Elimină BOM dacă există
    const clean = text.replace(/^\uFEFF/, '')

    // Detectăm separatorul: tab > ; > ,
    const sep = clean.includes('\t') ? '\t' : (clean.includes(';') ? ';' : ',')

    const lines = clean.split('\n').map(l => l.trimEnd()).filter(Boolean)

    // Găsim linia header — prima linie care conține "Keyword" ca prim câmp
    let headerIdx = lines.findIndex(l => {
      const first = l.split(sep)[0].replace(/^"|"$/g, '').trim()
      return /^keyword$/i.test(first)
    })
    if (headerIdx === -1) {
      // fallback: orice linie care conține "keyword" undeva
      headerIdx = lines.findIndex(l => /keyword/i.test(l))
    }
    if (headerIdx === -1) {
      setParseError('Nu am găsit header-ul "Keyword" în fișier. Asigură-te că exporți din Google Keyword Planner.')
      return
    }

    const headers = lines[headerIdx].split(sep).map(h =>
      h.replace(/^"|"$/g, '').trim().toLowerCase()
    )

    // Coloana keyword (primul câmp)
    const kwCol = headers.findIndex(h => /^keyword$/i.test(h.trim()))
    // Coloana volum
    const volCol = headers.findIndex(h =>
      /avg.*month|searches|volume|cautari|medie lunara/i.test(h)
    )
    // Coloana competition
    const compCol = headers.findIndex(h =>
      /^competition$/i.test(h.trim())
    )

    if (kwCol === -1) {
      setParseError('Nu am găsit coloana "Keyword" în fișier. Asigură-te că exporți din Google Keyword Planner.')
      return
    }

    const parsed = []
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.replace(/^"|"$/g, '').trim())
      const kw = cols[kwCol]
      // Sărim rândurile fără keyword (rânduri agregat All/Romania etc.)
      if (!kw || kw.length < 2) continue

      // Volum: GKP exportă "720.0" sau "1,000" — convertim la int
      let vol = null
      if (volCol !== -1 && cols[volCol]) {
        const num = parseFloat(cols[volCol].replace(/,/g, ''))
        if (!isNaN(num) && num > 0) vol = Math.round(num)
      }

      const comp = compCol !== -1 ? cols[compCol] : ''
      parsed.push({
        _id:            i,
        keyword:        kw,
        monthly_volume: vol,
        difficulty:     compToDiff(comp),
        keyword_type:   'secondary',
        competition:    comp,
      })
    }

    if (parsed.length === 0) {
      setParseError('Nu am găsit keywords în fișier. Verifică că fișierul conține date (nu doar header).')
      return
    }

    setParseError(null)
    setRows(parsed)
    const sel = {}
    parsed.forEach(r => { sel[r._id] = true })
    setSelected(sel)
    setStep('preview')
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const buffer = ev.target.result
      const bytes = new Uint8Array(buffer)
      // Detectăm encoding din BOM
      let text
      if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
        text = new TextDecoder('utf-16le').decode(buffer)
      } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
        text = new TextDecoder('utf-16be').decode(buffer)
      } else {
        text = new TextDecoder('utf-8').decode(buffer)
      }
      parseCSV(text)
    }
    reader.readAsArrayBuffer(file)
  }

  const handlePaste = (e) => {
    const text = e.target.value
    if (text.includes('\n')) parseCSV(text)
  }

  const toggleAll = (val) => {
    const sel = {}
    rows.forEach(r => { sel[r._id] = val })
    setSelected(sel)
  }

  const handleImport = async () => {
    const toImport = rows.filter(r => selected[r._id])
    if (!toImport.length) return
    setImporting(true)
    try {
      const inserts = toImport.map(r => ({
        page_id:        pageId,
        keyword:        r.keyword,
        monthly_volume: r.monthly_volume,
        keyword_type:   r.keyword_type,
        difficulty:     r.difficulty,
      }))
      const { error } = await supabase.from('seo_keywords').insert(inserts)
      if (error) throw error
      onImported()
      onClose()
    } catch (err) {
      setParseError(err.message)
    } finally {
      setImporting(false)
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Import din Google Keyword Planner</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Exportă din GKP → „Descarcă plan de cuvinte cheie" → CSV
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'upload' ? (
          <div className="p-6 space-y-4">
            {/* Instrucțiuni */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
              <p className="font-semibold">Cum exportezi din Google Keyword Planner:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
                <li>Mergi la <a href="https://ads.google.com/home/tools/keyword-planner/" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Keyword Planner</a></li>
                <li>Caută keywords → selectează-le pe cele dorite</li>
                <li>Click <strong>„Descarcă planul"</strong> sau <strong>„Download"</strong> → alege <strong>CSV</strong></li>
                <li>Încarcă fișierul mai jos</li>
              </ol>
            </div>

            {/* Upload fișier */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Încarcă fișier CSV</label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                <Plus className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Click pentru a selecta fișierul .csv</span>
                <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
              </label>
            </div>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">SAU</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Paste text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lipește conținutul CSV</label>
              <textarea
                rows={5}
                placeholder={"Keyword,Avg. monthly searches,Competition\nserviciu curatenie,1000,Low\n..."}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                onChange={handlePaste}
              />
            </div>

            {parseError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {parseError}
              </div>
            )}
          </div>
        ) : (
          /* Preview */
          <div className="flex flex-col flex-1 min-h-0">
            <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                <strong>{rows.length}</strong> keywords găsite —
                <button onClick={() => toggleAll(true)} className="text-primary-600 hover:underline ml-1">selectează toate</button>
                {' / '}
                <button onClick={() => toggleAll(false)} className="text-gray-500 hover:underline">deselectează</button>
              </span>
              <span className="text-sm font-medium text-primary-700">{selectedCount} selectate</span>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-200">
                    <th className="py-2 w-8"></th>
                    <th className="py-2">Keyword</th>
                    <th className="py-2 text-right">Volum/lună</th>
                    <th className="py-2">Dificultate</th>
                    <th className="py-2">Tip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(r => (
                    <tr key={r._id} className={selected[r._id] ? 'bg-blue-50/40' : 'opacity-40'}>
                      <td className="py-2">
                        <input type="checkbox" checked={!!selected[r._id]}
                          onChange={e => setSelected(s => ({ ...s, [r._id]: e.target.checked }))}
                          className="w-4 h-4 rounded accent-primary-600" />
                      </td>
                      <td className="py-2 font-medium text-gray-900">{r.keyword}</td>
                      <td className="py-2 text-right text-gray-600">
                        {r.monthly_volume ? r.monthly_volume.toLocaleString() : '—'}
                      </td>
                      <td className="py-2">
                        <select value={r.difficulty}
                          onChange={e => setRows(rs => rs.map(x => x._id === r._id ? { ...x, difficulty: e.target.value } : x))}
                          className="border border-gray-200 rounded px-1.5 py-0.5 text-xs">
                          <option value="mica">Mică</option>
                          <option value="medie">Medie</option>
                          <option value="mare">Mare</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <select value={r.keyword_type}
                          onChange={e => setRows(rs => rs.map(x => x._id === r._id ? { ...x, keyword_type: e.target.value } : x))}
                          className="border border-gray-200 rounded px-1.5 py-0.5 text-xs">
                          <option value="primary">Primary</option>
                          <option value="secondary">Secondary</option>
                          <option value="long_tail">Long tail</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parseError && (
              <div className="mx-6 my-2 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {parseError}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          {step === 'preview' ? (
            <>
              <button onClick={() => setStep('upload')} className="text-sm text-gray-600 hover:text-gray-800">
                ← Înapoi
              </button>
              <button onClick={handleImport} disabled={importing || selectedCount === 0}
                className="px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {importing ? 'Se importă...' : `Importă ${selectedCount} keyword${selectedCount !== 1 ? '-uri' : ''}`}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="ml-auto text-sm text-gray-600 hover:text-gray-800">
              Anulează
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Keywords ────────────────────────────────────────
function TabKeywords({ pageId, keywords, onRefresh }) {
  const [newKw, setNewKw]     = useState({ keyword: '', monthly_volume: '', keyword_type: 'secondary', difficulty: 'medie' })
  const [adding, setAdding]   = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showGKP, setShowGKP]  = useState(false)
  const [error, setError]     = useState(null)

  const typeColor = (t) => ({
    primary:   'bg-blue-100 text-blue-700',
    secondary: 'bg-purple-100 text-purple-700',
    long_tail: 'bg-green-100 text-green-700',
  }[t] || 'bg-gray-100 text-gray-700')

  const diffColor = (d) => ({
    mica:  'bg-green-100 text-green-700',
    medie: 'bg-yellow-100 text-yellow-700',
    mare:  'bg-red-100 text-red-700',
  }[d] || 'bg-gray-100 text-gray-700')

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newKw.keyword.trim()) { setError('Keyword-ul este obligatoriu.'); return }
    setAdding(true)
    setError(null)
    try {
      const { error } = await supabase.from('seo_keywords').insert({
        page_id:        pageId,
        keyword:        newKw.keyword.trim(),
        monthly_volume: newKw.monthly_volume ? parseInt(newKw.monthly_volume) : null,
        keyword_type:   newKw.keyword_type,
        difficulty:     newKw.difficulty,
      })
      if (error) throw error
      setNewKw({ keyword: '', monthly_volume: '', keyword_type: 'secondary', difficulty: 'medie' })
      setShowForm(false)
      onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    await supabase.from('seo_keywords').delete().eq('id', id)
    setDeleting(null)
    onRefresh()
  }

  const totalVolume = keywords?.reduce((s, k) => s + (k.monthly_volume || 0), 0) || 0

  return (
    <div className="max-w-3xl">
      {/* Stats bar */}
      {keywords?.length > 0 && (
        <div className="flex gap-4 mb-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-center">
            <p className="text-lg font-bold text-gray-900">{keywords.length}</p>
            <p className="text-xs text-gray-500">keywords</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
            <p className="text-lg font-bold text-blue-700">{totalVolume.toLocaleString()}</p>
            <p className="text-xs text-gray-500">volum total/lună</p>
          </div>
        </div>
      )}

      {/* Butoane adaugă / import */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">
          {keywords?.length || 0} keyword-uri adăugate
        </h3>
        <div className="flex gap-2">
          <button onClick={() => setShowGKP(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            Import GKP
          </button>
          <button onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
            <Plus className="w-4 h-4" />
            Adaugă manual
          </button>
        </div>
      </div>

      {/* Modal import GKP */}
      {showGKP && (
        <GKPImportModal
          pageId={pageId}
          onClose={() => setShowGKP(false)}
          onImported={() => { setShowGKP(false); onRefresh() }}
        />
      )}

      {/* Formular adăugare */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <input type="text" value={newKw.keyword}
                onChange={e => setNewKw(f => ({ ...f, keyword: e.target.value }))}
                placeholder="Keyword *"
                className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <input type="number" value={newKw.monthly_volume}
                onChange={e => setNewKw(f => ({ ...f, monthly_volume: e.target.value }))}
                placeholder="Volum/lună (opțional)"
                className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={newKw.keyword_type} onChange={e => setNewKw(f => ({ ...f, keyword_type: e.target.value }))}
                className="border border-blue-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="long_tail">Long tail</option>
              </select>
              <select value={newKw.difficulty} onChange={e => setNewKw(f => ({ ...f, difficulty: e.target.value }))}
                className="border border-blue-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="mica">Mică</option>
                <option value="medie">Medie</option>
                <option value="mare">Mare</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
              Anulează
            </button>
            <button type="submit" disabled={adding}
              className="px-4 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {adding ? 'Se adaugă...' : 'Adaugă'}
            </button>
          </div>
        </form>
      )}

      {/* Tabel keywords */}
      {keywords?.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
          <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Niciun keyword adăugat. Adaugă manual sau folosește asistența AI.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-200">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Keyword</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Volum/lună</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Tip</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Dificultate</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keywords.sort((a, b) => (b.monthly_volume || 0) - (a.monthly_volume || 0)).map(kw => (
                <tr key={kw.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-medium text-gray-900">{kw.keyword}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">
                    {kw.monthly_volume ? kw.monthly_volume.toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor(kw.keyword_type)}`}>
                      {kw.keyword_type?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diffColor(kw.difficulty)}`}>
                      {kw.difficulty || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => handleDelete(kw.id)} disabled={deleting === kw.id}
                      className="text-gray-400 hover:text-red-600 p-1 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className="px-3 py-2 font-semibold text-gray-700" colSpan={2}>
                  Total volum: <span className="text-primary-700">{totalVolume.toLocaleString()}/lună</span>
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Checklist ───────────────────────────────────────
function TabChecklist({ pageId, savedProgress, onRefresh }) {
  const [toggling, setToggling] = useState(null)
  const [showReset, setShowReset] = useState(false)

  const progressMap = {}
  savedProgress?.forEach(p => {
    progressMap[`${p.phase_id}:${p.item_index}`] = p.completed
  })

  const completedCount = savedProgress?.filter(p => p.completed).length || 0
  const overallPct = TOTAL_CHECKLIST_ITEMS > 0
    ? Math.round((completedCount / TOTAL_CHECKLIST_ITEMS) * 100)
    : 0

  const toggle = async (phaseId, itemIndex, currentValue) => {
    const key = `${phaseId}:${itemIndex}`
    setToggling(key)
    const newValue = !currentValue
    try {
      await supabase.from('seo_checklist_progress').upsert({
        page_id:      pageId,
        phase_id:     phaseId,
        item_index:   itemIndex,
        completed:    newValue,
        completed_at: newValue ? new Date().toISOString() : null,
      }, { onConflict: 'page_id,phase_id,item_index' })
      onRefresh()
    } finally {
      setToggling(null)
    }
  }

  const resetAll = async () => {
    await supabase.from('seo_checklist_progress').delete().eq('page_id', pageId)
    onRefresh()
    setShowReset(false)
  }

  return (
    <div className="max-w-3xl">
      {/* Progress global */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-gray-900">Progres general</span>
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-bold ${
              overallPct >= 80 ? 'text-green-600' :
              overallPct >= 40 ? 'text-yellow-600' : 'text-red-500'
            }`}>{overallPct}%</span>
            <button onClick={() => setShowReset(true)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className={`h-3 rounded-full transition-all duration-500 ${
            overallPct >= 80 ? 'bg-green-500' :
            overallPct >= 40 ? 'bg-yellow-400' : 'bg-red-400'
          }`} style={{ width: `${overallPct}%` }} />
        </div>
        <p className="text-xs text-gray-500 mt-1">{completedCount}/{TOTAL_CHECKLIST_ITEMS} itemi bifați</p>
      </div>

      {/* Faze */}
      <div className="space-y-4">
        {SEO_CHECKLIST.map(phase => {
          const colors = PHASE_COLORS[phase.color]
          const phaseCompleted = phase.items.filter((_, idx) => progressMap[`${phase.id}:${idx}`]).length
          const phasePct = Math.round((phaseCompleted / phase.items.length) * 100)

          return (
            <div key={phase.id} className={`border rounded-xl overflow-hidden ${colors.border}`}>
              <div className={`px-4 py-3 flex items-center justify-between ${colors.bg}`}>
                <h3 className={`font-semibold text-sm ${colors.text}`}>{phase.title}</h3>
                <span className={`text-xs font-medium ${colors.text}`}>
                  {phaseCompleted}/{phase.items.length} ({phasePct}%)
                </span>
              </div>

              <div className="divide-y divide-gray-100 bg-white">
                {phase.items.map((item, idx) => {
                  const key = `${phase.id}:${idx}`
                  const done = !!progressMap[key]
                  const isToggling = toggling === key

                  return (
                    <div key={idx} className={`flex items-start gap-3 px-4 py-3 transition-colors ${done ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                      <button
                        onClick={() => toggle(phase.id, idx, done)}
                        disabled={!!toggling}
                        className={`mt-0.5 shrink-0 rounded-full transition-all ${
                          done ? 'text-green-600' : 'text-gray-300 hover:text-gray-500'
                        } ${isToggling ? 'opacity-50' : ''}`}
                      >
                        {done ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </button>
                      <div className="flex-1">
                        <p className={`text-sm ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {item.text}
                        </p>
                        {item.detail && (
                          <p className="text-xs text-gray-400 mt-0.5">{item.detail}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirmare reset */}
      {showReset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Resetează progresul</h3>
            <p className="text-sm text-gray-600 mb-4">
              Vei bifa toate itemele ca necompletate. Această acțiune nu poate fi anulată.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowReset(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Anulează
              </button>
              <button onClick={resetAll}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                Resetează
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pagina principală ────────────────────────────────────
export default function SeoPageDetail() {
  const { siteId, pageId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('general')
  const [saving, setSaving] = useState(false)

  const tabs = [
    { id: 'general',   label: 'Date generale', icon: FileText },
    { id: 'meta',      label: 'Meta SEO',       icon: Edit3 },
    { id: 'keywords',  label: 'Keywords',        icon: Tag },
    { id: 'checklist', label: 'Checklist',       icon: List },
    { id: 'ai',        label: 'Asistență AI',    icon: Sparkles },
  ]

  // Fetch site
  const { data: site } = useQuery({
    queryKey: ['seo-site', siteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('seo_sites').select('*').eq('id', siteId).single()
      if (error) throw error
      return data
    },
  })

  // Fetch page cu keywords și checklist
  const { data: page, isLoading } = useQuery({
    queryKey: ['seo-page', pageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_pages')
        .select(`*, seo_keywords(*), seo_checklist_progress(*)`)
        .eq('id', pageId)
        .single()
      if (error) throw error
      return data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (fields) => {
      const { error } = await supabase.from('seo_pages').update(fields).eq('id', pageId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-page', pageId] })
      queryClient.invalidateQueries({ queryKey: ['seo-pages', siteId] })
      queryClient.invalidateQueries({ queryKey: ['seo-sites'] })
    },
  })

  const handleSave = async (fields) => {
    setSaving(true)
    try {
      await saveMutation.mutateAsync(fields)
    } finally {
      setSaving(false)
    }
  }

  const handleApplyAi = useCallback(async (field, value) => {
    await supabase.from('seo_pages').update({ [field]: value }).eq('id', pageId)
    queryClient.invalidateQueries({ queryKey: ['seo-page', pageId] })
  }, [pageId, queryClient])

  const refreshPage = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['seo-page', pageId] })
    queryClient.invalidateQueries({ queryKey: ['seo-pages', siteId] })
    queryClient.invalidateQueries({ queryKey: ['seo-sites'] })
  }, [pageId, siteId, queryClient])

  if (isLoading) return <LoadingSpinner />
  if (!page) return <div className="text-center text-gray-500 py-20">Pagina nu a fost găsită.</div>

  const checklistPct = TOTAL_CHECKLIST_ITEMS > 0
    ? Math.round(((page.seo_checklist_progress?.filter(p => p.completed).length || 0) / TOTAL_CHECKLIST_ITEMS) * 100)
    : 0

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <button onClick={() => navigate('/seo')} className="text-gray-400 hover:text-gray-600">SEO</button>
        <ChevronRight className="w-4 h-4 text-gray-300" />
        <button onClick={() => navigate(`/seo/${siteId}`)} className="text-gray-400 hover:text-gray-600">
          {site?.name}
        </button>
        <ChevronRight className="w-4 h-4 text-gray-300" />
        <span className="text-gray-700 font-medium truncate max-w-xs">{page.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{page.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {page.url_slug && (
                <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  /{page.url_slug}
                </span>
              )}
              {page.primary_keyword && (
                <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {page.primary_keyword}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-2xl font-bold ${
              checklistPct >= 80 ? 'text-green-600' :
              checklistPct >= 40 ? 'text-yellow-600' : 'text-red-500'
            }`}>{checklistPct}%</div>
            <div className="text-xs text-gray-500">checklist SEO</div>
          </div>
        </div>

        {/* Mini progress */}
        <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full transition-all ${
            checklistPct >= 80 ? 'bg-green-500' :
            checklistPct >= 40 ? 'bg-yellow-400' : 'bg-red-400'
          }`} style={{ width: `${checklistPct}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {activeTab === 'general' && (
          <TabGeneral page={page} onSave={handleSave} saving={saving} />
        )}
        {activeTab === 'meta' && (
          <TabMeta page={page} onSave={handleSave} saving={saving} />
        )}
        {activeTab === 'keywords' && (
          <TabKeywords
            pageId={pageId}
            keywords={page.seo_keywords || []}
            onRefresh={refreshPage}
          />
        )}
        {activeTab === 'checklist' && (
          <TabChecklist
            pageId={pageId}
            savedProgress={page.seo_checklist_progress || []}
            onRefresh={refreshPage}
          />
        )}
        {activeTab === 'ai' && site && (
          <AiAssistant
            page={{ ...page, seo_keywords: page.seo_keywords }}
            site={site}
            onApply={handleApplyAi}
            onKeywordsAdded={refreshPage}
          />
        )}
      </div>
    </div>
  )
}
