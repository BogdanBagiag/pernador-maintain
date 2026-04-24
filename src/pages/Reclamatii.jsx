import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ro } from 'date-fns/locale'
import {
  Plus, X, Trash2, Loader2, Pencil, ShieldOff, Settings,
  ChevronLeft, ChevronRight, Calendar, CheckCircle2, Clock,
  Megaphone, CheckCheck, BarChart2, TableProperties,
} from 'lucide-react'
import QuickLinksPanel from '../components/QuickLinksPanel'

const PAGE_SIZE = 50

const FILTER_OPTIONS = [
  { key: '7days',         label: 'Ultimele 7 zile' },
  { key: 'current_month', label: 'Luna curentă' },
  { key: 'last_month',    label: 'Luna trecută' },
  { key: 'custom',        label: 'Personalizat' },
  { key: 'all',           label: 'Toate' },
]

const CINE_OPTIONS = ['Clientul', 'Noi', 'Noi/Clientul']

function getDateRange(filterType, customFrom, customTo) {
  const today = new Date()
  switch (filterType) {
    case '7days':         return { from: format(subDays(today, 6), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
    case 'current_month': return { from: format(startOfMonth(today), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
    case 'last_month': {
      const lm = subMonths(today, 1)
      return { from: format(startOfMonth(lm), 'yyyy-MM-dd'), to: format(endOfMonth(lm), 'yyyy-MM-dd') }
    }
    case 'custom': return { from: customFrom || null, to: customTo || null }
    default:       return { from: null, to: null }
  }
}

const sursaBadge = (s) => {
  if (s === 'Pernador') return 'bg-blue-100 text-blue-700'
  if (s === 'eMAg')     return 'bg-purple-100 text-purple-700'
  return 'bg-gray-100 text-gray-600'
}

const cineBadge = (c) => {
  if (c === 'Noi')          return 'bg-red-100 text-red-700'
  if (c === 'Noi/Clientul') return 'bg-amber-100 text-amber-700'
  return 'bg-sky-100 text-sky-700'
}

export default function Reclamatii() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const { canView, canEdit, canDelete } = usePermissions()

  const pView   = canView('reclamatii')
  const pEdit   = canEdit('reclamatii')
  const pDelete = canDelete('reclamatii')

  const [filterType, setFilterType] = useState('current_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [page, setPage] = useState(1)

  const [activeTab,     setActiveTab]     = useState('table') // 'table' | 'rapoarte'
  const [showAddEdit,   setShowAddEdit]   = useState(false)
  const [editRow,       setEditRow]       = useState(null)
  const [deletingId,    setDeletingId]    = useState(null)
  const [configModal,   setConfigModal]   = useState(null) // 'sursa' | 'ce_gresit' | 'cum_rezolvat'
  const [rezolvaRow,    setRezolvaRow]    = useState(null)

  // ── Queries ───────────────────────────────────────────────
  const { from, to } = getDateRange(filterType, customFrom, customTo)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['reclamatii', filterType, customFrom, customTo],
    queryFn: async () => {
      let q = supabase.from('reclamatii').select('*')
        .order('data_reclamatie', { ascending: false })
        .order('created_at', { ascending: false })
      if (from) q = q.gte('data_reclamatie', from)
      if (to)   q = q.lte('data_reclamatie', to)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })

  const { data: surse = [], refetch: refetchSurse } = useQuery({
    queryKey: ['reclamatii_sursa'],
    queryFn: async () => {
      const { data } = await supabase.from('reclamatii_sursa').select('*').order('pozitie').order('nume')
      return data || []
    },
  })

  const { data: ceGresitOpts = [], refetch: refetchCeGresit } = useQuery({
    queryKey: ['reclamatii_ce_gresit'],
    queryFn: async () => {
      const { data } = await supabase.from('reclamatii_ce_gresit').select('*').order('pozitie').order('nume')
      return data || []
    },
  })

  const { data: cumRezolvatOpts = [], refetch: refetchCumRezolvat } = useQuery({
    queryKey: ['reclamatii_cum_rezolvat'],
    queryFn: async () => {
      const { data } = await supabase.from('reclamatii_cum_rezolvat').select('*').order('pozitie').order('nume')
      return data || []
    },
  })

  // ── Calcule ───────────────────────────────────────────────
  const total       = rows.length
  const rezolvate   = rows.filter(r => r.data_rezolvare).length
  const nerezolvate = total - rezolvate

  // ── Rapoarte ──────────────────────────────────────────────
  const bySursa = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      const key = r.sursa || '(nespecificat)'
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [rows])

  const byCeGresit = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      const key = r.ce_gresit || '(nespecificat)'
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [rows])

  const byCineGresit = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      const key = r.cine_gresit || '(nespecificat)'
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [rows])

  const byLuna = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      if (!r.data_reclamatie) return
      const key = r.data_reclamatie.slice(0, 7)
      if (!map[key]) map[key] = { total: 0, rezolvate: 0 }
      map[key].total++
      if (r.data_rezolvare) map[key].rezolvate++
    })
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [rows])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const withNr     = [...rows].reverse().map((r, i) => ({ ...r, nr: i + 1 })).reverse()
  const pagedRows  = withNr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const goToPage            = (p) => setPage(Math.min(Math.max(1, p), totalPages))
  const handleFilterChange  = (key) => { setFilterType(key); setPage(1) }

  // ── Handlers ──────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Ștergi această reclamație?')) return
    setDeletingId(id)
    await supabase.from('reclamatii').delete().eq('id', id)
    setDeletingId(null)
    queryClient.invalidateQueries({ queryKey: ['reclamatii'] })
  }

  const openAdd  = () => { setEditRow(null); setShowAddEdit(true) }
  const openEdit = (row) => { setEditRow(row); setShowAddEdit(true) }

  const getLookupInfo = () => {
    if (configModal === 'sursa')        return { table: 'reclamatii_sursa',        items: surse,          refetch: refetchSurse,       label: 'Surse' }
    if (configModal === 'ce_gresit')    return { table: 'reclamatii_ce_gresit',    items: ceGresitOpts,   refetch: refetchCeGresit,    label: 'Ce a fost greșit' }
    if (configModal === 'cum_rezolvat') return { table: 'reclamatii_cum_rezolvat', items: cumRezolvatOpts, refetch: refetchCumRezolvat, label: 'Cum am rezolvat' }
    return null
  }

  // ── Acces interzis ────────────────────────────────────────
  if (!pView) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <ShieldOff className="w-14 h-14 text-gray-300" />
      <p className="text-lg font-semibold text-gray-500">Acces restricționat</p>
      <p className="text-sm text-gray-400">Nu ai permisiunea de a vizualiza Reclamațiile.</p>
    </div>
  )

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  )

  return (
    <div className="max-w-full mx-auto space-y-5">

      {/* ── Titlu ── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reclamații</h1>
        <p className="text-sm text-gray-500 mt-0.5">Evidența reclamațiilor și rezolvarea lor</p>
      </div>

      {/* ── Carduri sumar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-4 h-4 text-gray-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
            <p className="text-xl font-bold text-gray-800">{total}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Rezolvate</p>
            <p className="text-xl font-bold text-emerald-600">{rezolvate}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Nerezolvate</p>
            <p className="text-xl font-bold text-red-500">{nerezolvate}</p>
          </div>
        </div>

      </div>

      {/* ── Filtre ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map(opt => (
            <button key={opt.key} onClick={() => handleFilterChange(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterType === opt.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >{opt.label}</button>
          ))}
        </div>
        {filterType === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <label className="text-sm text-gray-500">De la:</label>
              <input type="date" value={customFrom}
                onChange={e => { setCustomFrom(e.target.value); setPage(1) }}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Până la:</label>
              <input type="date" value={customTo}
                onChange={e => { setCustomTo(e.target.value); setPage(1) }}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
          </div>
        )}
      </div>

      {/* ── Linkuri rapide ── */}
      <QuickLinksPanel page="reclamatii" />

      {/* ── Tab-uri + Acțiuni ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'table' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <TableProperties className="w-4 h-4" />
            Înregistrări
            {total > 0 && (
              <span className="ml-1 bg-gray-200 text-gray-600 text-xs font-semibold px-1.5 py-0.5 rounded-full">{total}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('rapoarte')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'rapoarte' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Rapoarte
          </button>
        </div>

        {activeTab === 'table' && pEdit && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setConfigModal('sursa')}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium">
              <Settings className="w-4 h-4" /> Surse
            </button>
            <button onClick={() => setConfigModal('ce_gresit')}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium">
              <Settings className="w-4 h-4" /> Ce a greșit
            </button>
            <button onClick={() => setConfigModal('cum_rezolvat')}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium">
              <Settings className="w-4 h-4" /> Cum am rezolvat
            </button>
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Adaugă
            </button>
          </div>
        )}
      </div>

      {/* ── Tab: Tabel ── */}
      {activeTab === 'table' && <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">Nr.</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sursă</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Data Rec.</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Rezolvată</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Comandă</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">AWB</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nume Client</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalii</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Ce a greșit</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cine</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Responsabil</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cum am rezolvat</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-gray-400">
                    <Megaphone className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p>Nicio reclamație pentru perioada selectată.</p>
                  </td>
                </tr>
              ) : pagedRows.map((row) => (
                <tr key={row.id}
                  className={`border-b border-gray-100 hover:bg-gray-50/80 transition-colors ${
                    row.data_rezolvare ? 'bg-emerald-50/40' : 'bg-red-50/30'
                  }`}
                >
                  <td className="px-3 py-3 text-center text-gray-400 font-mono text-xs">{row.nr}</td>

                  <td className="px-3 py-3">
                    {row.sursa
                      ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sursaBadge(row.sursa)}`}>{row.sursa}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>

                  <td className="px-3 py-3 text-gray-700 whitespace-nowrap text-xs">
                    {row.data_reclamatie ? format(new Date(row.data_reclamatie + 'T00:00:00'), 'dd.MM.yyyy') : '—'}
                  </td>

                  <td className="px-3 py-3 whitespace-nowrap text-xs">
                    {row.data_rezolvare
                      ? <span className="text-emerald-600 font-medium">{format(new Date(row.data_rezolvare + 'T00:00:00'), 'dd.MM.yyyy')}</span>
                      : <span className="inline-flex items-center gap-1 text-red-500 font-medium"><Clock className="w-3 h-3" />Nerezolvată</span>}
                  </td>

                  <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">
                    {row.comanda
                      ? <a
                          href={`https://panel-e.baselinker.com/orders.php#status:all#search:${row.comanda}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-800 hover:underline"
                        >{row.comanda}</a>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{row.awb || '—'}</td>
                  <td className="px-3 py-3 text-gray-700 whitespace-nowrap text-xs">{row.nume_client || '—'}</td>

                  <td className="px-3 py-3 text-gray-500 text-xs max-w-[180px]">
                    <span className="line-clamp-2">{row.detalii || '—'}</span>
                  </td>

                  <td className="px-3 py-3">
                    {row.ce_gresit
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 max-w-[180px] truncate block">{row.ce_gresit}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>

                  <td className="px-3 py-3">
                    {row.cine_gresit
                      ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cineBadge(row.cine_gresit)}`}>{row.cine_gresit}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>

                  <td className="px-3 py-3 text-gray-700 text-xs whitespace-nowrap">{row.responsabil || '—'}</td>

                  <td className="px-3 py-3 text-gray-500 text-xs max-w-[200px]">
                    <span className="line-clamp-2">{row.cum_rezolvat || '—'}</span>
                  </td>

                  <td className="px-2 py-3">
                    <div className="flex gap-1 items-center">
                      {pEdit && !row.data_rezolvare && (
                        <button
                          onClick={() => setRezolvaRow(row)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <CheckCheck className="w-3 h-3" />
                          Rezolvă
                        </button>
                      )}
                      {pEdit && (
                        <button onClick={() => openEdit(row)}
                          className="p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {pDelete && (
                        <button onClick={() => handleDelete(row.id)} disabled={deletingId === row.id}
                          className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          {deletingId === row.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Paginare ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              Pagina <span className="font-semibold">{page}</span> din <span className="font-semibold">{totalPages}</span>
              <span className="ml-2 text-gray-400">({total} total)</span>
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => goToPage(1)} disabled={page === 1}
                className="px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-200 rounded-lg disabled:opacity-30">«</button>
              <button onClick={() => goToPage(page - 1)} disabled={page === 1}
                className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p
                if (totalPages <= 5)        p = i + 1
                else if (page <= 3)         p = i + 1
                else if (page >= totalPages - 2) p = totalPages - 4 + i
                else                        p = page - 2 + i
                return (
                  <button key={p} onClick={() => goToPage(p)}
                    className={`w-8 h-8 text-sm rounded-lg font-medium transition-colors ${
                      p === page ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >{p}</button>
                )
              })}
              <button onClick={() => goToPage(page + 1)} disabled={page === totalPages}
                className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => goToPage(totalPages)} disabled={page === totalPages}
                className="px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-200 rounded-lg disabled:opacity-30">»</button>
            </div>
          </div>
        )}
      </div>}

      {/* ── Tab: Rapoarte ── */}
      {activeTab === 'rapoarte' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Pe Sursă */}
          <SimpleReportTable
            title="Reclamații pe Sursă"
            subtitle="Distribuție în perioada selectată"
            data={bySursa}
            total={total}
            renderKey={(key) => (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sursaBadge(key)}`}>{key}</span>
            )}
          />

          {/* Responsabilitate */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Responsabilitate</h3>
              <p className="text-xs text-gray-400 mt-0.5">Vina noastră vs. clientului în perioada selectată</p>
            </div>
            <div className="p-5 space-y-5">
              {[
                { key: 'Clientul',     color: 'sky'     },
                { key: 'Noi',          color: 'red'     },
                { key: 'Noi/Clientul', color: 'amber'   },
              ].map(({ key, color }) => {
                const count = rows.filter(r => r.cine_gresit === key).length
                return <CineStatusBar key={key} label={key} count={count} total={total} color={color} />
              })}
            </div>
          </div>

          {/* Ce a greșit */}
          <SimpleReportTable
            title="Ce a fost greșit"
            subtitle="Tipuri de probleme raportate"
            data={byCeGresit}
            total={total}
            renderKey={(key) => (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{key}</span>
            )}
          />

          {/* Evoluție lunară */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Evoluție lunară</h3>
              <p className="text-xs text-gray-400 mt-0.5">Reclamații grupate pe luni</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2 text-left   text-xs font-semibold text-gray-500 uppercase">Lună</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-20">Total</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-emerald-600 uppercase w-24">Rezolvate</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-400 uppercase w-16">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {byLuna.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-300 text-xs">Fără date</td></tr>
                  ) : byLuna.map(([luna, stats]) => {
                    const [yr, mo] = luna.split('-')
                    const label = format(new Date(Number(yr), Number(mo) - 1, 1), 'MMMM yyyy', { locale: ro })
                    return (
                      <tr key={luna} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-700 capitalize">{label}</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-gray-700">{stats.total}</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-emerald-600">{stats.rezolvate}</td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-400">
                          {total > 0 ? Math.round(stats.total / total * 100) + '%' : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {byLuna.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 border-t border-gray-200">
                      <td className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Total</td>
                      <td className="px-4 py-2 text-center font-bold text-gray-700">{total}</td>
                      <td className="px-4 py-2 text-center font-bold text-emerald-600">{rezolvate}</td>
                      <td className="px-4 py-2 text-center text-gray-400">100%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Status Rezolvare */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Status Rezolvare</h3>
              <p className="text-xs text-gray-400 mt-0.5">Rezolvate vs. nerezolvate în perioada selectată</p>
            </div>
            <div className="p-5 space-y-5">
              <CineStatusBar label="Rezolvate"   count={rezolvate}   total={total} color="emerald" />
              <CineStatusBar label="Nerezolvate" count={nerezolvate} total={total} color="red"     />
            </div>
          </div>

        </div>
      )}

      {/* ── Modal Rezolvă ── */}
      {rezolvaRow && (
        <RezolvaModal
          row={rezolvaRow}
          cumRezolvatOpts={cumRezolvatOpts}
          onClose={() => setRezolvaRow(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['reclamatii'] })
            setRezolvaRow(null)
          }}
        />
      )}

      {/* ── Modal Add/Edit ── */}
      {showAddEdit && (
        <AddEditModal
          row={editRow}
          surse={surse}
          ceGresitOpts={ceGresitOpts}
          cumRezolvatOpts={cumRezolvatOpts}
          user={user}
          profile={profile}
          onClose={() => setShowAddEdit(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['reclamatii'] })
            setShowAddEdit(false)
          }}
          onSavedAndResolve={(newRow) => {
            queryClient.invalidateQueries({ queryKey: ['reclamatii'] })
            setShowAddEdit(false)
            setRezolvaRow(newRow)
          }}
        />
      )}

      {/* ── Modal Config ── */}
      {configModal && (() => {
        const info = getLookupInfo()
        return (
          <LookupConfigModal
            label={info.label}
            table={info.table}
            items={info.items}
            onClose={() => setConfigModal(null)}
            onRefresh={info.refetch}
          />
        )
      })()}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// SimpleReportTable — tabel raport fără coloană valoare
// ══════════════════════════════════════════════════════════════
function SimpleReportTable({ title, subtitle, data, total, renderKey }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-2 text-left   text-xs font-semibold text-gray-500 uppercase">Categorie</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-20">Nr.</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-400 uppercase w-20">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-300 text-xs">Fără date</td></tr>
            ) : data.map(([key, count]) => (
              <tr key={key} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">{renderKey(key)}</td>
                <td className="px-4 py-2.5 text-center font-semibold text-gray-700">{count}</td>
                <td className="px-4 py-2.5 text-center text-xs text-gray-400">
                  {total > 0 ? Math.round(count / total * 100) + '%' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Total</td>
                <td className="px-4 py-2 text-center font-bold text-gray-700">{total}</td>
                <td className="px-4 py-2 text-center text-gray-400">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// CineStatusBar — bară de progres colorată
// ══════════════════════════════════════════════════════════════
function CineStatusBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round(count / total * 100) : 0
  const colors = {
    sky:     { text: 'text-sky-600',     bar: 'bg-sky-500'     },
    red:     { text: 'text-red-600',     bar: 'bg-red-500'     },
    amber:   { text: 'text-amber-500',   bar: 'bg-amber-400'   },
    emerald: { text: 'text-emerald-600', bar: 'bg-emerald-500' },
  }
  const c = colors[color] || colors.sky
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className={`text-sm font-medium ${c.text}`}>{label}</span>
        <span className="text-sm font-bold text-gray-700">{count} / {total}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div className={`${c.bar} h-2.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1">{pct}% din total</p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// RezolvaModal
// ══════════════════════════════════════════════════════════════
function RezolvaModal({ row, cumRezolvatOpts, onClose, onSaved }) {
  const [dataRezolvare, setDataRezolvare] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [cumRezolvat,   setCumRezolvat]   = useState('')
  const [awb,           setAwb]           = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('reclamatii')
      .update({
        data_rezolvare: dataRezolvare,
        ...(cumRezolvat ? { cum_rezolvat: cumRezolvat } : {}),
        ...(awb.trim()  ? { awb: awb.trim() }           : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    setSaving(false)
    if (error) { alert(error.message); return }
    onSaved()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 bg-emerald-50 rounded-t-2xl">
            <div>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-emerald-600" />
                Marchează ca Rezolvată
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">{row.nume_client || 'Reclamație'}</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {row.detalii && (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400 mb-0.5">Detalii reclamație</p>
                <p className="text-sm text-gray-700">{row.detalii}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data rezolvării</label>
                <input
                  type="date"
                  value={dataRezolvare}
                  onChange={e => setDataRezolvare(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AWB</label>
                <input
                  type="text"
                  value={awb}
                  onChange={e => setAwb(e.target.value)}
                  placeholder="ex: 6212113567"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cum am rezolvat</label>
              <select
                value={cumRezolvat}
                onChange={e => setCumRezolvat(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              >
                <option value="">— Selectează soluția —</option>
                {cumRezolvatOpts.map(o => (
                  <option key={o.id} value={o.nume}>{o.nume}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex gap-3 justify-end">
            <button onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              Anulează
            </button>
            <button onClick={handleSave} disabled={saving || !dataRezolvare}
              className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Rezolvă
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// AddEditModal
// ══════════════════════════════════════════════════════════════
function AddEditModal({ row, surse, ceGresitOpts, cumRezolvatOpts, user, profile, onClose, onSaved, onSavedAndResolve }) {
  const isEdit = !!row
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    sursa:           row?.sursa           || '',
    data_reclamatie: row?.data_reclamatie || format(new Date(), 'yyyy-MM-dd'),
    comanda:         row?.comanda         || '',
    nume_client:     row?.nume_client     || '',
    detalii:         row?.detalii         || '',
    ce_gresit:       row?.ce_gresit       || '',
    cine_gresit:     row?.cine_gresit     || '',
    responsabil:     row?.responsabil     || profile?.full_name || '',
    // câmpuri editabile doar în edit mode (setate via Rezolvă la adăugare)
    awb:             row?.awb             || '',
    cum_rezolvat:    row?.cum_rezolvat    || '',
    data_rezolvare:  row?.data_rezolvare  || '',
  })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const sursaOptions = surse.map(s => s.nume)
  if (form.sursa && !sursaOptions.includes(form.sursa)) sursaOptions.unshift(form.sursa)

  const ceGresitOptions = ceGresitOpts.map(c => c.nume)
  if (form.ce_gresit && !ceGresitOptions.includes(form.ce_gresit)) ceGresitOptions.unshift(form.ce_gresit)

  const cumRezolvatOptions = cumRezolvatOpts.map(c => c.nume)
  if (form.cum_rezolvat && !cumRezolvatOptions.includes(form.cum_rezolvat)) cumRezolvatOptions.unshift(form.cum_rezolvat)

  const buildPayload = () => ({
    sursa:           form.sursa                || null,
    data_reclamatie: form.data_reclamatie      || null,
    comanda:         form.comanda.trim()       || null,
    nume_client:     form.nume_client.trim()   || null,
    detalii:         form.detalii.trim()       || null,
    ce_gresit:       form.ce_gresit            || null,
    cine_gresit:     form.cine_gresit          || null,
    responsabil:     form.responsabil.trim()   || null,
    // incluse doar la editare
    ...(isEdit ? {
      awb:           form.awb.trim()           || null,
      cum_rezolvat:  form.cum_rezolvat         || null,
      data_rezolvare: form.data_rezolvare      || null,
    } : {}),
  })

  const handleSave = async () => {
    setSaving(true)
    const payload = buildPayload()
    let error
    if (isEdit) {
      ({ error } = await supabase.from('reclamatii').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', row.id))
    } else {
      ({ error } = await supabase.from('reclamatii').insert({ ...payload, created_by: user?.id }))
    }
    setSaving(false)
    if (error) { alert(error.message); return }
    onSaved()
  }

  const handleSaveAndResolve = async () => {
    setSaving(true)
    const payload = buildPayload()
    const { data: inserted, error } = await supabase
      .from('reclamatii')
      .insert({ ...payload, created_by: user?.id })
      .select()
      .single()
    setSaving(false)
    if (error) { alert(error.message); return }
    onSavedAndResolve(inserted)
  }

  const IC = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400'
  const SC = IC + ' bg-white'
  const LC = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className={`flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 rounded-t-2xl ${isEdit ? 'bg-blue-50' : ''}`}>
            <div>
              <h2 className="font-semibold text-gray-900">{isEdit ? 'Editează Reclamație' : 'Reclamație Nouă'}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{isEdit ? 'Modifică datele înregistrării' : 'Completează datele reclamației'}</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 overflow-y-auto space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LC}>Sursă</label>
                <select value={form.sursa} onChange={set('sursa')} className={SC}>
                  <option value="">— Selectează —</option>
                  {sursaOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={LC}>Cine a greșit?</label>
                <select value={form.cine_gresit} onChange={set('cine_gresit')} className={SC}>
                  <option value="">— Selectează —</option>
                  {CINE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LC}>Data Reclamație</label>
                <input type="date" value={form.data_reclamatie} onChange={set('data_reclamatie')} className={IC} />
              </div>
              <div>
                <label className={LC}>Comandă</label>
                <input type="text" value={form.comanda} onChange={set('comanda')} placeholder="ex: 12345678" className={IC} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LC}>Nume Client</label>
                <input type="text" value={form.nume_client} onChange={set('nume_client')} placeholder="Numele clientului" className={IC} />
              </div>
              <div>
                <label className={LC}>Responsabil</label>
                <input type="text" value={form.responsabil} onChange={set('responsabil')} placeholder="Numele responsabilului" className={IC} />
              </div>
            </div>

            <div>
              <label className={LC}>Detalii despre reclamație</label>
              <textarea rows={3} value={form.detalii} onChange={set('detalii')}
                placeholder="Descrie problema..."
                className={IC + ' resize-none'} />
            </div>

            <div>
              <label className={LC}>Ce a fost greșit</label>
              <select value={form.ce_gresit} onChange={set('ce_gresit')} className={SC}>
                <option value="">— Selectează —</option>
                {ceGresitOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Câmpuri extra — doar la editare */}
            {isEdit && (
              <>
                <div className="border-t border-dashed border-gray-200 pt-4">
                  <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide font-medium">Rezolvare</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={LC}>Data rezolvării</label>
                        <input type="date" value={form.data_rezolvare} onChange={set('data_rezolvare')} className={IC} />
                      </div>
                      <div>
                        <label className={LC}>AWB</label>
                        <input type="text" value={form.awb} onChange={set('awb')} placeholder="ex: 6212113567" className={IC} />
                      </div>
                    </div>
                    <div>
                      <label className={LC}>Cum am rezolvat</label>
                      <select value={form.cum_rezolvat} onChange={set('cum_rezolvat')} className={SC}>
                        <option value="">— Selectează —</option>
                        {cumRezolvatOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex gap-3 justify-end flex-wrap">
            <button onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              Anulează
            </button>
            {!isEdit && (
              <button onClick={handleSaveAndResolve} disabled={saving || !form.data_reclamatie}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <CheckCheck className="w-4 h-4" />
                Salvează și Rezolvă
              </button>
            )}
            <button onClick={handleSave} disabled={saving || !form.data_reclamatie}
              className="px-5 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Salvează' : 'Salvează'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// LookupConfigModal — reutilizabil pentru toate cele 3 dropdown-uri
// ══════════════════════════════════════════════════════════════
function LookupConfigModal({ label, table, items, onClose, onRefresh }) {
  const [newNume,    setNewNume]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const handleAdd = async () => {
    if (!newNume.trim()) return
    setSaving(true); setError('')
    const { error: err } = await supabase.from(table).insert({ nume: newNume.trim(), pozitie: items.length })
    setSaving(false)
    if (err) { setError('Există deja sau eroare la salvare.'); return }
    setNewNume('')
    onRefresh()
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    await supabase.from(table).delete().eq('id', id)
    setDeletingId(null)
    onRefresh()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900">{label}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Administrează lista de valori</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-3">
            <div className="flex gap-2">
              <input type="text" value={newNume}
                onChange={e => setNewNume(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Valoare nouă..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400" />
              <button onClick={handleAdd} disabled={!newNume.trim() || saving}
                className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {items.length === 0
                ? <p className="text-sm text-gray-400 text-center py-4">Nicio valoare adăugată.</p>
                : items.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 gap-2">
                    <span className="text-sm text-gray-800 flex-1">{item.nume}</span>
                    <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id}
                      className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0">
                      {deletingId === item.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
            </div>
          </div>

          <div className="px-5 pb-5 pt-2 border-t border-gray-100">
            <button onClick={onClose}
              className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              Închide
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
