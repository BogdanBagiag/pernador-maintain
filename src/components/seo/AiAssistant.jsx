// src/components/seo/AiAssistant.jsx
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Sparkles,
  Zap,
  Tag,
  CheckSquare,
  MessageSquare,
  Send,
  Loader,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Copy,
  RefreshCw,
} from 'lucide-react'
import {
  generateSeoRecipe,
  suggestKeywords,
  checkMeta,
  chatWithContext,
} from '../../utils/claudeApi'

// ─── Secțiune colapsabilă ────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = false, badge }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary-600" />
          <span className="font-medium text-sm text-gray-900">{title}</span>
          {badge && (
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}

// ─── Rețetă SEO ──────────────────────────────────────────
function RecipeGenerator({ page, site, onApply }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)
  const [applied, setApplied] = useState({})

  const generate = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setApplied({})
    try {
      const keywords = page.seo_keywords?.map(k => k.keyword) || []
      const recipe = await generateSeoRecipe({
        pageName:         page.name,
        pageType:         page.page_type,
        siteDomain:       site.domain,
        platform:         site.platform,
        existingKeywords: keywords,
      })
      setResult(recipe)

      // Salvează în seo_ai_suggestions
      await supabase.from('seo_ai_suggestions').insert({
        page_id:         page.id,
        suggestion_type: 'recipe',
        result:          recipe,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const applyField = async (field, value) => {
    await onApply(field, value)
    setApplied(a => ({ ...a, [field]: true }))
  }

  const ApplyBtn = ({ field, value }) => (
    <button
      onClick={() => applyField(field, value)}
      disabled={applied[field]}
      className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
        applied[field]
          ? 'bg-green-100 text-green-700 cursor-default'
          : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
      }`}
    >
      {applied[field] ? <><Check className="w-3 h-3 inline mr-1" />Aplicat</> : 'Aplică'}
    </button>
  )

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Claude generează o rețetă SEO completă: title tag, meta description, H1, keywords recomandate și structura descrierii.
      </p>
      <button
        onClick={generate}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
      >
        {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? 'Generez rețeta SEO...' : 'Generează rețetă SEO completă'}
      </button>

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          {/* Cuvânt principal */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Cuvânt cheie principal</span>
              <ApplyBtn field="primary_keyword" value={result.cuvant_principal} />
            </div>
            <p className="text-sm font-medium text-gray-900">{result.cuvant_principal}</p>
            <p className="text-xs text-gray-500 mt-1">{result.motiv_cuvant}</p>
          </div>

          {/* Title tag */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                Title tag
                <span className={`ml-2 font-normal ${result.title_tag?.length > 60 ? 'text-red-500' : 'text-gray-400'}`}>
                  ({result.title_tag?.length || 0}/60 caractere)
                </span>
              </span>
              <ApplyBtn field="title_tag" value={result.title_tag} />
            </div>
            <p className="text-sm text-gray-900">{result.title_tag}</p>
          </div>

          {/* Meta description */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                Meta description
                <span className={`ml-2 font-normal ${result.meta_description?.length > 155 ? 'text-red-500' : 'text-gray-400'}`}>
                  ({result.meta_description?.length || 0}/155 caractere)
                </span>
              </span>
              <ApplyBtn field="meta_description" value={result.meta_description} />
            </div>
            <p className="text-sm text-gray-900">{result.meta_description}</p>
          </div>

          {/* H1 */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">H1</span>
              <ApplyBtn field="h1" value={result.h1} />
            </div>
            <p className="text-sm text-gray-900">{result.h1}</p>
          </div>

          {/* URL slug */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">URL Slug</span>
              <ApplyBtn field="url_slug" value={result.url_slug} />
            </div>
            <p className="text-sm font-mono text-gray-700">/{result.url_slug}</p>
          </div>

          {/* Keywords secundare */}
          {result.cuvinte_secundare?.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Keywords secundare</p>
              <div className="flex flex-wrap gap-1">
                {result.cuvinte_secundare.map((kw, i) => (
                  <span key={i} className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Long tail */}
          {result.long_tail?.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Expresii long-tail</p>
              <div className="flex flex-wrap gap-1">
                {result.long_tail.map((kw, i) => (
                  <span key={i} className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Structura descriere */}
          {result.structura_descriere?.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Structura descriere recomandata</p>
              <ol className="space-y-1">
                {result.structura_descriere.map((s, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-2">
                    <span className="font-bold text-primary-600 shrink-0">{i + 1}.</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Sfat strategic */}
          {result.sfat_strategic && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-1">💡 Sfat strategic</p>
              <p className="text-sm text-gray-700">{result.sfat_strategic}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sugestii keywords ────────────────────────────────────
function KeywordSuggester({ page, site, onAddKeywords }) {
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)
  const [selected, setSelected]   = useState(new Set())
  const [adding, setAdding]       = useState(false)

  const suggest = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setSelected(new Set())
    try {
      const data = await suggestKeywords({
        pageName:       page.name,
        pageType:       page.page_type,
        siteDomain:     site.domain,
        primaryKeyword: page.primary_keyword,
      })
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (idx) => {
    setSelected(s => {
      const n = new Set(s)
      n.has(idx) ? n.delete(idx) : n.add(idx)
      return n
    })
  }

  const addSelected = async () => {
    if (selected.size === 0) return
    setAdding(true)
    try {
      const keywords = [...selected].map(idx => ({
        page_id:        page.id,
        keyword:        result.keywords[idx].keyword,
        monthly_volume: result.keywords[idx].monthly_volume,
        keyword_type:   result.keywords[idx].keyword_type,
        difficulty:     result.keywords[idx].difficulty,
        notes:          result.keywords[idx].notes,
      }))
      await supabase.from('seo_keywords').insert(keywords)
      onAddKeywords()
      setSelected(new Set())
      setResult(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const diffColor = (d) => ({
    mica:  'bg-green-100 text-green-700',
    medie: 'bg-yellow-100 text-yellow-700',
    mare:  'bg-red-100 text-red-700',
  }[d] || 'bg-gray-100 text-gray-700')

  const typeColor = (t) => ({
    primary:   'bg-blue-100 text-blue-700',
    secondary: 'bg-purple-100 text-purple-700',
    long_tail: 'bg-green-100 text-green-700',
  }[t] || 'bg-gray-100 text-gray-700')

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Claude sugerează 12-15 keywords relevante cu volum estimat și dificultate. Bifează ce vrei să adaugi.
      </p>
      <button onClick={suggest} disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50">
        {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
        {loading ? 'Analizez...' : 'Sugerează keywords'}
      </button>

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">{error}</div>
      )}

      {result?.keywords?.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600">{result.keywords.length} sugestii — bifează ce adaugi:</p>
            <button onClick={() => setSelected(new Set(result.keywords.map((_, i) => i)))}
              className="text-xs text-primary-600 hover:underline">
              Selectează tot
            </button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {result.keywords.map((kw, i) => (
              <label key={i} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                selected.has(i) ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
              }`}>
                <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)}
                  className="mt-0.5 accent-primary-600" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{kw.keyword}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${typeColor(kw.keyword_type)}`}>
                      {kw.keyword_type}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${diffColor(kw.difficulty)}`}>
                      {kw.difficulty}
                    </span>
                  </div>
                  {kw.monthly_volume && (
                    <p className="text-xs text-gray-500 mt-0.5">~{kw.monthly_volume.toLocaleString()} căutări/lună</p>
                  )}
                  {kw.notes && <p className="text-xs text-gray-400 mt-0.5">{kw.notes}</p>}
                </div>
              </label>
            ))}
          </div>

          {selected.size > 0 && (
            <button onClick={addSelected} disabled={adding}
              className="mt-3 w-full px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {adding ? 'Se adaugă...' : `Adaugă ${selected.size} keyword${selected.size > 1 ? '-uri' : ''} selectate`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Verificare meta ─────────────────────────────────────
function MetaChecker({ page, onApply }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)

  const check = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await checkMeta({
        pageName:        page.name,
        primaryKeyword:  page.primary_keyword,
        titleTag:        page.title_tag,
        metaDescription: page.meta_description,
        h1:              page.h1,
      })
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = (score) =>
    score >= 8 ? 'text-green-600' : score >= 5 ? 'text-yellow-600' : 'text-red-600'
  const scoreBg = (score) =>
    score >= 8 ? 'bg-green-50 border-green-200' : score >= 5 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Claude analizează title tag, meta description și H1 și oferă feedback specific cu variante îmbunătățite.
      </p>
      <button onClick={check} disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50">
        {loading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
        {loading ? 'Analizez meta tags...' : 'Verifică meta tags'}
      </button>

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">{error}</div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          {[
            { key: 'title', label: 'Title Tag', score: result.title_score, issues: result.title_issues, suggestion: result.title_suggestion, field: 'title_tag' },
            { key: 'meta',  label: 'Meta Description', score: result.meta_score,  issues: result.meta_issues,  suggestion: result.meta_suggestion,  field: 'meta_description' },
            { key: 'h1',    label: 'H1', score: result.h1_score,    issues: result.h1_issues,    suggestion: result.h1_suggestion,    field: 'h1' },
          ].map(item => (
            <div key={item.key} className={`border rounded-lg p-3 ${scoreBg(item.score)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                <span className={`text-lg font-bold ${scoreColor(item.score)}`}>{item.score}/10</span>
              </div>
              {item.issues?.length > 0 && (
                <ul className="text-xs text-gray-600 space-y-0.5 mb-2">
                  {item.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-red-500 mt-0.5">•</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
              {item.suggestion && (
                <div className="bg-white border border-gray-200 rounded p-2 flex items-start justify-between gap-2">
                  <p className="text-xs text-gray-700 flex-1">{item.suggestion}</p>
                  <button onClick={() => onApply(item.field, item.suggestion)}
                    className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded hover:bg-primary-200 shrink-0">
                    Aplică
                  </button>
                </div>
              )}
            </div>
          ))}

          {result.overall_verdict && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">📋 Concluzie</p>
              <p className="text-sm text-gray-700">{result.overall_verdict}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Chat liber ───────────────────────────────────────────
function FreeChat({ page, site }) {
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const question = input.trim()
    if (!question || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: question }])
    setLoading(true)

    try {
      const pageContext = {
        name:            page.name,
        page_type:       page.page_type,
        siteDomain:      site.domain,
        primary_keyword: page.primary_keyword,
        title_tag:       page.title_tag,
        meta_description: page.meta_description,
        status:          page.status,
      }

      const answer = await chatWithContext({
        pageContext,
        userQuestion: question,
        chatHistory: messages,
      })

      setMessages(m => [...m, { role: 'assistant', content: answer }])
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: `Eroare: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Chat cu context automat injectat — Claude știe pagina curentă, keyword-ul, meta tags.
      </p>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="h-64 overflow-y-auto p-3 space-y-3 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-xs text-gray-400 mt-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              Pune orice întrebare despre SEO pentru această pagină
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-800'
              }`}>
                {msg.content.split('\n').map((line, j) => (
                  <p key={j} className={j > 0 ? 'mt-1' : ''}>{line}</p>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                <Loader className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2 p-2 border-t border-gray-200 bg-white">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Întreabă ceva despre SEO pentru această pagină..."
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={loading}
          />
          <button onClick={send} disabled={loading || !input.trim()}
            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {messages.length > 0 && (
        <button onClick={() => setMessages([])}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" />
          Șterge conversația
        </button>
      )}
    </div>
  )
}

// ─── Componenta principală ────────────────────────────────
export default function AiAssistant({ page, site, onApply, onKeywordsAdded }) {
  const hasApiKey = !!import.meta.env.VITE_ANTHROPIC_API_KEY

  if (!hasApiKey) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900 mb-2">API Key Anthropic lipsă</h3>
        <p className="text-sm text-gray-600 mb-3">
          Adaugă <code className="bg-yellow-100 px-1 rounded">VITE_ANTHROPIC_API_KEY</code> în fișierul <code className="bg-yellow-100 px-1 rounded">.env</code> pentru a activa asistența AI.
        </p>
        <p className="text-xs text-gray-500">
          Obține cheia de pe <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">console.anthropic.com</a>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary-600" />
        <h3 className="font-semibold text-gray-900">Asistență Claude AI</h3>
        <span className="text-xs bg-gradient-to-r from-primary-100 to-purple-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
          Claude Sonnet
        </span>
      </div>

      <Section title="Generează rețetă SEO completă" icon={Zap} defaultOpen={true}>
        <RecipeGenerator page={page} site={site} onApply={onApply} />
      </Section>

      <Section title="Sugerează keywords" icon={Tag}>
        <KeywordSuggester page={page} site={site} onAddKeywords={onKeywordsAdded} />
      </Section>

      <Section title="Verifică meta tags" icon={CheckSquare}>
        <MetaChecker page={page} onApply={onApply} />
      </Section>

      <Section title="Chat SEO liber" icon={MessageSquare}>
        <FreeChat page={page} site={site} />
      </Section>
    </div>
  )
}
