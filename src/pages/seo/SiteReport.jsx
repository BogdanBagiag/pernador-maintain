// src/pages/seo/SiteReport.jsx
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  ArrowLeft,
  Globe,
  ExternalLink,
  FileText,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Tag,
  BarChart2,
  Copy,
  Check,
  ChevronRight,
  Download,
  Clock,
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import { TOTAL_CHECKLIST_ITEMS } from '../../constants/seoChecklist'

// ─── Culori pentru grafice ────────────────────────────────
const TYPE_COLORS = {
  produs:    '#6366f1',
  categorie: '#8b5cf6',
  blog:      '#22c55e',
  homepage:  '#f59e0b',
  altul:     '#94a3b8',
}

const STATUS_COLORS = {
  in_progress:  '#f59e0b',
  needs_review: '#ef4444',
  done:         '#22c55e',
}

const STATUS_LABELS = {
  in_progress:  'În lucru',
  needs_review: 'Necesită review',
  done:         'Finalizat',
}

// ─── Card statistică ──────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'blue', alert = false }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: 'text-blue-500' },
    green:  { bg: 'bg-green-50',  text: 'text-green-700',  icon: 'text-green-500' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: 'text-yellow-500' },
    red:    { bg: 'bg-red-50',    text: 'text-red-700',    icon: 'text-red-500' },
    gray:   { bg: 'bg-gray-50',   text: 'text-gray-700',   icon: 'text-gray-500' },
  }
  const c = colors[color]

  return (
    <div className={`border rounded-xl p-4 ${alert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold ${alert ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Rând pagină prioritizată ─────────────────────────────
function PriorityRow({ page, rank }) {
  const progress = page.checklistProgress || 0
  return (
    <Link
      to={`/seo/${page.site_id}/pages/${page.id}`}
      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group"
    >
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        rank <= 3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
      }`}>{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{page.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {page.primary_keyword ? (
            <span className="text-xs text-primary-600">{page.primary_keyword}</span>
          ) : (
            <span className="text-xs text-orange-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />lipsă keyword
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${
          progress >= 80 ? 'text-green-600' :
          progress >= 40 ? 'text-yellow-600' : 'text-red-500'
        }`}>{progress}%</p>
        <div className="w-16 bg-gray-100 rounded-full h-1 mt-1">
          <div className={`h-1 rounded-full ${
            progress >= 80 ? 'bg-green-500' :
            progress >= 40 ? 'bg-yellow-400' : 'bg-red-400'
          }`} style={{ width: `${progress}%` }} />
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" />
    </Link>
  )
}

// ─── Export pagină (copy-paste pentru WooCommerce/PrestaShop) ─
function ExportModal({ page, onClose }) {
  const [copied, setCopied] = useState(null)

  const fields = [
    { key: 'name',            label: 'Denumire pagină',    value: page.name },
    { key: 'primary_keyword', label: 'Cuvânt cheie principal', value: page.primary_keyword },
    { key: 'url_slug',        label: 'URL Slug',           value: page.url_slug },
    { key: 'title_tag',       label: 'Title Tag (SEO)',    value: page.title_tag },
    { key: 'meta_description',label: 'Meta Description',   value: page.meta_description },
    { key: 'h1',              label: 'H1',                 value: page.h1 },
  ]

  const copyField = async (key, value) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const copyAll = async () => {
    const text = fields
      .filter(f => f.value)
      .map(f => `${f.label}:\n${f.value}`)
      .join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopied('all')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h2 className="font-semibold text-gray-900">Export date SEO</h2>
            <p className="text-xs text-gray-500 mt-0.5">{page.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyAll}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                copied === 'all'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
              }`}>
              {copied === 'all' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Copiază tot
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {fields.map(field => (
            <div key={field.key} className="group">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {field.label}
                </label>
                {field.value && (
                  <button onClick={() => copyField(field.key, field.value)}
                    className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 ${
                      copied === field.key
                        ? 'bg-green-100 text-green-700 opacity-100'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {copied === field.key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied === field.key ? 'Copiat!' : 'Copiază'}
                  </button>
                )}
              </div>
              {field.value ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <p className="text-sm text-gray-800 break-words">{field.value}</p>
                  {(field.key === 'title_tag' || field.key === 'meta_description') && (
                    <p className={`text-xs mt-1 ${
                      (field.key === 'title_tag' && field.value.length > 60) ||
                      (field.key === 'meta_description' && field.value.length > 155)
                        ? 'text-red-500' : 'text-gray-400'
                    }`}>
                      {field.value.length} caractere
                      {field.key === 'title_tag' && ' (max 60)'}
                      {field.key === 'meta_description' && ' (max 155)'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2">
                  <p className="text-sm text-gray-400 italic">Necompletat</p>
                </div>
              )}
            </div>
          ))}

          {/* Keywords */}
          {page.seo_keywords?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Keywords</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {page.seo_keywords
                    .sort((a, b) => (b.monthly_volume || 0) - (a.monthly_volume || 0))
                    .map(kw => (
                      <span key={kw.id} className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-0.5 rounded">
                        {kw.keyword} {kw.monthly_volume ? `(${kw.monthly_volume.toLocaleString()}/lună)` : ''}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Pagina principală ────────────────────────────────────
export default function SiteReport() {
  const { siteId } = useParams()
  const navigate = useNavigate()
  const [exportPage, setExportPage] = useState(null)

  // Fetch site
  const { data: site } = useQuery({
    queryKey: ['seo-site', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_sites').select('*').eq('id', siteId).single()
      if (error) throw error
      return data
    },
  })

  // Fetch toate paginile cu keywords + checklist
  const { data: pages, isLoading } = useQuery({
    queryKey: ['seo-report', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_pages')
        .select(`*, seo_keywords(*), seo_checklist_progress(completed)`)
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
      if (error) throw error

      return data.map(page => {
        const progress  = page.seo_checklist_progress || []
        const completed = progress.filter(p => p.completed).length
        const checklistProgress = TOTAL_CHECKLIST_ITEMS > 0
          ? Math.round((completed / TOTAL_CHECKLIST_ITEMS) * 100)
          : 0
        return { ...page, checklistProgress }
      })
    },
  })

  if (isLoading) return <LoadingSpinner />

  const total = pages?.length || 0

  // ─── Calcule statistici ───────────────────────────────
  const done100         = pages?.filter(p => p.checklistProgress === 100).length || 0
  const noKeyword       = pages?.filter(p => !p.primary_keyword).length || 0
  const noTitle         = pages?.filter(p => !p.title_tag).length || 0
  const noMeta          = pages?.filter(p => !p.meta_description).length || 0
  const doneStatus      = pages?.filter(p => p.status === 'done').length || 0
  const needsReview     = pages?.filter(p => p.status === 'needs_review').length || 0
  const noKeywords      = pages?.filter(p => !p.seo_keywords?.length).length || 0

  const avgProgress = total > 0
    ? Math.round(pages.reduce((s, p) => s + p.checklistProgress, 0) / total)
    : 0

  // ─── Date grafice ─────────────────────────────────────
  // Distribuție tipuri
  const typeDistrib = pages?.reduce((acc, p) => {
    acc[p.page_type] = (acc[p.page_type] || 0) + 1
    return acc
  }, {})
  const pieData = Object.entries(typeDistrib || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    key: name,
  }))

  // Distribuție status
  const statusDistrib = pages?.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {})
  const statusData = Object.entries(statusDistrib || {}).map(([key, count]) => ({
    name: STATUS_LABELS[key] || key,
    count,
    color: STATUS_COLORS[key],
  }))

  // Bar chart progress pe pagini (top 10 cu cel mai mic progres)
  const priorityPages = pages
    ? [...pages].sort((a, b) => a.checklistProgress - b.checklistProgress).slice(0, 10)
    : []

  const barData = priorityPages.map(p => ({
    name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
    progress: p.checklistProgress,
  }))

  // Custom tooltip pentru BarChart
  const CustomBarTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
        <p className="font-medium text-gray-900">{payload[0]?.payload?.name}</p>
        <p className="text-primary-600">{payload[0]?.value}% completat</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb + header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/seo/${siteId}`)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary-600" />
            <h1 className="text-xl font-bold text-gray-900">Raport SEO</h1>
            <span className="text-gray-400">—</span>
            <span className="font-medium text-gray-700">{site?.name}</span>
            {site?.domain && (
              <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary-600 flex items-center gap-0.5 hover:underline">
                {site.domain}<ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            )}
          </div>
        </div>
        <Link to={`/seo/${siteId}`}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
          <FileText className="w-4 h-4" />
          Înapoi la pagini
        </Link>
      </div>

      {total === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <BarChart2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Nicio pagină adăugată. Adaugă pagini pentru a vedea raportul.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ─── KPI-uri principale ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={FileText}      label="Total pagini"          value={total}        color="blue" />
            <StatCard icon={TrendingUp}    label="Progres mediu checklist" value={`${avgProgress}%`}
              sub={`${done100} pagini la 100%`} color={avgProgress >= 70 ? 'green' : avgProgress >= 40 ? 'yellow' : 'red'} />
            <StatCard icon={CheckCircle}   label="Pagini finalizate"     value={doneStatus}   color="green" sub={`${total - doneStatus} în lucru`} />
            <StatCard icon={AlertCircle}   label="Necesită review"       value={needsReview}  color={needsReview > 0 ? 'red' : 'green'}
              alert={needsReview > 0} />
          </div>

          {/* ─── Alerte câmpuri lipsă ─── */}
          {(noKeyword > 0 || noTitle > 0 || noMeta > 0 || noKeywords > 0) && (
            <div className="bg-white border border-orange-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h2 className="font-semibold text-gray-900">Câmpuri lipsă — necesită atenție</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {noKeyword > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-700">{noKeyword}</p>
                    <p className="text-xs text-gray-600 mt-0.5">fără keyword principal</p>
                  </div>
                )}
                {noTitle > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{noTitle}</p>
                    <p className="text-xs text-gray-600 mt-0.5">fără title tag</p>
                  </div>
                )}
                {noMeta > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{noMeta}</p>
                    <p className="text-xs text-gray-600 mt-0.5">fără meta description</p>
                  </div>
                )}
                {noKeywords > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-700">{noKeywords}</p>
                    <p className="text-xs text-gray-600 mt-0.5">fără keywords în tabel</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Grafice ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pie: tipuri pagini */}
            {pieData.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Distribuție tipuri pagini</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      paddingAngle={3} dataKey="value">
                      {pieData.map((entry) => (
                        <Cell key={entry.key} fill={TYPE_COLORS[entry.key] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Pie/Bar: status */}
            {statusData.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Distribuție status pagini</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={statusData} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Pagini" radius={[4, 4, 0, 0]}>
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ─── Bar chart: progress per pagini ─── */}
          {barData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-1">
                Progres checklist per pagină
                {barData.length < total && <span className="text-sm font-normal text-gray-500 ml-2">(top {barData.length} cu progres mic)</span>}
              </h2>
              <p className="text-xs text-gray-500 mb-4">Paginile cu progres mic = prioritate de lucru</p>
              <ResponsiveContainer width="100%" height={Math.max(180, barData.length * 36)}>
                <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }}
                    tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="progress" name="Progres" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={index} fill={
                        entry.progress >= 80 ? '#22c55e' :
                        entry.progress >= 40 ? '#f59e0b' : '#ef4444'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ─── Lista paginilor cu prioritate de lucru ─── */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Toate paginile</h2>
                <p className="text-xs text-gray-500">Sortate după progres checklist (cel mai mic = prioritate)</p>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {[...pages]
                .sort((a, b) => a.checklistProgress - b.checklistProgress)
                .map((page, i) => (
                  <div key={page.id} className="flex items-center gap-3 py-3 group">
                    <PriorityRow page={page} rank={i + 1} />
                    <button
                      onClick={() => setExportPage(page)}
                      className="shrink-0 p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Export date"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* ─── Secțiune: pagini fără meta completă ─── */}
          {(noTitle > 0 || noMeta > 0 || noKeyword > 0) && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-4">
                Pagini incomplete — acțiuni rapide
              </h2>
              <div className="space-y-2">
                {pages
                  .filter(p => !p.title_tag || !p.meta_description || !p.primary_keyword)
                  .slice(0, 8)
                  .map(page => (
                    <div key={page.id}
                      className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:border-primary-200 hover:bg-primary-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{page.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs flex items-center gap-0.5 ${page.primary_keyword ? 'text-green-600' : 'text-red-500'}`}>
                            {page.primary_keyword ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            Keyword
                          </span>
                          <span className={`text-xs flex items-center gap-0.5 ${page.title_tag ? 'text-green-600' : 'text-red-500'}`}>
                            {page.title_tag ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            Title
                          </span>
                          <span className={`text-xs flex items-center gap-0.5 ${page.meta_description ? 'text-green-600' : 'text-red-500'}`}>
                            {page.meta_description ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            Meta
                          </span>
                        </div>
                      </div>
                      <Link
                        to={`/seo/${page.site_id}/pages/${page.id}`}
                        className="shrink-0 text-xs text-primary-600 hover:underline flex items-center gap-1"
                      >
                        Completează <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Modal export */}
      {exportPage && (
        <ExportModal page={exportPage} onClose={() => setExportPage(null)} />
      )}
    </div>
  )
}
