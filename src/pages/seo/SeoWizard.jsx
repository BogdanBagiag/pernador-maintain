// src/pages/seo/SeoWizard.jsx
import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  ArrowLeft, ArrowRight, Check, ChevronRight,
  Package, LayoutGrid, FileText, Home,
  Tag, Search, BarChart2, Globe, Sparkles,
  Plus, Trash2, Upload, ExternalLink, AlertCircle,
  CheckCircle, RefreshCw, Edit3, Info, X,
  TrendingUp, Target, Zap, Eye,
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import { callClaude, generateSeoRecipe, suggestKeywords } from '../../utils/claudeApi'

// ─── Constante ────────────────────────────────────────────
const PAGE_TYPES = [
  { value: 'produs',    label: 'Produs',     icon: Package,    color: 'border-blue-300 bg-blue-50 text-blue-700',   desc: 'Pagină de produs individual cu opțiuni de cumpărare' },
  { value: 'categorie', label: 'Categorie',  icon: LayoutGrid, color: 'border-purple-300 bg-purple-50 text-purple-700', desc: 'Categorie sau colecție cu mai multe produse' },
  { value: 'blog',      label: 'Articol blog', icon: FileText,  color: 'border-green-300 bg-green-50 text-green-700', desc: 'Articol informativ sau ghid pentru clienți' },
  { value: 'homepage',  label: 'Homepage',   icon: Home,       color: 'border-orange-300 bg-orange-50 text-orange-700', desc: 'Pagina principală a site-ului' },
]

const INTENT_TYPES = [
  { value: 'transactional', label: 'Tranzacțională', icon: '🛒', desc: 'Utilizatorul vrea să cumpere — vede pagini de produs, add to cart, prețuri' },
  { value: 'commercial',    label: 'Comercială',     icon: '🔍', desc: 'Utilizatorul compară — vede recenzii, comparații, top-uri' },
  { value: 'informational', label: 'Informațională',  icon: '📖', desc: 'Utilizatorul caută informații — vede ghiduri, articole, FAQ' },
  { value: 'navigational',  label: 'Navigațională',  icon: '🧭', desc: 'Utilizatorul caută un brand/site specific' },
]

const STEPS = [
  { id: 1, label: 'Tip pagină',         short: 'Tip' },
  { id: 2, label: 'Keywords',            short: 'Keywords' },
  { id: 3, label: 'Keyword principal',   short: 'Principal' },
  { id: 4, label: 'Intenție & SERP',     short: 'SERP' },
  { id: 5, label: 'Clasificare',         short: 'Clasificare' },
  { id: 6, label: 'Generare AI',         short: 'AI' },
  { id: 7, label: 'Validare & Creare',   short: 'Final' },
]

