import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import {
  Plus, Save, X, Trash2, Loader2, Wallet,
  TrendingUp, TrendingDown, Settings, CreditCard,
  ChevronLeft, ChevronRight, Calendar, ShieldOff,
} from 'lucide-react'

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

export default function RegistruIncasari() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { canView, canEdit, canDelete, isAdmin } = usePermissions()

  const pView   = canView('registru_incasari')
  const pEdit   = canEdit('registru_incasari')
  const pDelete = canDelete('registru_incasari')

  // ── Filter state ──────────────────────────────────────────
  const [filterType, setFilterType] = useState('current_month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [page, setPage] = useState(1)

  // ── Form state ────────────────────────────────────────────
  const [addingRow,  setAddingRow]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [showFelConfig, setShowFelConfig] = useState(false)

  const emptyForm = {
    data: format(new Date(), 'yyyy-MM-dd'),
    document: '', fel_operatiune: '',
    incasari: '', card: '', plati: '',
    responsabil_id: user?.id || '',
  }
  const [form, setForm] = useState(emptyForm)

  // ── Queries ───────────────────────────────────────────────
  // Toate înregistrările (pentru sold global)
  const { data: allRows = [] } = useQuery({
    queryKey: ['registru_incasari_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registru_incasari')
        .select('incasari, plati')
      if (error) throw error
      return data
    },
  })

  // Înregistrări filtrate (pentru tabel + totaluri perioadă)
  const { from, to } = getDateRange(filterType, customFrom, customTo)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['registru_incasari', filterType, customFrom, customTo],
    queryFn: async () => {
      let q = supabase
        .from('registru_incasari')
        .select('*, responsabil:responsabil_id ( id, full_name )')
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
      if (from) q = q.gte('data', from)
      if (to)   q = q.lte('data', to)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })

  const { data: feluri = [], refetch: refetchFeluri } = useQuery({
    queryKey: ['registru_fel_operatiune'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registru_fel_operatiune')
        .select('*').order('pozitie').order('nume')
      if (error) throw error
      return data
    },
  })

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles').select('id, full_name').order('full_name')
      if (error) throw error
      return data
    },
  })

  // ── Calcule ───────────────────────────────────────────────
  const soldCasaGlobal = allRows.reduce((s, r) =>
    s + (parseFloat(r.incasari) || 0) - (parseFloat(r.plati) || 0), 0)

  const totalIncasari = rows.reduce((s, r) => s + (parseFloat(r.incasari) || 0), 0)
  const totalCard     = rows.reduce((s, r) => s + (parseFloat(r.card)     || 0), 0)
  const totalPlati    = rows.reduce((s, r) => s + (parseFloat(r.plati)    || 0), 0)

  // Frecvență feluri operațiune
  const felFreq = rows.reduce((acc, r) => {
    if (r.fel_operatiune) acc[r.fel_operatiune] = (acc[r.fel_operatiune] || 0) + 1
    return acc
  }, {})
  const feluriSortate = [...feluri].sort((a, b) => (felFreq[b.nume] || 0) - (felFreq[a.nume] || 0))

  // ── Paginare ──────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pagedRows  = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const withNr     = [...rows].reverse().map((r, i) => ({ ...r, nr: i + 1 })).reverse()
  const pagedWithNr = withNr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const goToPage = (p) => setPage(Math.min(Math.max(1, p), totalPages))

  // Reset pagina la schimbarea filtrului
  const handleFilterChange = (key) => {
    setFilterType(key)
    setPage(1)
  }

  // ── Handlers ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.data) return
    setSaving(true)
    const { error } = await supabase.from('registru_incasari').insert({
      data:           form.data,
      document:       form.document.trim() || null,
      fel_operatiune: form.fel_operatiune  || null,
      incasari:       parseFloat(form.incasari) || 0,
      card:           parseFloat(form.card)     || 0,
      plati:          parseFloat(form.plati)    || 0,
      responsabil_id: form.responsabil_id || null,
      created_by:     user.id,
    })
    setSaving(false)
    if (error) { alert(error.message); return }
    queryClient.invalidateQueries({ queryKey: ['registru_incasari'] })
    queryClient.invalidateQueries({ queryKey: ['registru_incasari_all'] })
    setAddingRow(false)
    setForm(emptyForm)
  }

  const handleDelete = async (id) => {
    if (!confirm('Ștergi această înregistrare?')) return
    setDeletingId(id)
    await supabase.from('registru_incasari').delete().eq('id', id)
    setDeletingId(null)
    queryClient.invalidateQueries({ queryKey: ['registru_incasari'] })
    queryClient.invalidateQueries({ queryKey: ['registru_incasari_all'] })
  }

  // ── Acces interzis ──────────────────────────────────────────
  if (!pView) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <ShieldOff className="w-14 h-14 text-gray-300" />
      <p className="text-lg font-semibold text-gray-500">Acces restricționat</p>
      <p className="text-sm text-gray-400">Nu ai permisiunea de a vizualiza Registrul de Încasări.</p>
    </div>
  )

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Titlu ── */}
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900 tracking-widest uppercase">
          Registru Jurnal de Încasări și Plăți
        </h1>
        <div className="mt-1 h-0.5 bg-gray-900 mx-auto w-96" />
      </div>

      {/* ── Carduri sumar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${
          soldCasaGlobal >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
        }`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            soldCasaGlobal >= 0 ? 'bg-blue-100' : 'bg-orange-100'
          }`}>
            <Wallet className={`w-4 h-4 ${soldCasaGlobal >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wide truncate">Sold Casă</p>
            <p className={`text-base font-extrabold truncate ${soldCasaGlobal >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>
              {soldCasaGlobal.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} Lei
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide truncate">Încasări Numerar</p>
            <p className="text-base font-bold text-emerald-600 truncate">
              {totalIncasari.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} Lei
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide truncate">Încasări Card</p>
            <p className="text-base font-bold text-indigo-600 truncate">
              {totalCard.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} Lei
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide truncate">Plăți Numerar</p>
            <p className="text-base font-bold text-red-500 truncate">
              {totalPlati.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} Lei
            </p>
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

        {/* Custom date range */}
        {filterType === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <label className="text-sm text-gray-500">De la:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setPage(1) }}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Până la:</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setPage(1) }}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Acțiuni ── */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-400">
          {rows.length} înregistrări
          {filterType !== 'all' && from && (
            <span className="ml-1 text-gray-300">
              ({from}{to && to !== from ? ` → ${to}` : ''})
            </span>
          )}
        </p>
        <div className="flex gap-2">
          {pEdit && (
            <button
              onClick={() => setShowFelConfig(true)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Felul operațiunii</span>
            </button>
          )}
          {pEdit && !addingRow && (
            <button
              onClick={() => { setForm(emptyForm); setAddingRow(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adaugă înregistrare
            </button>
          )}
        </div>
      </div>

      {/* ── Tabel ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">Nr.</th>
                <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Data</th>
                <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide">Felul Operațiunii</th>
                <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide">Documentul</th>
                <th className="px-3 py-3 text-right  text-xs font-semibold text-emerald-600 uppercase tracking-wide w-28">Încasări</th>
                <th className="px-3 py-3 text-right  text-xs font-semibold text-indigo-600 uppercase tracking-wide w-28">Card</th>
                <th className="px-3 py-3 text-right  text-xs font-semibold text-red-500 uppercase tracking-wide w-28">Plăți</th>
                <th className="px-3 py-3 text-left   text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Responsabil</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>

              {/* ── Rând adăugare ── */}
              {addingRow && (
                <tr className="bg-primary-50 border-b-2 border-primary-200">
                  <td className="px-3 py-2 text-center text-gray-300 text-xs">—</td>
                  <td className="px-2 py-2">
                    <input type="date" value={form.data}
                      onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select value={form.fel_operatiune}
                      onChange={(e) => setForm((f) => ({ ...f, fel_operatiune: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                    >
                      <option value="">— Selectează —</option>
                      {feluriSortate.map((f) => (
                        <option key={f.id} value={f.nume}>
                          {f.nume}{felFreq[f.nume] ? ` (${felFreq[f.nume]}×)` : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input type="text" value={form.document} placeholder="ex: Chitanță 001"
                      onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" step="0.01" value={form.incasari} placeholder="0.00"
                      onChange={(e) => setForm((f) => ({ ...f, incasari: e.target.value }))}
                      className="w-full border border-emerald-300 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" step="0.01" value={form.card} placeholder="0.00"
                      onChange={(e) => setForm((f) => ({ ...f, card: e.target.value }))}
                      className="w-full border border-indigo-300 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" step="0.01" value={form.plati} placeholder="0.00"
                      onChange={(e) => setForm((f) => ({ ...f, plati: e.target.value }))}
                      className="w-full border border-red-300 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select value={form.responsabil_id}
                      onChange={(e) => setForm((f) => ({ ...f, responsabil_id: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                    >
                      <option value="">— Selectează —</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <button onClick={handleSave} disabled={saving || !form.data}
                        className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setAddingRow(false)}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* ── Rânduri paginate ── */}
              {pagedWithNr.length === 0 && !addingRow ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    <Wallet className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    <p>Nicio înregistrare pentru perioada selectată.</p>
                  </td>
                </tr>
              ) : pagedWithNr.map((row, idx) => {
                const inc = parseFloat(row.incasari) || 0
                const crd = parseFloat(row.card)     || 0
                const plt = parseFloat(row.plati)    || 0
                return (
                  <tr key={row.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 !== 0 ? 'bg-gray-50/40' : ''}`}
                  >
                    <td className="px-3 py-3 text-center text-gray-400 font-mono text-xs">{row.nr}</td>
                    <td className="px-3 py-3 text-gray-700 whitespace-nowrap">
                      {format(new Date(row.data + 'T00:00:00'), 'dd.MM.yyyy')}
                    </td>
                    <td className="px-3 py-3">
                      {row.fel_operatiune
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{row.fel_operatiune}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-700">{row.document || '—'}</td>
                    <td className="px-3 py-3 text-right font-mono">
                      {inc > 0 ? <span className="text-emerald-600 font-semibold">{inc.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {crd > 0 ? <span className="text-indigo-600 font-semibold">{crd.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      {plt > 0 ? <span className="text-red-500 font-semibold">{plt.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-sm">{row.responsabil?.full_name || '—'}</td>
                    <td className="px-2 py-3">
                      {pDelete && (
                        <button onClick={() => handleDelete(row.id)} disabled={deletingId === row.id}
                          className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          {deletingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}

              {/* ── Total perioadă ── */}
              {rows.length > 0 && (
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <td colSpan={4} className="px-3 py-3 text-right text-xs uppercase tracking-wide text-gray-500">
                    TOTAL PERIOADĂ
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-emerald-600 font-mono">
                    {totalIncasari.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-indigo-600 font-mono">
                    {totalCard.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-red-500 font-mono">
                    {totalPlati.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Paginare ── */}
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

      {/* ── Modal Felul Operațiunii ── */}
      {showFelConfig && (
        <FelOperatiuneModal
          feluri={feluri}
          onClose={() => setShowFelConfig(false)}
          onRefresh={refetchFeluri}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// FelOperatiuneModal
// ══════════════════════════════════════════════════════════════
function FelOperatiuneModal({ feluri, onClose, onRefresh }) {
  const [newNume, setNewNume]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const handleAdd = async () => {
    if (!newNume.trim()) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('registru_fel_operatiune')
      .insert({ nume: newNume.trim(), pozitie: feluri.length })
    setSaving(false)
    if (err) { setError('Există deja sau eroare la salvare.'); return }
    setNewNume('')
    onRefresh()
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    await supabase.from('registru_fel_operatiune').delete().eq('id', id)
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
              <h2 className="font-semibold text-gray-900">Felul Operațiunii</h2>
              <p className="text-xs text-gray-400 mt-0.5">Administrează lista de tipuri</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex gap-2">
              <input type="text" value={newNume}
                onChange={(e) => setNewNume(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Tip nou..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
              <button onClick={handleAdd} disabled={!newNume.trim() || saving}
                className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {feluri.length === 0
                ? <p className="text-sm text-gray-400 text-center py-4">Niciun tip adăugat.</p>
                : feluri.map((f) => (
                  <div key={f.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
                    <span className="text-sm text-gray-800">{f.nume}</span>
                    <button onClick={() => handleDelete(f.id)} disabled={deletingId === f.id}
                      className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      {deletingId === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
            </div>
          </div>
          <div className="px-5 pb-5 pt-2 border-t border-gray-100">
            <button onClick={onClose} className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              Închide
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
