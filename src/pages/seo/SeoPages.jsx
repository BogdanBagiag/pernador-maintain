// src/pages/seo/SeoPages.jsx
import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Globe,
  FileText,
  Tag,
  CheckCircle,
  Clock,
  BarChart2,
  AlertCircle,
  Search,
  Filter,
  X,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import { TOTAL_CHECKLIST_ITEMS } from '../../constants/seoChecklist'

const PAGE_TYPES = [
  { value: 'produs',    label: 'Produs',    color: 'bg-blue-100 text-blue-700' },
  { value: 'categorie', label: 'Categorie', color: 'bg-purple-100 text-purple-700' },
  { value: 'blog',      label: 'Blog',      color: 'bg-green-100 text-green-700' },
  { value: 'homepage',  label: 'Homepage',  color: 'bg-orange-100 text-orange-700' },
  { value: 'altul',     label: 'Altul',     color: 'bg-gray-100 text-gray-700' },
]

const STATUS_OPTIONS = [
  { value: 'in_progress',  label: 'În lucru',    icon: Clock,        color: 'bg-yellow-100 text-yellow-700' },
  { value: 'needs_review', label: 'Necesită review', icon: AlertCircle, color: 'bg-orange-100 text-orange-700' },
  { value: 'done',         label: 'Finalizat',   icon: CheckCircle,  color: 'bg-green-100 text-green-700' },
]