// ─── Utilitar slug ─────────────────────────────────────────
function toSlug(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// ─── Bare de progres & header ──────────────────────────────
function WizardHeader({ step, siteData, pageName }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <span>SEO</span>
        <ChevronRight className="w-4 h-4" />
        <span>{siteData?.name || '...'}</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 font-medium">Wizard {pageName ? `— ${pageName}` : ''}</span>
      </div>

      {/* Step bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const done = step > s.id
          const active = step === s.id
          return (
            <div key={s.id} className="flex items-center gap-1 shrink-0">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                done   ? 'bg-green-100 text-green-700' :
                active ? 'bg-primary-600 text-white shadow-sm' :
                         'bg-gray-100 text-gray-400'
              }`}>
                {done ? <Check className="w-3 h-3" /> : <span>{s.id}</span>}
                <span className="hidden sm:inline">{s.short}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-px shrink-0 ${done ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Navigation buttons ────────────────────────────────────
function WizardNav({ step, onBack, onNext, nextLabel, nextDisabled, loading }) {
  return (
    <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
      <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
        <ArrowLeft className="w-4 h-4" />
        {step === 1 ? 'Anulează' : 'Înapoi'}
      </button>
      <button onClick={onNext} disabled={nextDisabled || loading}
        className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed">
        {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Se procesează...</> : <>{nextLabel || 'Continuă'} <ArrowRight className="w-4 h-4" /></>}
      </button>
    </div>
  )
}

// ─── AI badge ─────────────────────────────────────────────
function AiBadge({ loading, error }) {
  if (loading) return <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full"><RefreshCw className="w-3 h-3 animate-spin" />Claude analizează...</span>
  if (error)   return <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 text-xs rounded-full"><AlertCircle className="w-3 h-3" />AI indisponibil</span>
  return <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full"><Sparkles className="w-3 h-3" />Asistat de Claude</span>
}

// ─── PASUL 1: Tip pagină + descriere ─────────────────────
function Step1({ data, update }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Ce pagină optimizezi?</h2>
      <p className="text-gray-500 mb-6">Alege tipul paginii — asta influențează strategia de keywords și structura conținutului.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {PAGE_TYPES.map(pt => {
          const selected = data.pageType === pt.value
          return (
            <button key={pt.value} onClick={() => update({ pageType: pt.value })}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                selected ? pt.color + ' border-current shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}>
              <pt.icon className={`w-5 h-5 mt-0.5 shrink-0 ${selected ? '' : 'text-gray-400'}`} />
              <div>
                <p className={`font-semibold text-sm ${selected ? '' : 'text-gray-700'}`}>{pt.label}</p>
                <p className={`text-xs mt-0.5 ${selected ? 'opacity-80' : 'text-gray-400'}`}>{pt.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      {data.pageType && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numele paginii / produsului <span className="text-red-500">*</span>
            </label>
            <input type="text" value={data.pageName}
              onChange={e => update({ pageName: e.target.value, urlSlug: toSlug(e.target.value) })}
              placeholder={data.pageType === 'produs' ? 'Ex: Huse impermeabile pat' : data.pageType === 'categorie' ? 'Ex: Huse de protecție pat' : 'Ex: Ghid complet huse impermeabile'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descriere scurtă — ce este produsul/pagina?
            </label>
            <textarea rows={3} value={data.description}
              onChange={e => update({ description: e.target.value })}
              placeholder="Ex: Huse impermeabile pentru pat disponibile în dimensiuni 90x200, 120x200, 140x200, 160x200, 180x200. Material poliester cu strat impermeabil, lavabile la 60°C. Ideale pentru copii, persoane vârstnice sau animale de companie."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>

          {data.pageName && (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <Globe className="w-3.5 h-3.5" />
              URL slug generat: <code className="font-mono text-gray-700">/{toSlug(data.pageName)}</code>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── PASUL 2: Keywords ────────────────────────────────────
function Step2({ data, update, siteData }) {
  const [newKw, setNewKw] = useState({ keyword: '', monthly_volume: '', difficulty: 'medie' })
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)

  const addKeyword = () => {
    if (!newKw.keyword.trim()) return
    const kw = {
      id: Date.now(),
      keyword: newKw.keyword.trim(),
      monthly_volume: newKw.monthly_volume ? parseInt(newKw.monthly_volume) : null,
      difficulty: newKw.difficulty,
      keyword_type: 'secondary',
      source: 'manual',
    }
    update({ keywords: [...data.keywords, kw] })
    setNewKw({ keyword: '', monthly_volume: '', difficulty: 'medie' })
  }

  const removeKw = (id) => update({ keywords: data.keywords.filter(k => k.id !== id) })

  const aiSuggest = async () => {
    setAiLoading(true); setAiError(null)
    try {
      const result = await suggestKeywords({
        pageName: data.pageName,
        pageType: data.pageType,
        siteDomain: siteData?.domain || '',
        primaryKeyword: '',
      })
      const existing = new Set(data.keywords.map(k => k.keyword.toLowerCase()))
      const newKws = (result.keywords || [])
        .filter(k => !existing.has(k.keyword.toLowerCase()))
        .map(k => ({ ...k, id: Date.now() + Math.random(), source: 'ai' }))
      update({ keywords: [...data.keywords, ...newKws] })
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  // GKP CSV import
  const parseGKP = (text) => {
    const sep = text.includes('\t') ? '\t' : (text.includes(';') ? ';' : ',')
    const lines = text.replace(/^\uFEFF/, '').split('\n').map(l => l.trimEnd()).filter(Boolean)
    let hIdx = lines.findIndex(l => /^keyword$/i.test(l.split(sep)[0].replace(/"/g, '').trim()))
    if (hIdx === -1) hIdx = lines.findIndex(l => /keyword/i.test(l))
    if (hIdx === -1) return
    const headers = lines[hIdx].split(sep).map(h => h.replace(/"/g, '').trim().toLowerCase())
    const kwCol   = headers.findIndex(h => /^keyword$/i.test(h))
    const volCol  = headers.findIndex(h => /avg.*month|searches|volume/i.test(h))
    const compCol = headers.findIndex(h => /^competition$/i.test(h))
    const parsed = []
    for (let i = hIdx + 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.replace(/"/g, '').trim())
      const kw = cols[kwCol]
      if (!kw || kw.length < 2) continue
      let vol = null
      if (volCol !== -1 && cols[volCol]) { const n = parseFloat(cols[volCol].replace(/,/g,'')); if (!isNaN(n) && n > 0) vol = Math.round(n) }
      const comp = compCol !== -1 ? cols[compCol] : ''
      const diff = /^high$/i.test(comp) ? 'mare' : /^low$/i.test(comp) ? 'mica' : 'medie'
      parsed.push({ id: Date.now() + Math.random(), keyword: kw, monthly_volume: vol, difficulty: diff, keyword_type: 'secondary', source: 'gkp' })
    }
    const existing = new Set(data.keywords.map(k => k.keyword.toLowerCase()))
    const fresh = parsed.filter(p => !existing.has(p.keyword.toLowerCase()))
    update({ keywords: [...data.keywords, ...fresh] })
    setImportText(''); setShowImport(false)
  }

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const buf = ev.target.result; const bytes = new Uint8Array(buf)
      let text = bytes[0] === 0xFF && bytes[1] === 0xFE ? new TextDecoder('utf-16le').decode(buf) : new TextDecoder('utf-8').decode(buf)
      parseGKP(text)
    }
    reader.readAsArrayBuffer(file)
  }

  const sorted = [...data.keywords].sort((a, b) => (b.monthly_volume || 0) - (a.monthly_volume || 0))

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-gray-900">Adaugă cuvinte cheie</h2>
        <AiBadge loading={aiLoading} error={aiError} />
      </div>
      <p className="text-gray-500 mb-6">
        Colectează keywords cu volume de căutare. Cu cât mai multe date, cu atât mai bine vom putea alege keyword-ul principal.
      </p>

      {/* Acțiuni */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={aiSuggest} disabled={aiLoading || !data.pageName}
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-40">
          <Sparkles className="w-4 h-4" />
          {aiLoading ? 'Generez...' : 'Sugestii Claude AI'}
        </button>
        <button onClick={() => setShowImport(s => !s)}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
          <Upload className="w-4 h-4" />
          Import Google KP
        </button>
        <a href="https://ads.google.com/home/tools/keyword-planner/" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
          <ExternalLink className="w-4 h-4" />
          Deschide GKP
        </a>
      </div>

      {/* Import GKP */}
      {showImport && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <p className="text-xs text-blue-700 font-medium mb-2">Lipește CSV din Google Keyword Planner sau încarcă fișier</p>
          <textarea rows={4} value={importText} onChange={e => setImportText(e.target.value)}
            placeholder="Keyword	Avg. monthly searches	Competition&#10;husa pat impermeabila	720	High&#10;..."
            className="w-full border border-blue-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-2" />
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-300 rounded-lg text-xs text-blue-700 cursor-pointer hover:bg-blue-100">
              <Upload className="w-3 h-3" /> Fișier CSV
              <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
            </label>
            <button onClick={() => parseGKP(importText)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">Importă</button>
            <button onClick={() => setShowImport(false)} className="px-3 py-1.5 text-gray-500 text-xs hover:text-gray-700">Anulează</button>
          </div>
        </div>
      )}

      {/* Add manual */}
      <div className="flex gap-2 mb-4">
        <input type="text" value={newKw.keyword} onChange={e => setNewKw(f => ({ ...f, keyword: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && addKeyword()}
          placeholder="Keyword (Enter pentru a adăuga)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <input type="number" value={newKw.monthly_volume} onChange={e => setNewKw(f => ({ ...f, monthly_volume: e.target.value }))}
          placeholder="Volum/lună"
          className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <select value={newKw.difficulty} onChange={e => setNewKw(f => ({ ...f, difficulty: e.target.value }))}
          className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="mica">Mică</option>
          <option value="medie">Medie</option>
          <option value="mare">Mare</option>
        </select>
        <button onClick={addKeyword} className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">
          <Plus className="w-4 h-4" /> Adaugă
        </button>
      </div>

      {/* Keywords table */}
      {sorted.length > 0 ? (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">{sorted.length} keywords colectate</span>
            <span className="text-xs text-gray-400">Volum total: {sorted.reduce((s,k) => s+(k.monthly_volume||0),0).toLocaleString()}/lună</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {sorted.map(kw => (
              <div key={kw.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900">{kw.keyword}</span>
                  {kw.source === 'ai' && <span className="ml-1.5 text-xs text-purple-500">AI</span>}
                  {kw.source === 'gkp' && <span className="ml-1.5 text-xs text-blue-500">GKP</span>}
                </div>
                <span className="text-sm text-gray-500 w-20 text-right">{kw.monthly_volume ? kw.monthly_volume.toLocaleString() : '—'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  kw.difficulty === 'mica' ? 'bg-green-100 text-green-700' :
                  kw.difficulty === 'mare' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>{kw.difficulty}</span>
                <button onClick={() => removeKw(kw.id)} className="text-gray-300 hover:text-red-500 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
          <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Niciun keyword adăugat. Folosește Claude AI sau adaugă manual.</p>
        </div>
      )}
    </div>
  )
}

// ─── PASUL 3: Selectare keyword principal ─────────────────
function Step3({ data, update }) {
  const sorted = [...data.keywords].sort((a, b) => (b.monthly_volume || 0) - (a.monthly_volume || 0))

  const wordCount = (kw) => kw.trim().split(/\s+/).length

  const getRecommendation = (kw) => {
    const wc = wordCount(kw.keyword)
    const vol = kw.monthly_volume || 0
    if (wc < 2) return { type: 'warning', msg: 'Prea generic — 1 cuvânt' }
    if (wc > 5) return { type: 'info', msg: 'Long-tail — mai bun ca secundar' }
    if (vol >= 500) return { type: 'success', msg: `Volum excelent: ${vol.toLocaleString()}/lună` }
    if (vol >= 100) return { type: 'success', msg: `Volum bun: ${vol.toLocaleString()}/lună` }
    if (vol > 0)    return { type: 'warning', msg: `Volum mic: ${vol}/lună` }
    return { type: 'neutral', msg: 'Volum necunoscut' }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Selectează keyword-ul principal</h2>
      <p className="text-gray-500 mb-2">
        Keyword-ul principal definește întreaga strategie SEO a paginii. Alege unul cu:
      </p>
      <ul className="text-sm text-gray-500 mb-6 space-y-1">
        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" />2-4 cuvinte (nu prea generic, nu prea specific)</li>
        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" />Volum minim 100+/lună recomandat</li>
        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" />Relevant maxim pentru pagina ta</li>
      </ul>

      <div className="space-y-2">
        {sorted.map(kw => {
          const rec = getRecommendation(kw)
          const selected = data.primaryKeyword === kw.keyword
          return (
            <button key={kw.id} onClick={() => update({ primaryKeyword: kw.keyword, primaryKwVolume: kw.monthly_volume })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}>
              <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                selected ? 'border-primary-600 bg-primary-600' : 'border-gray-300'
              }`}>
                {selected && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`font-medium text-sm ${selected ? 'text-primary-900' : 'text-gray-900'}`}>
                  {kw.keyword}
                </span>
              </div>
              <span className="text-sm text-gray-500 w-24 text-right shrink-0">
                {kw.monthly_volume ? kw.monthly_volume.toLocaleString() + '/lună' : '—'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                rec.type === 'success' ? 'bg-green-100 text-green-700' :
                rec.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                rec.type === 'info'    ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-500'
              }`}>{rec.msg}</span>
            </button>
          )
        })}
      </div>

      {data.primaryKeyword && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-800">
            Keyword principal selectat: <strong>{data.primaryKeyword}</strong>
            {data.primaryKwVolume ? ` — ${data.primaryKwVolume.toLocaleString()} căutări/lună` : ''}
          </span>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
        <strong>Sau introdu manual:</strong>
        <div className="mt-2 flex gap-2">
          <input type="text" value={data.primaryKeyword}
            onChange={e => update({ primaryKeyword: e.target.value })}
            placeholder="Keyword principal..."
            className="flex-1 border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white" />
        </div>
      </div>
    </div>
  )
}

// ─── PASUL 4: Intenție de căutare & SERP ──────────────────
function Step4({ data, update }) {
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(data.primaryKeyword)}&gl=ro&hl=ro`
  const serpFields = data.serpResults.length > 0 ? data.serpResults : [
    { pos: 1, url: '', type: '' },
    { pos: 2, url: '', type: '' },
    { pos: 3, url: '', type: '' },
  ]

  const updateSerp = (pos, field, val) => {
    const updated = serpFields.map(r => r.pos === pos ? { ...r, [field]: val } : r)
    update({ serpResults: updated })
  }

  const RESULT_TYPES = ['produs', 'categorie', 'blog', 'homepage', 'marketplace', 'altul']

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Intenție de căutare & Analiza SERP</h2>
      <p className="text-gray-500 mb-6">
        Verifică ce apare pe Google pentru keyword-ul tău. Dacă top 10 sunt toate produse și tu ai o pagină de categorie, vei lupta împotriva curentului.
      </p>

      {/* Google search link */}
      <div className="bg-gray-900 rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">Caută pe Google</p>
          <p className="text-white font-mono text-sm">{data.primaryKeyword}</p>
        </div>
        <a href={googleUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <ExternalLink className="w-4 h-4" />
          Deschide Google →
        </a>
      </div>

      {/* Tip intenție */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Ce tip de rezultate apar predominant pe Google?</p>
        <div className="grid grid-cols-2 gap-2">
          {INTENT_TYPES.map(it => {
            const selected = data.searchIntent === it.value
            return (
              <button key={it.value} onClick={() => update({ searchIntent: it.value })}
                className={`flex items-start gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                  selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <span className="text-lg">{it.icon}</span>
                <div>
                  <p className={`text-sm font-semibold ${selected ? 'text-primary-900' : 'text-gray-700'}`}>{it.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{it.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Analiza top 3 */}
      {data.searchIntent && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">
            Notează primele 3 rezultate din Google <span className="text-gray-400 font-normal">(opțional dar util)</span>
          </p>
          <div className="space-y-2">
            {serpFields.map(r => (
              <div key={r.pos} className="flex items-center gap-2">
                <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-600 shrink-0">
                  {r.pos}
                </span>
                <input type="text" value={r.url} onChange={e => updateSerp(r.pos, 'url', e.target.value)}
                  placeholder={`URL sau titlu rezultat #${r.pos}`}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <select value={r.type} onChange={e => updateSerp(r.pos, 'type', e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Tip...</option>
                  {RESULT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning dacă tipul nu se potrivește */}
      {data.searchIntent && data.pageType && (
        (() => {
          const mismatch =
            (data.searchIntent === 'transactional' && data.pageType === 'blog') ||
            (data.searchIntent === 'informational' && data.pageType === 'produs')
          if (!mismatch) return null
          return (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                <strong>Atenție:</strong> Intenția de căutare ({data.searchIntent}) nu se potrivește cu tipul paginii tale ({data.pageType}).
                Ai putea să nu te clasezi bine. Consideră să schimbi tipul paginii sau keyword-ul principal.
              </p>
            </div>
          )
        })()
      )}
    </div>
  )
}

// ─── PASUL 5: Clasificare keywords ────────────────────────
function Step5({ data, update }) {
  const others = data.keywords.filter(k => k.keyword !== data.primaryKeyword)

  const setType = (id, type) => {
    const updated = data.keywords.map(k => k.id === id ? { ...k, keyword_type: type } : k)
    update({ keywords: updated })
  }

  const secondary = others.filter(k => k.keyword_type === 'secondary')
  const longtail  = others.filter(k => k.keyword_type === 'long_tail')
  const ignored   = others.filter(k => k.keyword_type === 'ignore')

  // Auto-suggest: daca are 4+ cuvinte → long_tail
  const autoClassify = () => {
    const updated = data.keywords.map(k => {
      if (k.keyword === data.primaryKeyword) return k
      const wc = k.keyword.trim().split(/\s+/).length
      return { ...k, keyword_type: wc >= 4 ? 'long_tail' : 'secondary' }
    })
    update({ keywords: updated })
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Clasifică keywords</h2>
      <p className="text-gray-500 mb-2">
        Keyword-ul principal este setat. Acum clasifică restul ca: <strong>secundar</strong> (volum bun, 2-3 cuvinte) sau <strong>long-tail</strong> (expresii lungi, 4+ cuvinte).
      </p>

      <div className="flex gap-3 mb-4 text-sm">
        <span className="flex items-center gap-1.5 px-3 py-1 bg-primary-50 text-primary-700 rounded-full font-medium">
          <Target className="w-3.5 h-3.5" /> Principal: {data.primaryKeyword}
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 rounded-full">
          Secundare: {secondary.length}
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-full">
          Long-tail: {longtail.length}
        </span>
      </div>

      <button onClick={autoClassify}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 mb-4">
        <Zap className="w-3.5 h-3.5" /> Auto-clasificare (4+ cuvinte = long-tail)
      </button>

      <div className="space-y-2">
        {others.map(kw => (
          <div key={kw.id} className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-900">{kw.keyword}</span>
              {kw.monthly_volume && <span className="ml-2 text-xs text-gray-400">{kw.monthly_volume.toLocaleString()}/lună</span>}
            </div>
            <div className="flex gap-1">
              {[
                { val: 'secondary', label: 'Secundar',  cls: 'bg-purple-100 text-purple-700 border-purple-300' },
                { val: 'long_tail', label: 'Long-tail', cls: 'bg-green-100 text-green-700 border-green-300' },
                { val: 'ignore',    label: 'Ignoră',    cls: 'bg-gray-100 text-gray-500 border-gray-300' },
              ].map(opt => (
                <button key={opt.val} onClick={() => setType(kw.id, opt.val)}
                  className={`px-2 py-1 text-xs rounded-lg border transition-all ${
                    kw.keyword_type === opt.val ? opt.cls + ' font-semibold' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {secondary.length < 3 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          Recomandat minim 3 keywords secundare. Ai {secondary.length}. Mergi la Pasul 2 să mai adaugi sau schimbă clasificarea.
        </div>
      )}
    </div>
  )
}

// ─── PASUL 6: Generare AI ─────────────────────────────────
function Step6({ data, update, siteData }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [generated, setGenerated] = useState(data.aiGenerated || null)
  const [editing, setEditing] = useState({})

  const hasApiKey = !!import.meta.env.VITE_ANTHROPIC_API_KEY

  const generate = async () => {
    setLoading(true); setError(null)
    try {
      const kwList = data.keywords.filter(k => k.keyword !== data.primaryKeyword && k.keyword_type !== 'ignore').map(k => k.keyword)
      const result = await generateSeoRecipe({
        pageName:        data.pageName,
        pageType:        data.pageType,
        siteDomain:      siteData?.domain || '',
        primaryKeyword:  data.primaryKeyword,
        existingKeywords: kwList,
      })
      const gen = {
        titles:       [result.title_tag, result.title_tag?.replace(/ \| .*/, ''), result.title_tag?.split(' | ').reverse().join(' | ')].filter(Boolean),
        metaDescs:    [result.meta_description],
        h1s:          [result.h1],
        urlSlug:      result.url_slug || toSlug(data.primaryKeyword),
        headings:     result.structura_descriere || [],
        brief:        result.sfat_strategic || '',
        selectedTitle:    result.title_tag || '',
        selectedMetaDesc: result.meta_description || '',
        selectedH1:       result.h1 || '',
      }
      setGenerated(gen)
      update({ aiGenerated: gen, selectedTitle: gen.selectedTitle, selectedMetaDesc: gen.selectedMetaDesc, selectedH1: gen.selectedH1, urlSlug: gen.urlSlug })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const pick = (field, val) => {
    const upd = { ...generated, [field]: val }
    setGenerated(upd)
    update({ aiGenerated: upd, [field.replace('selected','')]: val,
      ...(field === 'selectedTitle'    ? { selectedTitle: val }    : {}),
      ...(field === 'selectedMetaDesc' ? { selectedMetaDesc: val } : {}),
      ...(field === 'selectedH1'       ? { selectedH1: val }       : {}),
    })
  }

  const titleLen   = (data.selectedTitle    || generated?.selectedTitle    || '').length
  const metaLen    = (data.selectedMetaDesc || generated?.selectedMetaDesc || '').length

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-gray-900">Generare conținut SEO</h2>
        <AiBadge loading={loading} error={error} />
      </div>
      <p className="text-gray-500 mb-6">
        Claude generează title tag, meta description, H1, URL slug și structura paginii bazate pe research-ul tău.
      </p>

      {!hasApiKey && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <strong>VITE_ANTHROPIC_API_KEY lipsă.</strong> Completează manual câmpurile de mai jos sau adaugă cheia API în <code>.env</code> pentru asistență AI.
          </div>
        </div>
      )}

      {!generated ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <Sparkles className="w-12 h-12 text-purple-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Claude va genera opțiuni pentru title, meta, H1 și structura conținutului.</p>
          {hasApiKey ? (
            <button onClick={generate} disabled={loading}
              className="px-6 py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-40">
              {loading ? <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Generez...</span> : '✨ Generează cu Claude AI'}
            </button>
          ) : (
            <button onClick={() => setGenerated({ titles: [], metaDescs: [], h1s: [], urlSlug: toSlug(data.primaryKeyword), headings: [], selectedTitle: '', selectedMetaDesc: '', selectedH1: '' })}
              className="px-6 py-2.5 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700">
              Completează manual
            </button>
          )}
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Title */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Title Tag</span>
              <span className={`text-xs font-medium ${titleLen > 60 ? 'text-red-600' : titleLen > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                {titleLen}/60 caractere
              </span>
            </div>
            <div className="p-4 space-y-2">
              {(generated.titles || []).map((t, i) => (
                <button key={i} onClick={() => { pick('selectedTitle', t); update({ selectedTitle: t }) }}
                  className={`w-full text-left p-3 rounded-lg border-2 text-sm transition-all ${
                    (data.selectedTitle || generated.selectedTitle) === t ? 'border-primary-500 bg-primary-50 font-medium' : 'border-gray-100 hover:border-gray-300'
                  }`}>{t}</button>
              ))}
              <div className="pt-2">
                <input type="text" value={data.selectedTitle || generated.selectedTitle || ''}
                  onChange={e => { pick('selectedTitle', e.target.value); update({ selectedTitle: e.target.value }) }}
                  placeholder="Sau scrie propriul tău title tag..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
          </div>

          {/* Meta description */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Meta Description</span>
              <span className={`text-xs font-medium ${metaLen > 155 ? 'text-red-600' : metaLen > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                {metaLen}/155 caractere
              </span>
            </div>
            <div className="p-4 space-y-2">
              {(generated.metaDescs || []).map((m, i) => (
                <button key={i} onClick={() => { pick('selectedMetaDesc', m); update({ selectedMetaDesc: m }) }}
                  className={`w-full text-left p-3 rounded-lg border-2 text-sm transition-all ${
                    (data.selectedMetaDesc || generated.selectedMetaDesc) === m ? 'border-primary-500 bg-primary-50 font-medium' : 'border-gray-100 hover:border-gray-300'
                  }`}>{m}</button>
              ))}
              <textarea rows={3} value={data.selectedMetaDesc || generated.selectedMetaDesc || ''}
                onChange={e => { pick('selectedMetaDesc', e.target.value); update({ selectedMetaDesc: e.target.value }) }}
                placeholder="Sau scrie propria ta meta description..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
            </div>
          </div>

          {/* H1 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-700">H1 (Titlu principal pagină)</span>
            </div>
            <div className="p-4 space-y-2">
              {(generated.h1s || []).map((h, i) => (
                <button key={i} onClick={() => { pick('selectedH1', h); update({ selectedH1: h }) }}
                  className={`w-full text-left p-3 rounded-lg border-2 text-sm transition-all ${
                    (data.selectedH1 || generated.selectedH1) === h ? 'border-primary-500 bg-primary-50 font-medium' : 'border-gray-100 hover:border-gray-300'
                  }`}>{h}</button>
              ))}
              <input type="text" value={data.selectedH1 || generated.selectedH1 || ''}
                onChange={e => { pick('selectedH1', e.target.value); update({ selectedH1: e.target.value }) }}
                placeholder="Sau scrie propriul tău H1..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          {/* URL slug */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-700">URL Slug</span>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">/</span>
                <input type="text" value={data.urlSlug || generated.urlSlug || ''}
                  onChange={e => update({ urlSlug: toSlug(e.target.value) })}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
          </div>

          {/* Structura conținut */}
          {generated.headings?.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-700">Structura conținutului (H2-uri recomandate)</span>
              </div>
              <div className="p-4">
                <ul className="space-y-1.5">
                  {generated.headings.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded mt-0.5 shrink-0">H2</span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Regenerate */}
          {hasApiKey && (
            <button onClick={generate} disabled={loading}
              className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Regenerează cu Claude
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── PASUL 7: Validare & Creare ────────────────────────────
function Step7({ data, siteId, siteData, onCreated }) {
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState(null)

  const title    = data.selectedTitle    || ''
  const metaDesc = data.selectedMetaDesc || ''
  const h1       = data.selectedH1       || ''
  const slug     = data.urlSlug          || toSlug(data.pageName)

  const checks = [
    { label: 'Tip pagină',          ok: !!data.pageType,                   val: data.pageType },
    { label: 'Nume pagină',         ok: !!data.pageName,                   val: data.pageName },
    { label: 'Keyword principal',   ok: !!data.primaryKeyword,             val: data.primaryKeyword },
    { label: 'Intenție de căutare', ok: !!data.searchIntent,               val: data.searchIntent || 'nesetat' },
    { label: 'Title tag (≤60 car.)', ok: title.length > 0 && title.length <= 60, val: `${title.length} caractere` },
    { label: 'Meta description (≤155 car.)', ok: metaDesc.length > 0 && metaDesc.length <= 155, val: `${metaDesc.length} caractere` },
    { label: 'H1',                  ok: !!h1,                              val: h1 ? h1.substring(0, 40) + (h1.length > 40 ? '...' : '') : 'lipsă' },
    { label: 'URL slug',            ok: /^[a-z0-9-]+$/.test(slug),         val: '/' + slug },
    { label: 'Keywords secundare (≥3)', ok: data.keywords.filter(k => k.keyword_type === 'secondary').length >= 3, val: data.keywords.filter(k => k.keyword_type === 'secondary').length + ' secundare' },
    { label: 'Long-tail (≥2)',      ok: data.keywords.filter(k => k.keyword_type === 'long_tail').length >= 2,    val: data.keywords.filter(k => k.keyword_type === 'long_tail').length + ' long-tail' },
  ]

  const score = Math.round((checks.filter(c => c.ok).length / checks.length) * 100)

  const handleCreate = async () => {
    setCreating(true); setError(null)
    try {
      // 1. Creează pagina
      const { data: page, error: pageErr } = await supabase.from('seo_pages').insert({
        site_id:          siteId,
        name:             data.pageName,
        url_slug:         slug,
        page_type:        data.pageType,
        primary_keyword:  data.primaryKeyword,
        meta_title:       title,
        meta_description: metaDesc,
        status:           'in_progress',
      }).select().single()
      if (pageErr) throw pageErr

      // 2. Inserează keywords (non-ignored)
      const kws = data.keywords.filter(k => k.keyword_type !== 'ignore').map(k => ({
        page_id:        page.id,
        keyword:        k.keyword,
        monthly_volume: k.monthly_volume,
        keyword_type:   k.keyword === data.primaryKeyword ? 'primary' : k.keyword_type,
        difficulty:     k.difficulty,
      }))
      if (kws.length > 0) {
        const { error: kwErr } = await supabase.from('seo_keywords').insert(kws)
        if (kwErr) console.warn('Keywords insert error:', kwErr)
      }

      onCreated(page.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Validare & Creare pagină</h2>
      <p className="text-gray-500 mb-6">Verificăm tot ce ai setat înainte de a crea pagina SEO.</p>

      {/* SEO Score */}
      <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl mb-6">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${
          score >= 80 ? 'bg-green-100 text-green-700' :
          score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
        }`}>{score}%</div>
        <div>
          <p className="font-semibold text-gray-900">
            {score >= 80 ? '🎉 Pagina este bine pregătită!' : score >= 60 ? '⚠️ Există câteva puncte de îmbunătățit' : '❌ Mai sunt elemente lipsă'}
          </p>
          <p className="text-sm text-gray-500">{checks.filter(c => c.ok).length}/{checks.length} verificări trecute</p>
        </div>
      </div>

      {/* Checklist validare */}
      <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
        {checks.map((c, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i < checks.length - 1 ? 'border-b border-gray-100' : ''} ${c.ok ? 'bg-white' : 'bg-red-50'}`}>
            {c.ok ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
            <span className="text-sm text-gray-700 flex-1">{c.label}</span>
            <span className={`text-xs font-mono ${c.ok ? 'text-gray-400' : 'text-red-500'}`}>{c.val}</span>
          </div>
        ))}
      </div>

      {/* Preview */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Preview SERP</p>
        <div className="space-y-0.5">
          <p className="text-lg text-blue-700 hover:underline cursor-pointer leading-snug">{title || 'Titlu nesetat'}</p>
          <p className="text-xs text-green-700">{siteData?.domain || 'yoursite.ro'}/{slug}</p>
          <p className="text-sm text-gray-600 leading-relaxed">{metaDesc || 'Meta description nesetată...'}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <button onClick={handleCreate} disabled={creating || score < 40}
        className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-40 text-sm flex items-center justify-center gap-2">
        {creating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Se creează...</> : <><Check className="w-4 h-4" /> Creează pagina SEO</>}
      </button>
      {score < 40 && <p className="text-xs text-center text-gray-400 mt-2">Completează mai multe câmpuri pentru a putea crea pagina</p>}
    </div>
  )
}

// ─── Main wizard ───────────────────────────────────────────
export default function SeoWizard() {
  const { siteId } = useParams()
  const navigate   = useNavigate()
  const [step, setStep] = useState(1)
  const [wizardData, setWizardData] = useState({
    pageType: '', pageName: '', description: '', urlSlug: '',
    keywords: [],
    primaryKeyword: '', primaryKwVolume: null,
    searchIntent: '', serpResults: [],
    aiGenerated: null,
    selectedTitle: '', selectedMetaDesc: '', selectedH1: '',
  })

  const update = useCallback((fields) => setWizardData(d => ({ ...d, ...fields })), [])

  const { data: site } = useQuery({
    queryKey: ['seo-site', siteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('seo_sites').select('*').eq('id', siteId).single()
      if (error) throw error
      return data
    },
  })

  const canNext = () => {
    if (step === 1) return !!wizardData.pageType && !!wizardData.pageName.trim()
    if (step === 2) return wizardData.keywords.length >= 1
    if (step === 3) return !!wizardData.primaryKeyword
    if (step === 4) return !!wizardData.searchIntent
    if (step === 5) return true
    if (step === 6) return !!(wizardData.selectedTitle || wizardData.aiGenerated)
    return true
  }

  const next = () => { if (step < 7) setStep(s => s + 1) }
  const back = () => { if (step > 1) setStep(s => s - 1); else navigate(`/seo/${siteId}`) }

  const onCreated = (pageId) => navigate(`/seo/${siteId}/pages/${pageId}`)

  return (
    <div className="max-w-3xl mx-auto">
      <WizardHeader step={step} siteData={site} pageName={wizardData.pageName} />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 min-h-96">
        {step === 1 && <Step1 data={wizardData} update={update} />}
        {step === 2 && <Step2 data={wizardData} update={update} siteData={site} />}
        {step === 3 && <Step3 data={wizardData} update={update} />}
        {step === 4 && <Step4 data={wizardData} update={update} />}
        {step === 5 && <Step5 data={wizardData} update={update} />}
        {step === 6 && <Step6 data={wizardData} update={update} siteData={site} />}
        {step === 7 && <Step7 data={wizardData} siteId={siteId} siteData={site} onCreated={onCreated} />}

        {step < 7 && (
          <WizardNav
            step={step}
            onBack={back}
            onNext={next}
            nextDisabled={!canNext()}
            nextLabel={step === 6 ? 'Validare →' : step === 5 ? 'Generare AI →' : undefined}
          />
        )}
        {step === 7 && (
          <div className="flex mt-8 pt-6 border-t border-gray-100">
            <button onClick={back} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" /> Înapoi
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
