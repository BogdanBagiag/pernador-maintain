import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ro } from 'date-fns/locale'
import {
  Plus, Save, X, Trash2, Loader2, Settings,
  ChevronLeft, ChevronRight, Calendar, ShieldOff,
  RotateCcw, BarChart2, TableProperties,
  TrendingDown, CheckCircle, Clock, Package, Banknote, Copy, Check, Pencil, Eye, Activity,
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

// ─── Componentă principală ────────────────────────────────────────────────────
export default function Retururi() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const { canView, canEdit, canDelete } = usePermissions()

  const pView   = canView('retururi')
  const pEdit   = canEdit('retururi')
  const pDelete = canDelete('retururi')

  // ── UI state ──────────────────────────────────────────────
  const [filterType,  setFilterType]  = useState('current_month')
  const [customFrom,  setCustomFrom]  = useState('')
  const [customTo,    setCustomTo]    = useState('')
  const [page,        setPage]        = useState(1)
  const [activeTab,   setActiveTab]   = useState('table') // 'table' | 'rapoarte'
  const [showAddModal,    setShowAddModal]    = useState(false)
  const [showSursaConfig, setShowSursaConfig] = useState(false)
  const [deletingId,  setDeletingId]  = useState(null)
  const [platesteRow, setPlatesteRow] = useState(null)
  const [editingRow,  setEditingRow]  = useState(null)
  const [viewRow,     setViewRow]     = useState(null)

  // ── Queries ───────────────────────────────────────────────
  const { from, to } = getDateRange(filterType, customFrom, customTo)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['retururi', filterType, customFrom, customTo],
    queryFn: async () => {
      let q = supabase
        .from('retururi')
        .select('*, responsabil:responsabil_id ( id, full_name )')
        .order('data_cerere', { ascending: false })
        .order('created_at', { ascending: false })
      if (from) q = q.gte('data_cerere', from)
      if (to)   q = q.lte('data_cerere', to)
      const { data, error } = await q
      if (error) throw error
      return data
    },
    enabled: pView,
  })

  const { data: surse = [], refetch: refetchSurse } = useQuery({
    queryKey: ['retururi_sursa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retururi_sursa')
        .select('*').order('pozitie').order('nume')
      if (error) throw error
      return data
    },
    enabled: pView,
  })

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles').select('id, full_name').order('full_name')
      if (error) throw error
      return data
    },
    enabled: pView,
  })

  // ── Calcule sumar ─────────────────────────────────────────
  const totalValoare    = rows.reduce((s, r) => s + (parseFloat(r.valoare) || 0), 0)
  const countAchitate   = rows.filter(r => r.data_plata).length
  const countNeachitate = rows.filter(r => !r.data_plata).length

  // ── Rapoarte ──────────────────────────────────────────────
  const bySursa = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      const key = r.sursa || '(nespecificat)'
      if (!map[key]) map[key] = { count: 0, valoare: 0 }
      map[key].count++
      map[key].valoare += parseFloat(r.valoare) || 0
    })
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count)
  }, [rows])

  const byMotiv = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      const key = r.motiv?.trim() || '(nespecificat)'
      if (!map[key]) map[key] = { count: 0, valoare: 0 }
      map[key].count++
      map[key].valoare += parseFloat(r.valoare) || 0
    })
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count)
  }, [rows])

  const byLuna = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      if (!r.data_cerere) return
      const key = r.data_cerere.slice(0, 7) // 'yyyy-MM'
      if (!map[key]) map[key] = { count: 0, valoare: 0 }
      map[key].count++
      map[key].valoare += parseFloat(r.valoare) || 0
    })
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [rows])

  // ── Paginare ──────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const withNr      = [...rows].reverse().map((r, i) => ({ ...r, nr: i + 1 })).reverse()
  const pagedWithNr = withNr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const goToPage = (p) => setPage(Math.min(Math.max(1, p), totalPages))
  const handleFilterChange = (key) => { setFilterType(key); setPage(1) }

  // ── Log activitate ───────────────────────────────────────
  const logActivity = async (actiune, detalii = null, returId = null) => {
    await supabase.from('retururi_activitate').insert({
      retur_id:  returId,
      user_id:   user?.id,
      user_name: profile?.full_name || user?.email || 'Utilizator',
      actiune,
      detalii,
    })
    queryClient.invalidateQueries({ queryKey: ['retururi_activitate'] })
  }

  // ── Ștergere ──────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Ștergi această înregistrare?')) return
    const row = rows.find(r => r.id === id)
    setDeletingId(id)
    await supabase.from('retururi').delete().eq('id', id)
    setDeletingId(null)
    queryClient.invalidateQueries({ queryKey: ['retururi'] })
    await logActivity('Retur șters', row?.nume_client ? `Client: ${row.nume_client}` : null, id)
  }

  // ── Editare ───────────────────────────────────────────────
  const handleUpdate = async (id, data) => {
    const row = rows.find(r => r.id === id)
    const { error } = await supabase.from('retururi').update(data).eq('id', id)
    if (error) { alert(error.message); return false }
    queryClient.invalidateQueries({ queryKey: ['retururi'] })
    setEditingRow(null)

    // Construiește detalii cu ce s-a modificat
    const LABELS = {
      nume_client: 'Client', valoare: 'Valoare', sursa: 'Sursă',
      motiv: 'Motiv', data_cerere: 'Data cerere', observatii: 'Observații',
      responsabil_id: 'Responsabil',
    }
    const changes = []
    if (row) {
      Object.entries(data).forEach(([key, val]) => {
        const oldVal = row[key]
        if (String(oldVal ?? '') !== String(val ?? '') && LABELS[key]) {
          changes.push(`${LABELS[key]}: "${oldVal ?? '—'}" → "${val ?? '—'}"`)
        }
      })
    }
    const client = data.nume_client || row?.nume_client || null
    const detalii = [
      client ? `Client: ${client}` : null,
      changes.length > 0 ? changes.join(', ') : null,
    ].filter(Boolean).join(' | ') || null

    await logActivity('Retur editat', detalii, id)
    return true
  }

  // ── Marcare plătit ────────────────────────────────────────
  const handleConfirmPlata = async (id, dataPlata) => {
    const { error } = await supabase
      .from('retururi')
      .update({ data_plata: dataPlata })
      .eq('id', id)
    if (error) { alert(error.message); return }
    queryClient.invalidateQueries({ queryKey: ['retururi'] })
    setPlatesteRow(null)
    const row = rows.find(r => r.id === id)
    await logActivity('Marcat ca plătit', row?.nume_client ? `Client: ${row.nume_client}, Data: ${dataPlata}` : `Data: ${dataPlata}`, id)
  }

  // ── Access denied ─────────────────────────────────────────
  if (!pView) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <ShieldOff className="w-14 h-14 text-gray-300" />
      <p className="text-lg font-semibold text-gray-500">Acces restricționat</p>
      <p className="text-sm text-gray-400">Nu ai permisiunea de a vizualiza Retururile.</p>
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
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900 tracking-widest uppercase">
          Registru Retururi
        </h1>
        <div className="mt-1 h-0.5 bg-gray-900 mx-auto w-56" />
      </div>

      {/* ── Carduri sumar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4 text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide truncate">Total Retururi</p>
            <p className="text-base font-bold text-purple-600">{rows.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide truncate">Valoare Totală</p>
            <p className="text-base font-bold text-red-500 truncate">
              {totalValoare.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} Lei
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide truncate">Achitate</p>
            <p className="text-base font-bold text-emerald-600">{countAchitate}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide truncate">Neachitate</p>
            <p className="text-base font-bold text-amber-500">{countNeachitate}</p>
          </div>
        </div>
      </div>

      {/* ── Filtre ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleFilterChange(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterType === opt.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {filterType === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <label className="text-sm text-gray-500">De la:</label>
              <input type="date" value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setPage(1) }}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Până la:</label>
              <input type="date" value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setPage(1) }}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Linkuri rapide ── */}
      <QuickLinksPanel page="retururi" />

      {/* ── Tab-uri + Acțiuni ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'table' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <TableProperties className="w-4 h-4" />
            Înregistrări
            {rows.length > 0 && (
              <span className="ml-1 bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{rows.length}</span>
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
          <button
            onClick={() => setActiveTab('activitate')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'activitate' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            Activitate
          </button>
        </div>

        {activeTab === 'table' && (
          <div className="flex gap-2 flex-wrap">
            {pEdit && (
              <button
                onClick={() => setShowSursaConfig(true)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Surse</span>
              </button>
            )}
            {pEdit && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adaugă retur
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Tab: Tabel ── */}
      {activeTab === 'table' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">Nr.</th>
                  <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide">Sursă</th>
                  <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Data Comenzii</th>
                  <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Data Cererii</th>
                  <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Data Plată</th>
                  <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Nume Client</th>
                  <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefon</th>
                  <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Cont Bancar</th>
                  <th className="px-3 py-3 text-right  text-xs font-semibold text-red-500 uppercase tracking-wide w-24">Valoare</th>
                  <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Fact. Storno</th>
                  <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide">Motiv</th>
                  <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Responsabil</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {pagedWithNr.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-12 text-center text-gray-400">
                      <RotateCcw className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                      <p>Nicio înregistrare pentru perioada selectată.</p>
                    </td>
                  </tr>
                ) : pagedWithNr.map((row) => {
                  const valoare = parseFloat(row.valoare) || 0
                  const achitat = !!row.data_plata
                  return (
                    <tr key={row.id}
                      className={`border-b transition-colors ${
                        achitat
                          ? 'bg-emerald-50/60 border-emerald-100 hover:bg-emerald-50'
                          : 'bg-red-50/40 border-red-100 hover:bg-red-50/70'
                      }`}
                    >
                      <td className="px-3 py-3 text-center text-gray-400 font-mono text-xs">{row.nr}</td>
                      <td className="px-3 py-3">
                        {row.sursa
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 whitespace-nowrap">{row.sursa}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-xs">
                        {row.data_comanda ? format(new Date(row.data_comanda + 'T00:00:00'), 'dd.MM.yyyy') : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap text-xs font-medium">
                        {row.data_cerere ? format(new Date(row.data_cerere + 'T00:00:00'), 'dd.MM.yyyy') : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs">
                        {row.data_plata
                          ? <span className="text-emerald-600 font-medium">{format(new Date(row.data_plata + 'T00:00:00'), 'dd.MM.yyyy')}</span>
                          : <span className="inline-flex items-center gap-1 text-amber-500 font-medium"><Clock className="w-3 h-3" />Neachitat</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{row.nume_client || '—'}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">{row.telefon || '—'}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs font-mono whitespace-nowrap">{row.cont_bancar || '—'}</td>
                      <td className="px-3 py-3 text-right font-mono">
                        {valoare > 0
                          ? <span className="text-red-500 font-semibold">{valoare.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}</span>
                          : <span className="text-gray-200">—</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">{row.factura_storno || '—'}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs max-w-[180px] truncate" title={row.motiv}>{row.motiv || '—'}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">{row.responsabil?.full_name || '—'}</td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewRow(row)}
                            className="p-1 text-gray-300 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Vezi detalii"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {/* Buton Plătește — doar pentru rânduri neachitate */}
                          {pEdit && !row.data_plata && (
                            <button
                              onClick={() => setPlatesteRow(row)}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap"
                              title="Marchează ca plătit"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              Plătește
                            </button>
                          )}
                          {/* Buton Editare */}
                          {pEdit && (
                            <button onClick={() => setEditingRow(row)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editează"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Buton Șterge */}
                          {pDelete && (
                            <button onClick={() => handleDelete(row.id)} disabled={deletingId === row.id}
                              className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Șterge"
                            >
                              {deletingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {/* Total perioadă */}
                {rows.length > 0 && (
                  <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                    <td colSpan={8} className="px-3 py-3 text-right text-xs uppercase tracking-wide text-gray-500">
                      TOTAL PERIOADĂ
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-red-500 font-mono">
                      {totalValoare.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={4} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginare */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-500">
                Pagina <span className="font-semibold">{page}</span> din <span className="font-semibold">{totalPages}</span>
                <span className="ml-2 text-gray-400">({rows.length} total)</span>
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => goToPage(1)} disabled={page === 1}
                  className="px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                >«</button>
                <button onClick={() => goToPage(page - 1)} disabled={page === 1}
                  className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p
                  if (totalPages <= 5) p = i + 1
                  else if (page <= 3) p = i + 1
                  else if (page >= totalPages - 2) p = totalPages - 4 + i
                  else p = page - 2 + i
                  return (
                    <button key={p} onClick={() => goToPage(p)}
                      className={`w-8 h-8 text-sm rounded-lg font-medium transition-colors ${
                        p === page ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >{p}</button>
                  )
                })}
                <button onClick={() => goToPage(page + 1)} disabled={page === totalPages}
                  className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => goToPage(totalPages)} disabled={page === totalPages}
                  className="px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                >»</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Rapoarte ── */}
      {activeTab === 'rapoarte' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* By Sursă */}
          <ReportTable
            title="Retururi pe Sursă"
            subtitle="Distribuție în perioada selectată"
            data={bySursa}
            total={rows.length}
            totalValoare={totalValoare}
            renderKey={(key) => (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{key}</span>
            )}
          />

          {/* By Motiv */}
          <ReportTable
            title="Retururi pe Motiv"
            subtitle="Distribuție în perioada selectată"
            data={byMotiv}
            total={rows.length}
            totalValoare={totalValoare}
            renderKey={(key) => (
              <span className="text-gray-700 text-sm">{key}</span>
            )}
          />

          {/* By Lună */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Evoluție lunară</h3>
              <p className="text-xs text-gray-400 mt-0.5">Retururi grupate pe luni</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2 text-left   text-xs font-semibold text-gray-500 uppercase">Lună</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-20">Nr.</th>
                    <th className="px-4 py-2 text-right  text-xs font-semibold text-red-500 uppercase w-36">Valoare</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-400 uppercase w-20">%</th>
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
                        <td className="px-4 py-2.5 text-center font-semibold text-gray-700">{stats.count}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-red-500 font-semibold">
                          {stats.valoare.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-400">
                          {rows.length > 0 ? Math.round(stats.count / rows.length * 100) + '%' : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {byLuna.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 border-t border-gray-200">
                      <td className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Total</td>
                      <td className="px-4 py-2 text-center font-bold text-gray-700">{rows.length}</td>
                      <td className="px-4 py-2 text-right font-bold text-red-500 font-mono">
                        {totalValoare.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-400">100%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Status Achitare */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Status Achitare</h3>
              <p className="text-xs text-gray-400 mt-0.5">Achitate vs. neachitate în perioada selectată</p>
            </div>
            <div className="p-5 space-y-5">
              <StatusBar
                label="Achitate"
                count={countAchitate}
                total={rows.length}
                color="emerald"
              />
              <StatusBar
                label="Neachitate"
                count={countNeachitate}
                total={rows.length}
                color="amber"
              />
            </div>
          </div>

        </div>
      )}

      {/* ── Tab: Activitate ── */}
      {activeTab === 'activitate' && <ActivitateTab />}

      {/* ── Modal View ── */}
      {viewRow && <ViewReturModal row={viewRow} onClose={() => setViewRow(null)} />}

      {/* ── Modal editare ── */}
      {editingRow && (
        <EditReturModal
          row={editingRow}
          surse={surse}
          profiles={profiles}
          onClose={() => setEditingRow(null)}
          onSaved={handleUpdate}
        />
      )}

      {/* ── Modal Plătește ── */}
      {platesteRow && (
        <PlatesteModal
          row={platesteRow}
          onClose={() => setPlatesteRow(null)}
          onConfirm={handleConfirmPlata}
        />
      )}

      {/* ── Modal adăugare ── */}
      {showAddModal && (
        <AddReturModal
          user={user}
          surse={surse}
          profiles={profiles}
          onClose={() => setShowAddModal(false)}
          onSaved={(newRow) => {
            queryClient.invalidateQueries({ queryKey: ['retururi'] })
            setShowAddModal(false)
            logActivity('Retur adăugat', newRow?.nume_client ? `Client: ${newRow.nume_client}` : null, newRow?.id)
          }}
        />
      )}

      {/* ── Modal surse ── */}
      {showSursaConfig && (
        <SursaModal
          surse={surse}
          onClose={() => setShowSursaConfig(false)}
          onRefresh={refetchSurse}
        />
      )}
    </div>
  )
}

// ─── Sub-componente rapoarte ──────────────────────────────────────────────────
function ReportTable({ title, subtitle, data, total, totalValoare, renderKey }) {
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
              <th className="px-4 py-2 text-right  text-xs font-semibold text-red-500 uppercase w-36">Valoare</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-400 uppercase w-20">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-300 text-xs">Fără date</td></tr>
            ) : data.map(([key, stats]) => (
              <tr key={key} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">{renderKey(key)}</td>
                <td className="px-4 py-2.5 text-center font-semibold text-gray-700">{stats.count}</td>
                <td className="px-4 py-2.5 text-right font-mono text-red-500 font-semibold">
                  {stats.valoare.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2.5 text-center text-xs text-gray-400">
                  {total > 0 ? Math.round(stats.count / total * 100) + '%' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Total</td>
                <td className="px-4 py-2 text-center font-bold text-gray-700">{total}</td>
                <td className="px-4 py-2 text-right font-bold text-red-500 font-mono">
                  {totalValoare.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2 text-center text-gray-400">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

function StatusBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round(count / total * 100) : 0
  const colors = {
    emerald: { text: 'text-emerald-600', bar: 'bg-emerald-500' },
    amber:   { text: 'text-amber-500',   bar: 'bg-amber-400'   },
  }
  const c = colors[color] || colors.emerald
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

// ─── Tab Activitate ──────────────────────────────────────────────────────────
function ActivitateTab() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['retururi_activitate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retururi_activitate')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data
    },
    refetchInterval: 30_000,
  })

  const actionColor = (actiune) => {
    if (actiune.includes('adăugat'))  return 'bg-green-100 text-green-700'
    if (actiune.includes('editat'))   return 'bg-blue-100 text-blue-700'
    if (actiune.includes('șters'))    return 'bg-red-100 text-red-700'
    if (actiune.includes('plătit'))   return 'bg-emerald-100 text-emerald-700'
    return 'bg-gray-100 text-gray-600'
  }

  const actionIcon = (actiune) => {
    if (actiune.includes('adăugat'))  return '➕'
    if (actiune.includes('editat'))   return '✏️'
    if (actiune.includes('șters'))    return '🗑️'
    if (actiune.includes('plătit'))   return '💰'
    return '📋'
  }

  if (isLoading) return <div className="py-12 text-center text-sm text-gray-400">Se încarcă...</div>

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Activity className="w-4 h-4 text-gray-400" />
        <h3 className="font-semibold text-gray-800">Jurnal activitate</h3>
        <span className="ml-auto text-xs text-gray-400">{logs.length} înregistrări</span>
      </div>

      {logs.length === 0 ? (
        <div className="py-16 text-center">
          <Activity className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400 italic">Nicio activitate înregistrată încă</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/60 transition-colors">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold flex-shrink-0 mt-0.5">
                {(log.user_name || '?')[0].toUpperCase()}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{log.user_name || 'Utilizator'}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${actionColor(log.actiune)}`}>
                    {actionIcon(log.actiune)} {log.actiune}
                  </span>
                </div>
                {log.detalii && (
                  <p className="text-xs text-gray-400 mt-0.5">{log.detalii}</p>
                )}
              </div>
              {/* Timp */}
              <div className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                {log.created_at ? format(new Date(log.created_at), 'dd.MM.yyyy HH:mm') : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modal View ─────────────────────────────────────────────────────────────
function ViewReturModal({ row, onClose }) {
  const achitat = !!row.data_plata
  const valoare = parseFloat(row.valoare) || 0

  const Field = ({ label, value, full = false }) => (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value || '—'}</p>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-purple-500" />
            <h2 className="font-semibold text-gray-900">Retur #{row.nr}</h2>
            {achitat
              ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" /> Achitat
                </span>
              : <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" /> Neachitat
                </span>
            }
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          {row.sursa && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Sursă</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{row.sursa}</span>
            </div>
          )}
          <Field label="Responsabil"   value={row.responsabil?.full_name} />
          <Field label="Data comandă"  value={row.data_comanda  ? format(new Date(row.data_comanda  + 'T00:00:00'), 'dd.MM.yyyy') : null} />
          <Field label="Data cerere"   value={row.data_cerere   ? format(new Date(row.data_cerere   + 'T00:00:00'), 'dd.MM.yyyy') : null} />
          <Field label="Data plată"    value={row.data_plata    ? format(new Date(row.data_plata    + 'T00:00:00'), 'dd.MM.yyyy') : null} />
          <Field label="Valoare"       value={valoare > 0 ? `${valoare.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON` : null} />
          <Field label="Client"        value={row.nume_client} />
          <Field label="Telefon"       value={row.telefon} />
          <Field label="Cont bancar"   value={row.cont_bancar} />
          <Field label="Factură storno" value={row.factura_storno} />
          <Field label="Motiv"         value={row.motiv} full />
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-200">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            Închide
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Plătește ──────────────────────────────────────────────────────────
function PlatesteModal({ row, onClose, onConfirm }) {
  const [dataPlata, setDataPlata] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving,    setSaving]    = useState(false)
  const [copied,    setCopied]    = useState(null) // cheie câmp copiat

  const handleConfirm = async () => {
    if (!dataPlata) return
    setSaving(true)
    await onConfirm(row.id, dataPlata)
    setSaving(false)
  }

  const copyToClipboard = (value, key) => {
    if (!value) return
    navigator.clipboard.writeText(String(value))
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const valoare = parseFloat(row.valoare) || 0
  const valoareStr = valoare.toLocaleString('ro-RO', { minimumFractionDigits: 2 }) + ' Lei'

  // Câmpuri afișate în ordine cu buton copy
  const fields = [
    { key: 'nume',    label: 'Nume client',     value: row.nume_client,    mono: false },
    { key: 'cont',    label: 'Cont bancar',      value: row.cont_bancar,    mono: true  },
    { key: 'suma',    label: 'Sumă de plată',    value: valoareStr,         mono: false, copyRaw: String(valoare) },
    { key: 'storno',  label: 'Factură storno',   value: row.factura_storno, mono: false },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Banknote className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Confirmă plata</h2>
              {row.sursa && (
                <span className="text-xs text-purple-600 font-medium">{row.sursa}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Câmpuri cu copy */}
          <div className="space-y-2">
            {fields.map(({ key, label, value, mono, copyRaw }) => (
              <div key={key} className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 border ${
                value ? 'bg-gray-50 border-gray-200' : 'bg-gray-50/40 border-gray-100'
              }`}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">{label}</p>
                  {value
                    ? <p className={`text-sm font-semibold text-gray-800 break-all ${mono ? 'font-mono' : ''} ${key === 'suma' ? 'text-red-600 text-base' : ''}`}>
                        {value}
                      </p>
                    : <p className="text-sm text-gray-300 italic">Necompletat</p>
                  }
                </div>
                <button
                  onClick={() => copyToClipboard(copyRaw ?? value, key)}
                  disabled={!value}
                  title={copied === key ? 'Copiat!' : `Copiază ${label}`}
                  className={`flex-shrink-0 p-2 rounded-lg transition-all ${
                    !value
                      ? 'text-gray-200 cursor-not-allowed'
                      : copied === key
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                  }`}
                >
                  {copied === key
                    ? <Check className="w-4 h-4" />
                    : <Copy className="w-4 h-4" />
                  }
                </button>
              </div>
            ))}
          </div>

          {/* Data plată */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Data la care s-a efectuat plata
            </label>
            <input
              type="date"
              value={dataPlata}
              onChange={e => setDataPlata(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Anulează
          </button>
          <button type="button" onClick={handleConfirm} disabled={saving || !dataPlata}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Confirmă plata
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal adăugare retur ─────────────────────────────────────────────────────
function AddReturModal({ user, surse, profiles, onClose, onSaved }) {
  const [form, setForm] = useState({
    sursa:          '',
    data_comanda:   '',
    data_cerere:    format(new Date(), 'yyyy-MM-dd'),
    data_plata:     '',
    nume_client:    '',
    telefon:        '',
    cont_bancar:    '',
    valoare:        '',
    factura_storno: '',
    motiv:          '',
    responsabil_id: user?.id || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const setF = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const handleSave = async () => {
    if (!form.data_cerere) { setError('Data cererii este obligatorie.'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('retururi').insert({
      sursa:          form.sursa          || null,
      data_comanda:   form.data_comanda   || null,
      data_cerere:    form.data_cerere,
      data_plata:     form.data_plata     || null,
      nume_client:    form.nume_client.trim()    || null,
      telefon:        form.telefon.trim()        || null,
      cont_bancar:    form.cont_bancar.trim()    || null,
      valoare:        parseFloat(form.valoare)   || 0,
      factura_storno: form.factura_storno.trim() || null,
      motiv:          form.motiv.trim()          || null,
      responsabil_id: form.responsabil_id        || null,
      created_by:     user.id,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <RotateCcw className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Adaugă retur nou</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Sursa */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sursă</label>
              <select value={form.sursa} onChange={e => setF('sursa', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 bg-white"
              >
                <option value="">— Selectează —</option>
                {surse.map(s => <option key={s.id} value={s.nume}>{s.nume}</option>)}
              </select>
            </div>

            {/* Valoare */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Valoare (Lei)</label>
              <input type="number" min="0" step="0.01" value={form.valoare} placeholder="0.00"
                onChange={e => setF('valoare', e.target.value)}
                className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm text-right outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>

            {/* Data Comenzii */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data Comenzii</label>
              <input type="date" value={form.data_comanda}
                onChange={e => setF('data_comanda', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            {/* Data Cererii */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Data Cererii <span className="text-red-400">*</span>
              </label>
              <input type="date" value={form.data_cerere}
                onChange={e => setF('data_cerere', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            {/* Data Plată */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Când a fost făcută plata?</label>
              <input type="date" value={form.data_plata}
                onChange={e => setF('data_plata', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
              <p className="text-xs text-gray-400 mt-0.5">Lasă gol dacă plata nu a fost efectuată.</p>
            </div>

            {/* Factură Storno */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Factură Storno</label>
              <input type="text" value={form.factura_storno} placeholder="nr. factură storno"
                onChange={e => setF('factura_storno', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            {/* Nume Client */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nume Client</label>
              <input type="text" value={form.nume_client} placeholder="Prenume Nume"
                onChange={e => setF('nume_client', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            {/* Telefon */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Telefon</label>
              <input type="text" value={form.telefon} placeholder="07xx xxx xxx"
                onChange={e => setF('telefon', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            {/* Cont Bancar */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cont Bancar</label>
              <input type="text" value={form.cont_bancar} placeholder="RO xx XXXX ..."
                onChange={e => setF('cont_bancar', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            {/* Motiv */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Motiv retur</label>
              <textarea value={form.motiv} placeholder="Descrieți motivul returului..."
                onChange={e => setF('motiv', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              />
            </div>

            {/* Responsabil */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Responsabil</label>
              <select value={form.responsabil_id} onChange={e => setF('responsabil_id', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 bg-white"
              >
                <option value="">— Selectează —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Anulează
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !form.data_cerere}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvează
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal editare retur ──────────────────────────────────────────────────────
function EditReturModal({ row, surse, profiles, onClose, onSaved }) {
  const [form, setForm] = useState({
    sursa:          row.sursa          || '',
    data_comanda:   row.data_comanda   || '',
    data_cerere:    row.data_cerere    || '',
    data_plata:     row.data_plata     || '',
    nume_client:    row.nume_client    || '',
    telefon:        row.telefon        || '',
    cont_bancar:    row.cont_bancar    || '',
    valoare:        row.valoare != null ? String(row.valoare) : '',
    factura_storno: row.factura_storno || '',
    motiv:          row.motiv          || '',
    responsabil_id: row.responsabil_id || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const setF = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const handleSave = async () => {
    if (!form.data_cerere) { setError('Data cererii este obligatorie.'); return }
    setSaving(true)
    setError('')
    const ok = await onSaved(row.id, {
      sursa:          form.sursa          || null,
      data_comanda:   form.data_comanda   || null,
      data_cerere:    form.data_cerere,
      data_plata:     form.data_plata     || null,
      nume_client:    form.nume_client.trim()    || null,
      telefon:        form.telefon.trim()        || null,
      cont_bancar:    form.cont_bancar.trim()    || null,
      valoare:        parseFloat(form.valoare)   || 0,
      factura_storno: form.factura_storno.trim() || null,
      motiv:          form.motiv.trim()          || null,
      responsabil_id: form.responsabil_id        || null,
    })
    setSaving(false)
    if (!ok) setError('Eroare la salvare. Încearcă din nou.')
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Pencil className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Editează retur</h2>
              {row.nume_client && (
                <p className="text-sm text-gray-400">{row.nume_client}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sursă</label>
              <select value={form.sursa} onChange={e => setF('sursa', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 bg-white"
              >
                <option value="">— Selectează —</option>
                {surse.map(s => <option key={s.id} value={s.nume}>{s.nume}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Valoare (Lei)</label>
              <input type="number" min="0" step="0.01" value={form.valoare} placeholder="0.00"
                onChange={e => setF('valoare', e.target.value)}
                className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm text-right outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Data Comenzii</label>
              <input type="date" value={form.data_comanda}
                onChange={e => setF('data_comanda', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Data Cererii <span className="text-red-400">*</span>
              </label>
              <input type="date" value={form.data_cerere}
                onChange={e => setF('data_cerere', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Când a fost făcută plata?</label>
              <input type="date" value={form.data_plata}
                onChange={e => setF('data_plata', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
              <p className="text-xs text-gray-400 mt-0.5">Lasă gol dacă plata nu a fost efectuată.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Factură Storno</label>
              <input type="text" value={form.factura_storno} placeholder="nr. factură storno"
                onChange={e => setF('factura_storno', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nume Client</label>
              <input type="text" value={form.nume_client} placeholder="Prenume Nume"
                onChange={e => setF('nume_client', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Telefon</label>
              <input type="text" value={form.telefon} placeholder="07xx xxx xxx"
                onChange={e => setF('telefon', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cont Bancar</label>
              <input type="text" value={form.cont_bancar} placeholder="RO xx XXXX ..."
                onChange={e => setF('cont_bancar', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Motiv retur</label>
              <textarea value={form.motiv} placeholder="Descrieți motivul returului..."
                onChange={e => setF('motiv', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Responsabil</label>
              <select value={form.responsabil_id} onChange={e => setF('responsabil_id', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 bg-white"
              >
                <option value="">— Selectează —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Anulează
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !form.data_cerere}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvează modificările
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Surse ──────────────────────────────────────────────────────────────
function SursaModal({ surse, onClose, onRefresh }) {
  const [newNume,    setNewNume]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const handleAdd = async () => {
    if (!newNume.trim()) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('retururi_sursa')
      .insert({ nume: newNume.trim(), pozitie: surse.length })
    setSaving(false)
    if (err) { setError('Există deja sau eroare la salvare.'); return }
    setNewNume('')
    onRefresh()
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    await supabase.from('retururi_sursa').delete().eq('id', id)
    setDeletingId(null)
    onRefresh()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Gestionare Surse</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Adaugă */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newNume}
              onChange={(e) => setNewNume(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Numele sursei (ex: eMAG, Altex...)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
            />
            <button onClick={handleAdd} disabled={saving || !newNume.trim()}
              className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Listă */}
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto rounded-lg border border-gray-200">
            {surse.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nicio sursă adăugată.</p>
            ) : surse.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                <span className="text-sm text-gray-700">{s.nume}</span>
                <button onClick={() => handleDelete(s.id)} disabled={deletingId === s.id}
                  className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  {deletingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-200">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Închide
          </button>
        </div>
      </div>
    </div>
  )
}
