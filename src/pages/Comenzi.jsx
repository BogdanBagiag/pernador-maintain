import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { format } from 'date-fns'
import {
  Plus, X, Save, Loader2, Printer, ShoppingCart,
  Users, Package, BarChart2, Pencil, Trash2, Check,
  ShieldOff, Search,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
const STATUSES = [
  { key: 'noi',      label: 'Noi',      bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  { key: 'in_lucru', label: 'În lucru', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  { key: 'livrate',  label: 'Livrate',  bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500'  },
]
const ROWS_PER_PAGE = 13

// ═════════════════════════════════════════════════════════════
// Main page
// ═════════════════════════════════════════════════════════════
export default function Comenzi() {
  const { canView, canEdit, canDelete } = usePermissions()
  const [tab, setTab] = useState('comenzi')

  if (!canView('comenzi')) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <ShieldOff className="w-14 h-14 text-gray-300" />
      <p className="text-lg font-semibold text-gray-500">Acces restricționat</p>
      <p className="text-sm text-gray-400">Nu ai permisiunea de a vizualiza Comenzi.</p>
    </div>
  )

  const pEdit   = canEdit('comenzi')
  const pDelete = canDelete('comenzi')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-primary-600" />
          Comenzi
        </h1>
        <p className="text-sm text-gray-500 mt-1">Gestionează comenzile și clienții</p>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6">
          {[
            { key: 'comenzi',  label: 'Comenzi',  icon: ShoppingCart },
            { key: 'clienti',  label: 'Clienți',  icon: Users },
            { key: 'produse',  label: 'Produse',  icon: Package },
            { key: 'rapoarte', label: 'Rapoarte', icon: BarChart2 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                tab === key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'comenzi'  && <ComenziTab  pEdit={pEdit} pDelete={pDelete} />}
      {tab === 'clienti'  && <ClientiTab  pEdit={pEdit} pDelete={pDelete} />}
      {tab === 'produse'  && <ProduseTab  pEdit={pEdit} pDelete={pDelete} />}
      {tab === 'rapoarte' && <RapoarteTab />}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// ComenziTab — Kanban
// ═════════════════════════════════════════════════════════════
function ComenziTab({ pEdit, pDelete }) {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingComanda, setEditingComanda] = useState(null)

  const { data: comenzi = [], isLoading } = useQuery({
    queryKey: ['com_comenzi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('com_comenzi')
        .select('*, com_clienti(denumire), com_linii(id)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const moveStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('com_comenzi').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['com_comenzi'] }),
  })

  const deleteComanda = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('com_comenzi').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['com_comenzi'] }),
  })

  const openEdit = (c) => { setEditingComanda(c); setShowModal(true) }

  if (isLoading) return <div className="py-12 text-center text-sm text-gray-400">Se încarcă...</div>

  return (
    <>
      <div className="flex justify-end mb-4">
        {pEdit && (
          <button
            onClick={() => { setEditingComanda(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Comandă nouă
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {STATUSES.map((st, si) => {
          const cards = comenzi.filter(c => c.status === st.key)
          return (
            <div key={st.key} className={`rounded-xl border ${st.border} ${st.bg} p-3 min-h-[200px]`}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
                <h3 className={`text-sm font-semibold ${st.text}`}>{st.label}</h3>
                <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.text} border ${st.border}`}>
                  {cards.length}
                </span>
              </div>

              <div className="space-y-2">
                {cards.map(c => (
                  <ComandaCard
                    key={c.id}
                    comanda={c}
                    statusIndex={si}
                    totalStatuses={STATUSES.length}
                    pEdit={pEdit}
                    pDelete={pDelete}
                    onOpen={() => openEdit(c)}
                    onMove={(newStatus) => moveStatus.mutate({ id: c.id, status: newStatus })}
                    onDelete={() => {
                      if (confirm(`Ștergi comanda pentru ${c.com_clienti?.denumire || ''}?`))
                        deleteComanda.mutate(c.id)
                    }}
                  />
                ))}
                {cards.length === 0 && (
                  <div className="text-center py-10 text-xs text-gray-400 italic">Nicio comandă</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <ComandaModal
          comanda={editingComanda}
          onClose={() => { setShowModal(false); setEditingComanda(null) }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['com_comenzi'] })
            setShowModal(false)
            setEditingComanda(null)
          }}
          pEdit={pEdit}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
function ComandaCard({ comanda, statusIndex, pEdit, pDelete, onOpen, onMove, onDelete }) {
  const prevSt = statusIndex > 0 ? STATUSES[statusIndex - 1] : null
  const nextSt = statusIndex < STATUSES.length - 1 ? STATUSES[statusIndex + 1] : null
  const nrProduse = comanda.com_linii?.length || 0

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-sm transition-shadow group"
      onClick={onOpen}
    >
      <p className="font-semibold text-gray-900 text-sm truncate">
        {comanda.com_clienti?.denumire || '—'}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">
        {comanda.data ? format(new Date(comanda.data), 'dd.MM.yyyy') : '—'}
        {nrProduse > 0 && ` · ${nrProduse} prod.`}
      </p>
      {comanda.transport && (
        <p className="text-xs text-gray-500 truncate mt-0.5">🚚 {comanda.transport}</p>
      )}

      {pEdit && (
        <div
          className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          {prevSt && (
            <button
              onClick={() => onMove(prevSt.key)}
              className="text-xs px-2 py-0.5 text-gray-500 hover:bg-gray-100 rounded"
            >← {prevSt.label}</button>
          )}
          <div className="flex-1" />
          {nextSt && (
            <button
              onClick={() => onMove(nextSt.key)}
              className="text-xs px-2 py-0.5 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded"
            >{nextSt.label} →</button>
          )}
          {pDelete && (
            <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-500 rounded">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// ComandaModal
// ═════════════════════════════════════════════════════════════
function ComandaModal({ comanda, onClose, onSaved, pEdit }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Header state
  const [clientId,   setClientId]   = useState(comanda?.client_id || '')
  const [transport,  setTransport]  = useState(comanda?.transport || '')
  const [nrColete,   setNrColete]   = useState(comanda?.nr_colete || '')
  const [data,       setData]       = useState(comanda?.data || format(new Date(), 'yyyy-MM-dd'))
  const [genti,      setGenti]      = useState(comanda?.genti || '')

  // Bottom checkboxes
  const [etichetaCusuta, setEtichetaCusuta] = useState(comanda?.eticheta_cusuta ?? false)
  const [etichetaColt,   setEtichetaColt]   = useState(comanda?.eticheta_colt   ?? false)
  const [etichetaPunga,  setEtichetaPunga]  = useState(comanda?.eticheta_punga  ?? false)
  const [geantaTnt,      setGeantaTnt]      = useState(comanda?.geanta_tnt      ?? false)

  const [saving, setSaving] = useState(false)

  const emptyLine = () => ({ id: null, produs_text: '', dimensiune: '', cantitate: 1, model: '', croit: false, cusut: false, produs_ok: false, livrat: false })
  const [linii, setLinii] = useState([emptyLine(), emptyLine(), emptyLine()])

  // Fetch clients + products
  const { data: clienti = [] } = useQuery({
    queryKey: ['com_clienti'],
    queryFn: async () => {
      const { data, error } = await supabase.from('com_clienti').select('*').order('denumire')
      if (error) throw error
      return data
    },
  })
  const { data: produseCatalog = [] } = useQuery({
    queryKey: ['com_produse'],
    queryFn: async () => {
      const { data, error } = await supabase.from('com_produse').select('*').order('denumire')
      if (error) throw error
      return data
    },
  })

  // Load lines if editing
  useEffect(() => {
    if (!comanda?.id) return
    supabase.from('com_linii').select('*').eq('comanda_id', comanda.id).order('pozitie')
      .then(({ data }) => {
        if (!data) return
        const loaded = data.map(l => ({
          id: l.id,
          produs_text: l.produs_text || '',
          dimensiune:  l.dimensiune  || '',
          cantitate:   l.cantitate   || 1,
          model:       l.model       || '',
          croit:       l.croit       || false,
          cusut:       l.cusut       || false,
          produs_ok:   l.produs_ok   || false,
          livrat:      l.livrat      || false,
        }))
        while (loaded.length < 3) loaded.push(emptyLine())
        setLinii(loaded)
      })
  }, [comanda?.id])

  const updateLine = (idx, field, val) => {
    setLinii(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l))
  }

  // Auto-save production checkbox immediately (only if order already saved)
  const autoSaveCheck = async (lineId, field, val) => {
    if (!lineId) return
    await supabase.from('com_linii').update({ [field]: val }).eq('id', lineId)
  }

  const handleSave = async () => {
    if (!clientId) { alert('Selectează un client!'); return }
    setSaving(true)
    try {
      let comandaId = comanda?.id
      const payload = {
        client_id:       clientId,
        transport:       transport.trim()  || null,
        nr_colete:       nrColete.trim()   || null,
        data,
        genti:           genti.trim()      || null,
        eticheta_cusuta: etichetaCusuta,
        eticheta_colt:   etichetaColt,
        eticheta_punga:  etichetaPunga,
        geanta_tnt:      geantaTnt,
      }

      if (comandaId) {
        const { error } = await supabase.from('com_comenzi').update(payload).eq('id', comandaId)
        if (error) throw error
      } else {
        const { data: nd, error } = await supabase.from('com_comenzi')
          .insert({ ...payload, created_by: user.id, status: 'noi' })
          .select().single()
        if (error) throw error
        comandaId = nd.id
      }

      // Delete all existing lines and re-insert
      await supabase.from('com_linii').delete().eq('comanda_id', comandaId)

      const validLinii = linii.filter(l => l.produs_text.trim())
      if (validLinii.length > 0) {
        // Auto-add new products to catalog
        for (const l of validLinii) {
          const name = l.produs_text.trim()
          const exists = produseCatalog.some(p => p.denumire.toLowerCase() === name.toLowerCase())
          if (!exists) {
            await supabase.from('com_produse').insert({ denumire: name })
          }
        }
        const { error: liniiErr } = await supabase.from('com_linii').insert(
          validLinii.map((l, i) => ({
            comanda_id:  comandaId,
            produs_text: l.produs_text.trim(),
            dimensiune:  l.dimensiune.trim()  || null,
            cantitate:   parseInt(l.cantitate) || 1,
            model:       l.model.trim()        || null,
            croit:       l.croit,
            cusut:       l.cusut,
            produs_ok:   l.produs_ok,
            livrat:      l.livrat,
            pozitie:     i,
          }))
        )
        if (liniiErr) throw liniiErr
      }

      queryClient.invalidateQueries({ queryKey: ['com_produse'] })
      onSaved()
    } catch (err) {
      alert('Eroare la salvare: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = () => window.print()

  const clientName = clienti.find(c => c.id === clientId)?.denumire || ''
  const validPrintLinii = linii.filter(l => l.produs_text.trim())

  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          #comanda-print-area { display: block !important; }
          @page { size: A5 portrait; margin: 7mm; }
        }
        #comanda-print-area { display: none; }
      `}</style>

      {/* Print area */}
      <div id="comanda-print-area">
        <PrintLayout
          clientName={clientName}
          transport={transport}
          nrColete={nrColete}
          data={data}
          genti={genti}
          linii={validPrintLinii}
          etichetaCusuta={etichetaCusuta}
          etichetaColt={etichetaColt}
          etichetaPunga={etichetaPunga}
          geantaTnt={geantaTnt}
        />
      </div>

      {/* Modal */}
      <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-4">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">
              {comanda ? 'Editează Comandă' : 'Comandă Nouă'}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Printer className="w-4 h-4" /> Print A5
              </button>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* ── Header fields ── */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Client <span className="text-red-400">*</span>
                </label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  disabled={!pEdit}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-gray-50"
                >
                  <option value="">Selectează client...</option>
                  {clienti.map(c => <option key={c.id} value={c.id}>{c.denumire}</option>)}
                </select>
              </div>
              {[
                { label: 'Transport', val: transport, set: setTransport },
                { label: 'Nr. Colete', val: nrColete, set: setNrColete },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{label}</label>
                  <input
                    type="text" value={val}
                    onChange={e => set(e.target.value)}
                    readOnly={!pEdit}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 read-only:bg-gray-50"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Data</label>
                <input
                  type="date" value={data}
                  onChange={e => setData(e.target.value)}
                  readOnly={!pEdit}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 read-only:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Genți
                </label>
                <input
                  type="text" value={genti}
                  onChange={e => setGenti(e.target.value)}
                  readOnly={!pEdit}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 read-only:bg-gray-50"
                />
              </div>
            </div>

            {/* ── Products table ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase">Produse</span>
                {pEdit && (
                  <button
                    onClick={() => setLinii(prev => [...prev, emptyLine()])}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adaugă rând
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 min-w-[160px]">Produs</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-24">Dimensiune</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 w-14">Cant.</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-28">Model</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-red-500 w-14">Croit</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-red-500 w-14">Cusut</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 w-14">Produs</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 w-14">Livrat</th>
                      {pEdit && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {linii.map((l, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/80">
                        <td className="px-2 py-1.5">
                          {pEdit
                            ? <ProductInput value={l.produs_text} catalog={produseCatalog} onChange={v => updateLine(idx, 'produs_text', v)} />
                            : <span className="text-sm text-gray-800 px-1">{l.produs_text}</span>
                          }
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" value={l.dimensiune}
                            onChange={e => updateLine(idx, 'dimensiune', e.target.value)}
                            readOnly={!pEdit}
                            className="w-full border-0 bg-transparent text-sm outline-none focus:ring-1 focus:ring-primary-300 rounded px-1"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="1" value={l.cantitate}
                            onChange={e => updateLine(idx, 'cantitate', e.target.value)}
                            readOnly={!pEdit}
                            className="w-full border-0 bg-transparent text-sm text-center outline-none focus:ring-1 focus:ring-primary-300 rounded px-1"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" value={l.model}
                            onChange={e => updateLine(idx, 'model', e.target.value)}
                            readOnly={!pEdit}
                            className="w-full border-0 bg-transparent text-sm outline-none focus:ring-1 focus:ring-primary-300 rounded px-1"
                          />
                        </td>
                        {/* Production checkboxes — always editable */}
                        {[
                          { field: 'croit',     color: 'text-red-500' },
                          { field: 'cusut',     color: 'text-red-500' },
                          { field: 'produs_ok', color: 'text-gray-600' },
                          { field: 'livrat',    color: 'text-gray-600' },
                        ].map(({ field, color }) => (
                          <td key={field} className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={l[field]}
                              onChange={e => {
                                updateLine(idx, field, e.target.checked)
                                autoSaveCheck(l.id, field, e.target.checked)
                              }}
                              className={`w-4 h-4 rounded cursor-pointer ${color}`}
                            />
                          </td>
                        ))}
                        {pEdit && (
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => setLinii(prev => prev.filter((_, i) => i !== idx))}
                              className="text-gray-300 hover:text-red-500 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Bottom checkboxes ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-orange-50 rounded-xl border border-orange-100">
              <div className="space-y-2">
                {[
                  { label: 'Eticheta personalizata cusuta', val: etichetaCusuta, set: setEtichetaCusuta },
                  { label: 'Eticheta personalizata in punga', val: etichetaPunga, set: setEtichetaPunga },
                  { label: 'Geanta TNT', val: geantaTnt, set: setGeantaTnt },
                ].map(({ label, val, set }) => (
                  <label key={label} className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={val} onChange={e => set(e.target.checked)}
                      disabled={!pEdit}
                      className="w-4 h-4 rounded text-orange-500 cursor-pointer"
                    />
                    <span className="text-sm text-orange-700 font-medium">{label}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={etichetaColt} onChange={e => setEtichetaColt(e.target.checked)}
                    disabled={!pEdit}
                    className="w-4 h-4 rounded text-orange-500 cursor-pointer"
                  />
                  <span className="text-sm text-orange-700 font-medium">Eticheta pe colt</span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          {pEdit && (
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                Anulează
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvează
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Product autocomplete
// ─────────────────────────────────────────────────────────────
function ProductInput({ value, catalog, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const filtered = value.trim()
    ? catalog.filter(p => p.denumire.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : []

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <input
        type="text" value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Produs..."
        className="w-full border-0 bg-transparent text-sm outline-none focus:ring-1 focus:ring-primary-300 rounded px-1"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 z-50 w-56 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {filtered.map(p => (
            <button key={p.id}
              onMouseDown={() => { onChange(p.denumire); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-primary-50 hover:text-primary-700"
            >
              {p.denumire}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// PrintLayout — A5
// ═════════════════════════════════════════════════════════════
function PrintLayout({ clientName, transport, nrColete, data, genti, linii, etichetaCusuta, etichetaColt, etichetaPunga, geantaTnt }) {
  // Fill with empty rows to at least ROWS_PER_PAGE per page
  const allRows = [...linii]
  const needed = Math.max(ROWS_PER_PAGE, Math.ceil(allRows.length / ROWS_PER_PAGE) * ROWS_PER_PAGE)
  while (allRows.length < needed) {
    allRows.push({ produs_text: '', dimensiune: '', cantitate: '', model: '', croit: false, cusut: false, produs_ok: false, livrat: false })
  }

  const pages = []
  for (let i = 0; i < allRows.length; i += ROWS_PER_PAGE) {
    pages.push(allRows.slice(i, i + ROWS_PER_PAGE))
  }

  const tdStyle = (extra = {}) => ({
    border: '1px solid #000',
    padding: '1mm 1.5mm',
    fontSize: '7.5pt',
    fontFamily: 'Arial, sans-serif',
    ...extra,
  })

  const thStyle = (extra = {}) => ({
    ...tdStyle(extra),
    fontWeight: 'bold',
    backgroundColor: '#f3f3f3',
    textAlign: 'center',
  })

  return (
    <>
      {pages.map((rows, pi) => {
        const isLast = pi === pages.length - 1
        return (
          <div
            key={pi}
            style={{
              width: '134mm',
              minHeight: '196mm',
              fontFamily: 'Arial, sans-serif',
              fontSize: '7.5pt',
              boxSizing: 'border-box',
              pageBreakAfter: isLast ? 'auto' : 'always',
            }}
          >
            {/* ── Header row ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.5mm' }}>
              <tbody>
                <tr>
                  <td style={tdStyle({ width: '32%' })}>
                    <b>Client: </b>{clientName}
                  </td>
                  <td style={tdStyle({ width: '22%' })}>
                    <b>Transport: </b>{transport}
                  </td>
                  <td style={tdStyle({ width: '18%' })}>
                    <b>Nr. Colete: </b>{nrColete}
                  </td>
                  <td style={tdStyle({ width: '14%' })}>
                    <b>Data: </b>{data ? format(new Date(data), 'dd.MM.yy') : ''}
                  </td>
                  <td style={tdStyle({ width: '14%', backgroundColor: '#d9ead3' })}>
                    <div style={{ fontWeight: 'bold', fontSize: '6.5pt' }}>Genți:</div>
                    <div>{genti}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── Products table ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle({ width: '28%', textAlign: 'left' })}>Produs</th>
                  <th style={thStyle({ width: '16%' })}>Dimensiune</th>
                  <th style={thStyle({ width: '8%' })}>Cant</th>
                  <th style={thStyle({ width: '18%', textAlign: 'left' })}>Model</th>
                  <th style={thStyle({ width: '7.5%', color: '#c00000' })}>Croit</th>
                  <th style={thStyle({ width: '7.5%', color: '#c00000' })}>Cusut</th>
                  <th style={thStyle({ width: '7.5%' })}>Produs</th>
                  <th style={thStyle({ width: '7.5%' })}>Livrat</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} style={{ height: '7mm' }}>
                    <td style={tdStyle()}>{row.produs_text}</td>
                    <td style={tdStyle({ textAlign: 'center' })}>{row.dimensiune}</td>
                    <td style={tdStyle({ textAlign: 'center' })}>{row.cantitate || ''}</td>
                    <td style={tdStyle()}>{row.model}</td>
                    {['croit', 'cusut', 'produs_ok', 'livrat'].map(f => (
                      <td key={f} style={tdStyle({ textAlign: 'center', backgroundColor: row[f] ? '#ffd7d7' : 'white' })}>
                        {row[f] ? '✓' : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Footer — only on last page ── */}
            {isLast && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5mm' }}>
                <tbody>
                  <tr>
                    <td style={tdStyle({ color: '#c55a11', width: '42%' })}>Eticheta personalizata cusuta</td>
                    <td style={tdStyle({ width: '8%', textAlign: 'center', fontWeight: 'bold' })}>{etichetaCusuta ? 'DA' : 'NU'}</td>
                    <td style={tdStyle({ color: '#c55a11', width: '42%' })}>Eticheta pe colt</td>
                    <td style={tdStyle({ width: '8%', textAlign: 'center', fontWeight: 'bold' })}>{etichetaColt ? 'DA' : 'NU'}</td>
                  </tr>
                  <tr>
                    <td style={tdStyle({ color: '#c55a11' })}>Eticheta personalizata in punga</td>
                    <td style={tdStyle({ textAlign: 'center', fontWeight: 'bold' })}>{etichetaPunga ? 'DA' : 'NU'}</td>
                    <td style={tdStyle()} colSpan={2} />
                  </tr>
                  <tr>
                    <td style={tdStyle({ color: '#c55a11' })}>Geanta TNT</td>
                    <td style={tdStyle({ textAlign: 'center', fontWeight: 'bold' })}>{geantaTnt ? 'DA' : 'NU'}</td>
                    <td style={tdStyle()} colSpan={2} />
                  </tr>
                </tbody>
              </table>
            )}

            {pages.length > 1 && (
              <div style={{ textAlign: 'right', fontSize: '6pt', marginTop: '1mm', color: '#888' }}>
                {pi + 1} / {pages.length}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

// ═════════════════════════════════════════════════════════════
// ClientiTab
// ═════════════════════════════════════════════════════════════
function ClientiTab({ pEdit, pDelete }) {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [search, setSearch] = useState('')

  const { data: clienti = [], isLoading } = useQuery({
    queryKey: ['com_clienti'],
    queryFn: async () => {
      const { data, error } = await supabase.from('com_clienti').select('*').order('denumire')
      if (error) throw error
      return data
    },
  })

  const deleteClient = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('com_clienti').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['com_clienti'] }),
    onError: (e) => alert('Eroare: ' + e.message),
  })

  const filtered = clienti.filter(c =>
    c.denumire?.toLowerCase().includes(search.toLowerCase()) ||
    c.telefon?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Caută client..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-400 w-64"
          />
        </div>
        {pEdit && (
          <button onClick={() => { setEditingClient(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Client nou
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Denumire</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Telefon</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Adresă</th>
              {(pEdit || pDelete) && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-24">Acțiuni</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Se încarcă...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Niciun client găsit.</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.denumire}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.telefon || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{c.adresa || '—'}</td>
                {(pEdit || pDelete) && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {pEdit && (
                        <button onClick={() => { setEditingClient(c); setShowModal(true) }}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {pDelete && (
                        <button onClick={() => { if (confirm(`Ștergi clientul "${c.denumire}"?`)) deleteClient.mutate(c.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ClientModal
          client={editingClient}
          onClose={() => { setShowModal(false); setEditingClient(null) }}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['com_clienti'] }); setShowModal(false); setEditingClient(null) }}
        />
      )}
    </>
  )
}

function ClientModal({ client, onClose, onSaved }) {
  const { user } = useAuth()
  const [denumire, setDenumire] = useState(client?.denumire || '')
  const [telefon,  setTelefon]  = useState(client?.telefon  || '')
  const [adresa,   setAdresa]   = useState(client?.adresa   || '')
  const [saving,   setSaving]   = useState(false)
  const isEdit = !!client

  const handleSave = async () => {
    if (!denumire.trim()) return
    setSaving(true)
    const payload = { denumire: denumire.trim(), telefon: telefon.trim() || null, adresa: adresa.trim() || null }
    if (isEdit) {
      await supabase.from('com_clienti').update(payload).eq('id', client.id)
    } else {
      await supabase.from('com_clienti').insert({ ...payload, created_by: user.id })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editează Client' : 'Client Nou'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {[
            { label: 'Denumire', val: denumire, set: setDenumire, required: true },
            { label: 'Telefon',  val: telefon,  set: setTelefon  },
          ].map(({ label, val, set, required }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                {label} {required && <span className="text-red-400">*</span>}
              </label>
              <input type="text" value={val} onChange={e => set(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                autoFocus={label === 'Denumire'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Adresă</label>
            <textarea value={adresa} onChange={e => setAdresa(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Anulează</button>
          <button onClick={handleSave} disabled={saving || !denumire.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Salvează' : 'Adaugă'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// ProduseTab
// ═════════════════════════════════════════════════════════════
function ProduseTab({ pEdit, pDelete }) {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingProdus, setEditingProdus] = useState(null)
  const [search, setSearch] = useState('')

  const { data: produse = [], isLoading } = useQuery({
    queryKey: ['com_produse'],
    queryFn: async () => {
      const { data, error } = await supabase.from('com_produse').select('*').order('denumire')
      if (error) throw error
      return data
    },
  })

  const deleteProdus = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('com_produse').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['com_produse'] }),
    onError: (e) => alert('Eroare: ' + e.message),
  })

  const filtered = produse.filter(p => p.denumire?.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Caută produs..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-400 w-64"
          />
        </div>
        {pEdit && (
          <button onClick={() => { setEditingProdus(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Produs nou
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Denumire produs</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Adăugat</th>
              {(pEdit || pDelete) && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-24">Acțiuni</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">Se încarcă...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">Niciun produs găsit.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.denumire}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{format(new Date(p.created_at), 'dd.MM.yyyy')}</td>
                {(pEdit || pDelete) && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {pEdit && (
                        <button onClick={() => { setEditingProdus(p); setShowModal(true) }}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {pDelete && (
                        <button onClick={() => { if (confirm(`Ștergi produsul "${p.denumire}"?`)) deleteProdus.mutate(p.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ProdusModal
          produs={editingProdus}
          onClose={() => { setShowModal(false); setEditingProdus(null) }}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['com_produse'] }); setShowModal(false); setEditingProdus(null) }}
        />
      )}
    </>
  )
}

function ProdusModal({ produs, onClose, onSaved }) {
  const [denumire, setDenumire] = useState(produs?.denumire || '')
  const [saving, setSaving] = useState(false)
  const isEdit = !!produs

  const handleSave = async () => {
    if (!denumire.trim()) return
    setSaving(true)
    if (isEdit) {
      await supabase.from('com_produse').update({ denumire: denumire.trim() }).eq('id', produs.id)
    } else {
      await supabase.from('com_produse').insert({ denumire: denumire.trim() })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editează Produs' : 'Produs Nou'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
            Denumire <span className="text-red-400">*</span>
          </label>
          <input type="text" value={denumire} onChange={e => setDenumire(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Anulează</button>
          <button onClick={handleSave} disabled={saving || !denumire.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Salvează' : 'Adaugă'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// RapoarteTab
// ═════════════════════════════════════════════════════════════
function RapoarteTab() {
  const { data: comenzi = [] } = useQuery({
    queryKey: ['com_comenzi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('com_comenzi')
        .select('*, com_clienti(denumire), com_linii(id)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const stats = {
    total:    comenzi.length,
    noi:      comenzi.filter(c => c.status === 'noi').length,
    inLucru:  comenzi.filter(c => c.status === 'in_lucru').length,
    livrate:  comenzi.filter(c => c.status === 'livrate').length,
  }

  const byClient = {}
  comenzi.forEach(c => {
    const name = c.com_clienti?.denumire || 'Necunoscut'
    if (!byClient[name]) byClient[name] = { total: 0, livrate: 0 }
    byClient[name].total++
    if (c.status === 'livrate') byClient[name].livrate++
  })
  const clientStats = Object.entries(byClient).sort((a, b) => b[1].total - a[1].total).slice(0, 15)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total comenzi', value: stats.total,   bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-600',   bold: 'text-gray-900' },
          { label: 'Noi',           value: stats.noi,     bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-600',   bold: 'text-blue-900' },
          { label: 'În lucru',      value: stats.inLucru, bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', bold: 'text-yellow-900' },
          { label: 'Livrate',       value: stats.livrate, bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-600',  bold: 'text-green-900' },
        ].map(({ label, value, bg, border, text, bold }) => (
          <div key={label} className={`${bg} border ${border} rounded-xl p-4`}>
            <p className={`text-sm ${text} font-medium`}>{label}</p>
            <p className={`text-3xl font-bold ${bold} mt-1`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Comenzi pe client</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Total</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Livrate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clientStats.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">Nicio comandă înregistrată.</td></tr>
            ) : clientStats.map(([name, s]) => (
              <tr key={name} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{name}</td>
                <td className="px-4 py-2.5 text-sm text-center text-gray-600">{s.total}</td>
                <td className="px-4 py-2.5 text-sm text-center">
                  <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                    <Check className="w-3.5 h-3.5" /> {s.livrate}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
