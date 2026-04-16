// src/pages/seo/SeoSites.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  Globe,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  BarChart2,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  TrendingUp,
} from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'

const PLATFORMS = [
  { value: 'woocommerce', label: 'WooCommerce' },
  { value: 'prestashop',  label: 'PrestaShop' },
  { value: 'shopify',     label: 'Shopify' },
  { value: 'custom',      label: 'Custom / Altul' },
]

// ─── Formular Site (modal) ───────────────────────────────
function SiteModal({ site, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:     site?.name     || '',
    domain:   site?.domain   || '',
    platform: site?.platform || 'woocommerce',
    notes:    site?.notes    || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.domain.trim()) {
      setError('Numele și domeniul sunt obligatorii.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = { ...form, user_id: user.id }

      let result
      if (site?.id) {
        result = await supabase.from('seo_sites').update(payload).eq('id', site.id).select().single()
      } else {
        result = await supabase.from('seo_sites').insert(payload).select().single()
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {site ? 'Editează site' : 'Site nou'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nume site *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="ex: Pernador.ro"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domeniu *</label>
            <input
              type="text"
              value={form.domain}
              onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
              placeholder="ex: pernador.ro"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platformă</label>
            <select
              value={form.platform}
              onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (opțional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Informații suplimentare despre acest site..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Se salvează...' : (site ? 'Salvează' : 'Adaugă site')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Card Site ───────────────────────────────────────────
function SiteCard({ site, onEdit, onDelete }) {
  const avgProgress = site.avgProgress || 0
  const pagesCount  = site.pagesCount  || 0
  const doneCount   = site.doneCount   || 0

  const statusColor =
    avgProgress >= 80 ? 'text-green-600 bg-green-50'  :
    avgProgress >= 40 ? 'text-yellow-600 bg-yellow-50' :
    'text-red-600 bg-red-50'

  const platformLabel = PLATFORMS.find(p => p.value === site.platform)?.label || site.platform || '—'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-primary-300 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{site.name}</h3>
            <a
              href={`https://${site.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-600 hover:underline flex items-center gap-1"
            >
              {site.domain}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
          {avgProgress}%
        </span>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Progres mediu checklist</span>
          <span>{avgProgress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              avgProgress >= 80 ? 'bg-green-500' :
              avgProgress >= 40 ? 'bg-yellow-500' : 'bg-red-400'
            }`}
            style={{ width: `${avgProgress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-lg font-bold text-gray-900">{pagesCount}</p>
          <p className="text-xs text-gray-500">pagini</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2">
          <p className="text-lg font-bold text-green-700">{doneCount}</p>
          <p className="text-xs text-gray-500">finalizate</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2">
          <p className="text-sm font-medium text-blue-700">{platformLabel}</p>
          <p className="text-xs text-gray-500">platformă</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          to={`/seo/${site.id}`}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
        >
          <BarChart2 className="w-4 h-4" />
          Gestionează
        </Link>
        <button
          onClick={() => onEdit(site)}
          className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(site)}
          className="px-3 py-2 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Pagina principală ───────────────────────────────────
export default function SeoSites() {
  const queryClient = useQueryClient()
  const [modal, setModal]         = useState(null) // null | 'add' | site object
  const [deleteTarget, setDelete] = useState(null)

  // Fetch sites cu statistici
  const { data: sites, isLoading } = useQuery({
    queryKey: ['seo-sites'],
    queryFn: async () => {
      const { data: sitesData, error } = await supabase
        .from('seo_sites')
        .select(`
          *,
          seo_pages (
            id, status,
            seo_checklist_progress (completed)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Calculează statistici per site
      return sitesData.map(site => {
        const pages = site.seo_pages || []
        const pagesCount = pages.length
        const doneCount = pages.filter(p => p.status === 'done').length

        // Progres mediu checklist
        let totalItems = 0, completedItems = 0
        pages.forEach(page => {
          const progress = page.seo_checklist_progress || []
          totalItems    += progress.length
          completedItems += progress.filter(p => p.completed).length
        })
        const avgProgress = totalItems > 0
          ? Math.round((completedItems / totalItems) * 100)
          : 0

        return { ...site, pagesCount, doneCount, avgProgress }
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('seo_sites').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-sites'] })
      setDelete(null)
    },
  })

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['seo-sites'] })
    setModal(null)
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-primary-600" />
            Modul SEO
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestionează optimizarea SEO pentru site-urile tale
          </p>
        </div>
        <button
          onClick={() => setModal('add')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          Site nou
        </button>
      </div>

      {/* Stats bar */}
      {sites && sites.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{sites.length}</p>
            <p className="text-sm text-gray-500">site-uri</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {sites.reduce((s, site) => s + site.pagesCount, 0)}
            </p>
            <p className="text-sm text-gray-500">pagini totale</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-700">
              {sites.reduce((s, site) => s + site.doneCount, 0)}
            </p>
            <p className="text-sm text-gray-500">pagini finalizate</p>
          </div>
        </div>
      )}

      {/* Site list */}
      {sites && sites.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Niciun site adăugat</h3>
          <p className="text-sm text-gray-500 mb-6">
            Adaugă primul site pentru a începe să optimizezi SEO
          </p>
          <button
            onClick={() => setModal('add')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Adaugă site
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites?.map(site => (
            <SiteCard
              key={site.id}
              site={site}
              onEdit={s => setModal(s)}
              onDelete={s => setDelete(s)}
            />
          ))}
        </div>
      )}

      {/* Modal adăugare/editare */}
      {modal && (
        <SiteModal
          site={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Confirmare ștergere */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Șterge site</h3>
                <p className="text-sm text-gray-500">Această acțiune nu poate fi anulată</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Vei șterge <strong>{deleteTarget.name}</strong> și toate paginile, keyword-urile și progresul asociat.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDelete(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Anulează
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Se șterge...' : 'Șterge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