// ─── Modal formular pagină ────────────────────────────────
function PageModal({ page, siteId, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:            page?.name            || '',
    page_type:       page?.page_type       || 'produs',
    url_slug:        page?.url_slug        || '',
    primary_keyword: page?.primary_keyword || '',
    status:          page?.status          || 'in_progress',
    notes:           page?.notes           || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Numele paginii este obligatoriu.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const payload = { ...form, site_id: siteId }
      let result
      if (page?.id) {
        result = await supabase.from('seo_pages').update(payload).eq('id', page.id).select().single()
      } else {
        result = await supabase.from('seo_pages').insert(payload).select().single()
      }
      if (result.error) throw result.error
      onSaved(result.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">
            {page ? 'Editează pagina' : 'Pagină nouă'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Denumire pagină *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="ex: Huse protecție pat impermeabile"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tip pagină *</label>
              <select
                value={form.page_type}
                onChange={e => setForm(f => ({ ...f, page_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuvânt cheie principal</label>
            <input
              type="text"
              value={form.primary_keyword}
              onChange={e => setForm(f => ({ ...f, primary_keyword: e.target.value }))}
              placeholder="ex: huse protecție pat impermeabile"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug</label>
            <input
              type="text"
              value={form.url_slug}
              onChange={e => setForm(f => ({ ...f, url_slug: e.target.value }))}
              placeholder="ex: huse-protectie-pat-impermeabile"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Anulează
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Se salvează...' : (page ? 'Salvează' : 'Adaugă pagina')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Card Pagină ─────────────────────────────────────────
function PageCard({ page, onEdit, onDelete }) {
  const progress = page.checklistProgress || 0
  const typeInfo = PAGE_TYPES.find(t => t.value === page.page_type)
  const statusInfo = STATUS_OPTIONS.find(s => s.value === page.status)
  const StatusIcon = statusInfo?.icon || Clock

  const hasMeta = page.title_tag && page.meta_description
  const hasKeyword = !!page.primary_keyword

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-primary-300 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeInfo?.color || 'bg-gray-100 text-gray-700'}`}>
              {typeInfo?.label}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${statusInfo?.color || ''}`}>
              <StatusIcon className="w-3 h-3" />
              {statusInfo?.label}
            </span>
          </div>
          <h3 className="font-medium text-gray-900 truncate">{page.name}</h3>
          {page.url_slug && (
            <p className="text-xs text-gray-400 mt-0.5">/{page.url_slug}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(page)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(page)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Keyword */}
      {page.primary_keyword ? (
        <div className="flex items-center gap-1 mb-3">
          <Tag className="w-3.5 h-3.5 text-primary-500" />
          <span className="text-xs text-primary-700 font-medium">{page.primary_keyword}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 mb-3">
          <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs text-orange-500">Lipsă keyword principal</span>
        </div>
      )}

      {/* Progress checklist */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Checklist SEO</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${
              progress >= 80 ? 'bg-green-500' :
              progress >= 40 ? 'bg-yellow-500' : 'bg-red-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Indicatori rapizi */}
      <div className="flex items-center gap-3 mb-4">
        <span className={`text-xs flex items-center gap-1 ${hasMeta ? 'text-green-600' : 'text-gray-400'}`}>
          {hasMeta ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
          Meta SEO
        </span>
        <span className={`text-xs flex items-center gap-1 ${hasKeyword ? 'text-green-600' : 'text-gray-400'}`}>
          {hasKeyword ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
          Keyword
        </span>
      </div>

      <Link
        to={`/seo/${page.site_id}/pages/${page.id}`}
        className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-gray-50 hover:bg-primary-50 text-gray-700 hover:text-primary-700 text-sm font-medium rounded-lg border border-gray-200 hover:border-primary-200 transition-colors"
      >
        Deschide
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

// ─── Pagina principală ───────────────────────────────────
export default function SeoPages() {
  const { siteId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [modal, setModal]         = useState(null)
  const [deleteTarget, setDelete] = useState(null)
  const [searchTerm, setSearch]   = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Fetch site info
  const { data: site } = useQuery({
    queryKey: ['seo-site', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_sites').select('*').eq('id', siteId).single()
      if (error) throw error
      return data
    },
  })

  // Fetch pages cu progress
  const { data: pages, isLoading } = useQuery({
    queryKey: ['seo-pages', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seo_pages')
        .select(`*, seo_checklist_progress(completed)`)
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
      if (error) throw error

      return data.map(page => {
        const progress = page.seo_checklist_progress || []
        const completed = progress.filter(p => p.completed).length
        const checklistProgress = TOTAL_CHECKLIST_ITEMS > 0
          ? Math.round((completed / TOTAL_CHECKLIST_ITEMS) * 100)
          : 0
        return { ...page, checklistProgress }
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('seo_pages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-pages', siteId] })
      queryClient.invalidateQueries({ queryKey: ['seo-sites'] })
      setDelete(null)
    },
  })

  const filtered = pages?.filter(p => {
    const matchSearch = !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.primary_keyword?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchType   = typeFilter   === 'all' || p.page_type === typeFilter
    const matchStatus = statusFilter === 'all' || p.status    === statusFilter
    return matchSearch && matchType && matchStatus
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/seo')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary-600" />
            <h1 className="text-xl font-bold text-gray-900">{site?.name}</h1>
            {site?.domain && (
              <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                {site.domain} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <p className="text-sm text-gray-500">{pages?.length || 0} pagini adăugate</p>
        </div>
        <Link to={`/seo/${siteId}/report`}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
          <BarChart2 className="w-4 h-4" />
          Raport
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearch(e.target.value)}
            placeholder="Caută după denumire sau keyword..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="all">Toate tipurile</option>
          {PAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="all">Toate statusurile</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={() => setModal('add')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 whitespace-nowrap">
          <Plus className="w-4 h-4" />
          Pagină nouă
        </button>
      </div>

      {/* Grid pagini */}
      {filtered && filtered.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {pages?.length === 0 ? 'Nicio pagină adăugată' : 'Niciun rezultat'}
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            {pages?.length === 0
              ? 'Adaugă prima pagină/produs pentru a începe optimizarea SEO'
              : 'Încearcă alte filtre de căutare'}
          </p>
          {pages?.length === 0 && (
            <button onClick={() => setModal('add')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
              <Plus className="w-4 h-4" />
              Adaugă prima pagină
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map(page => (
            <PageCard
              key={page.id}
              page={page}
              onEdit={p => setModal(p)}
              onDelete={p => setDelete(p)}
            />
          ))}
        </div>
      )}

      {/* Modal pagină */}
      {modal && (
        <PageModal
          page={modal === 'add' ? null : modal}
          siteId={siteId}
          onClose={() => setModal(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['seo-pages', siteId] })
            queryClient.invalidateQueries({ queryKey: ['seo-sites'] })
            setModal(null)
          }}
        />
      )}

      {/* Confirmare ștergere */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Șterge pagina</h3>
            <p className="text-sm text-gray-700 mb-6">
              Vei șterge <strong>"{deleteTarget.name}"</strong> și tot progresul SEO asociat (keywords, checklist, sugestii AI).
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelete(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Anulează
              </button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? 'Se șterge...' : 'Șterge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
