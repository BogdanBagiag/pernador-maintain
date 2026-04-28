import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { format } from 'date-fns'
import {
  Plus, X, Save, Loader2, Printer, ShoppingCart,
  Users, Package, BarChart2, Pencil, Trash2, Check,
  ShieldOff, Search, Settings,
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
            { key: 'setari',   label: 'Setări',   icon: Settings },
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
      {tab === 'setari'   && <SetariTab   pEdit={pEdit} pDelete={pDelete} />}
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
        .select('*, com_clienti(denumire), com_linii(id, produs_text, dimensiune, cantitate, model, pozitie)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const moveStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const update = { status }
      if (status === 'livrate') update.data_livrare = new Date().toISOString()
      const { error } = await supabase.from('com_comenzi').update(update).eq('id', id)
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
  const linii = [...(comanda.com_linii || [])].sort((a, b) => (a.pozitie ?? 0) - (b.pozitie ?? 0))

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
      </p>
      {linii.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {linii.slice(0, 4).map((l, i) => (
            <p key={i} className="text-xs text-gray-500 truncate leading-snug">
              {l.produs_text}
              {l.dimensiune ? <span className="text-gray-400"> · {l.dimensiune}</span> : ''}
              {l.cantitate ? <span className="text-gray-400"> · {l.cantitate}buc</span> : ''}
              {l.model ? <span className="text-gray-400"> · {l.model}</span> : ''}
            </p>
          ))}
          {linii.length > 4 && (
            <p className="text-xs text-gray-400 italic">+{linii.length - 4} mai multe...</p>
          )}
        </div>
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
  const [clientName,  setClientName]  = useState('')   // typed text
  const [clientId,    setClientId]    = useState('')   // resolved ID
  const [data,        setData]        = useState(comanda?.data || format(new Date(), 'yyyy-MM-dd'))
  const [observatii,  setObservatii]  = useState(comanda?.observatii || '')

  // Opțiuni dinamice bifate
  const [checkedOptiuni, setCheckedOptiuni] = useState(new Set())

  const [saving, setSaving] = useState(false)

  const emptyLine = () => ({ id: null, produs_text: '', dimensiune: '', cantitate: '', model: '' })
  const [linii, setLinii] = useState(() => Array.from({ length: 6 }, emptyLine))

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
  const { data: dimensiuniCatalog = [] } = useQuery({
    queryKey: ['com_dimensiuni'],
    queryFn: async () => {
      const { data, error } = await supabase.from('com_dimensiuni').select('*').order('dimensiune')
      if (error) throw error
      return data
    },
  })
  const { data: optiuni = [] } = useQuery({
    queryKey: ['com_optiuni'],
    queryFn: async () => {
      const { data, error } = await supabase.from('com_optiuni').select('*').eq('activ', true).order('pozitie')
      if (error) throw error
      return data
    },
  })

  // Populate client name when editing existing order
  useEffect(() => {
    if (comanda?.client_id && clienti.length > 0) {
      const found = clienti.find(c => c.id === comanda.client_id)
      if (found) { setClientName(found.denumire); setClientId(found.id) }
    }
  }, [comanda?.client_id, clienti])

  // Load checked options if editing
  useEffect(() => {
    if (!comanda?.id) return
    supabase.from('com_comenzi_optiuni').select('optiune_id').eq('comanda_id', comanda.id)
      .then(({ data }) => {
        if (data) setCheckedOptiuni(new Set(data.map(r => r.optiune_id)))
      })
  }, [comanda?.id])

  // Load lines if editing
  useEffect(() => {
    if (!comanda?.id) return
    supabase.from('com_linii').select('*').eq('comanda_id', comanda.id).order('pozitie')
      .then(({ data }) => {
        if (!data) return
        const loaded = data.map(l => ({
          id:          l.id,
          produs_text: l.produs_text || '',
          dimensiune:  l.dimensiune  || '',
          cantitate:   l.cantitate   || 1,
          model:       l.model       || '',
        }))
        while (loaded.length < 6) loaded.push(emptyLine())
        setLinii(loaded)
      })
  }, [comanda?.id])

  const updateLine = (idx, field, val) =>
    setLinii(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l))

  // ── Inheritance: rows without produs inherit from the last row that has one ──
  const resolvedLinii = useMemo(() => {
    let lastProd = ''
    let lastDim  = ''
    return linii.map(l => {
      if (l.produs_text.trim()) {
        lastProd = l.produs_text.trim()
        lastDim  = l.dimensiune.trim()
        return { ...l, _inherited: false }
      }
      if (lastProd && (l.model.trim() || (l.cantitate !== '' && l.cantitate !== null))) {
        return { ...l, _inherited: true, _iProd: lastProd, _iDim: lastDim }
      }
      return { ...l, _inherited: false }
    })
  }, [linii])

  const handleSave = async () => {
    if (!clientName.trim()) { alert('Introdu numele clientului!'); return }
    setSaving(true)
    try {
      // Resolve or create client
      let resolvedClientId = clientId
      if (!resolvedClientId) {
        const match = clienti.find(c => c.denumire.toLowerCase() === clientName.trim().toLowerCase())
        if (match) {
          resolvedClientId = match.id
        } else {
          const { data: nc, error: ncErr } = await supabase
            .from('com_clienti')
            .insert({ denumire: clientName.trim(), created_by: user.id })
            .select().single()
          if (ncErr) throw ncErr
          resolvedClientId = nc.id
          queryClient.invalidateQueries({ queryKey: ['com_clienti'] })
        }
      }

      let comandaId = comanda?.id
      const payload = {
        client_id:  resolvedClientId,
        data,
        observatii: observatii.trim() || null,
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

      // Save options (junction table)
      await supabase.from('com_comenzi_optiuni').delete().eq('comanda_id', comandaId)
      if (checkedOptiuni.size > 0) {
        await supabase.from('com_comenzi_optiuni').insert(
          [...checkedOptiuni].map(optiune_id => ({ comanda_id: comandaId, optiune_id }))
        )
      }

      // Delete and re-insert lines (apply inheritance)
      await supabase.from('com_linii').delete().eq('comanda_id', comandaId)

      // Apply inheritance then filter rows with real data
      const validLinii = resolvedLinii
        .map(l => l._inherited ? { ...l, produs_text: l._iProd, dimensiune: l._iDim } : l)
        .filter(l => l.produs_text.trim() || l.model.trim())

      if (validLinii.length > 0) {
        // Auto-add new products to catalog
        const uniqueProds = [...new Set(validLinii.map(l => l.produs_text.trim()).filter(Boolean))]
        for (const name of uniqueProds) {
          const exists = produseCatalog.some(p => p.denumire.toLowerCase() === name.toLowerCase())
          if (!exists) await supabase.from('com_produse').insert({ denumire: name })
        }
        // Auto-add new dimensions to catalog
        const uniqueDims = [...new Set(validLinii.map(l => l.dimensiune?.trim()).filter(Boolean))]
        for (const dim of uniqueDims) {
          const exists = dimensiuniCatalog.some(d => d.dimensiune.toLowerCase() === dim.toLowerCase())
          if (!exists) await supabase.from('com_dimensiuni').insert({ dimensiune: dim })
        }
        queryClient.invalidateQueries({ queryKey: ['com_dimensiuni'] })

        const { error: liniiErr } = await supabase.from('com_linii').insert(
          validLinii.map((l, i) => ({
            comanda_id:  comandaId,
            produs_text: l.produs_text.trim(),
            dimensiune:  l.dimensiune?.trim()  || null,
            cantitate:   parseInt(l.cantitate) || 1,
            model:       l.model.trim()        || null,
            croit:       false,
            cusut:       false,
            produs_ok:   false,
            livrat:      false,
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

  const optiuniCheckedLabels = optiuni.filter(o => checkedOptiuni.has(o.id)).map(o => o.label)

  const handlePrint = () => {
    window.print()
    if (comanda?.id && comanda?.status === 'noi') {
      const handler = async () => {
        await supabase.from('com_comenzi').update({ status: 'in_lucru' }).eq('id', comanda.id)
        queryClient.invalidateQueries({ queryKey: ['com_comenzi'] })
        window.removeEventListener('afterprint', handler)
      }
      window.addEventListener('afterprint', handler)
    }
  }
  const validPrintLinii = resolvedLinii
    .map(r => r._inherited ? { ...r, produs_text: r._iProd, dimensiune: r._iDim } : r)
    .filter(r => r.produs_text.trim() || r.model.trim())
  const displayClientName = clientName

  return (
    <>
      <style>{`
        @media print {
          body > *:not(#comanda-print-area) { display: none !important; }
          #comanda-print-area { display: block !important; }
          @page { size: A5 landscape; margin: 6mm; }
        }
        @media screen {
          #comanda-print-area { display: none; }
        }
      `}</style>

      {/* Print area — portal direct sub body ca să nu fie afectat de modal */}
      {createPortal(
        <div id="comanda-print-area">
          <PrintLayout
            clientName={displayClientName}
            data={data}
            observatii={observatii}
            linii={validPrintLinii}
            optiuniChecked={optiuniCheckedLabels}
          />
        </div>,
        document.body
      )}

      {/* Modal */}
      <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto">
        <div className="bg-white w-full min-h-screen sm:min-h-0 sm:rounded-2xl sm:shadow-2xl sm:max-w-4xl sm:my-4 sm:mx-4">

          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200">
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

          {/* Content */}
          <div className="p-4 sm:p-6 space-y-5">

            {/* ── Header fields ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Client <span className="text-red-400">*</span>
                </label>
                <ClientInput
                  value={clientName}
                  clienti={clienti}
                  disabled={!pEdit}
                  onChange={(name, id) => { setClientName(name); setClientId(id || '') }}
                />
                {clientName.trim() && !clientId && (
                  <p className="text-xs text-primary-600 mt-1">✨ Client nou — va fi adăugat la salvare</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Data</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)} readOnly={!pEdit}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 read-only:bg-gray-50"
                />
              </div>
            </div>

            {/* ── Products table ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase">Produse</span>
                {pEdit && (
                  <button onClick={() => setLinii(prev => [...prev, emptyLine()])}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                    <Plus className="w-3.5 h-3.5" /> Adaugă rând
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200 -mx-4 sm:mx-0">
                <table className="w-full text-sm" style={{ minWidth: '480px' }}>
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Produs</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 w-24">Dim.</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 w-16">Cant.</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28">Model</th>
                      {pEdit && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resolvedLinii.map((r, idx) => (
                      <tr key={idx} className={`transition-colors hover:bg-gray-50/80 ${r._inherited ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-2 py-2">
                          <div className={pEdit ? 'border border-gray-200 rounded-md' : ''}>
                            {pEdit
                              ? <ProductInput
                                  value={r.produs_text}
                                  catalog={produseCatalog}
                                  onChange={v => updateLine(idx, 'produs_text', v)}
                                  placeholder={r._inherited ? r._iProd : 'Produs...'}
                                />
                              : <span className="text-sm text-gray-800 px-2 py-1 block">
                                  {r._inherited ? r._iProd : r.produs_text}
                                </span>
                            }
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className={pEdit ? 'border border-gray-200 rounded-md' : ''}>
                            {pEdit
                              ? <DimensiuneInput
                                  value={r.dimensiune}
                                  catalog={dimensiuniCatalog}
                                  onChange={v => updateLine(idx, 'dimensiune', v)}
                                  placeholder={r._inherited ? r._iDim : ''}
                                />
                              : <span className="text-sm text-gray-600 text-center block px-2 py-1">
                                  {r._inherited ? r._iDim : r.dimensiune}
                                </span>
                            }
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="1" value={r.cantitate}
                            onChange={e => updateLine(idx, 'cantitate', e.target.value)}
                            readOnly={!pEdit}
                            className="w-full border border-gray-200 bg-white text-sm text-center outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 rounded-md px-2 py-1 read-only:bg-gray-50 read-only:border-transparent"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input type="text" value={r.model}
                            onChange={e => updateLine(idx, 'model', e.target.value)}
                            readOnly={!pEdit}
                            className="w-full border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 rounded-md px-2 py-1 read-only:bg-gray-50 read-only:border-transparent"
                          />
                        </td>
                        {pEdit && (
                          <td className="px-2 py-2 text-center">
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

            {/* ── Opțiuni dinamice ── */}
            {optiuni.length > 0 && (
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {optiuni.map(o => (
                    <label key={o.id} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkedOptiuni.has(o.id)}
                        onChange={e => setCheckedOptiuni(prev => {
                          const next = new Set(prev)
                          e.target.checked ? next.add(o.id) : next.delete(o.id)
                          return next
                        })}
                        disabled={!pEdit}
                        className="w-4 h-4 rounded text-orange-500 cursor-pointer"
                      />
                      <span className="text-sm text-orange-700 font-medium">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── Observații ── */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Observații comandă
              </label>
              <textarea
                value={observatii}
                onChange={e => setObservatii(e.target.value)}
                readOnly={!pEdit}
                rows={3}
                placeholder="Note sau observații pentru această comandă..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 resize-none read-only:bg-gray-50"
              />
            </div>
          </div>

          {/* Footer */}
          {pEdit && (
            <div className="flex justify-end gap-3 px-4 sm:px-6 py-4 border-t border-gray-200">
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
// Client autocomplete — selectează sau creează client nou
// ─────────────────────────────────────────────────────────────
function ClientInput({ value, clienti, disabled, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const filtered = value.trim()
    ? clienti.filter(c => c.denumire.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : clienti.slice(0, 8)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={e => { onChange(e.target.value, null); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Scrie sau caută client..."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-gray-50"
      />
      {open && !disabled && (
        <div className="absolute top-full left-0 z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-0.5">
          {filtered.length > 0 ? filtered.map(c => (
            <button key={c.id}
              onMouseDown={() => { onChange(c.denumire, c.id); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 flex items-center gap-2"
            >
              <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                {c.denumire[0]?.toUpperCase()}
              </span>
              {c.denumire}
            </button>
          )) : (
            <div className="px-3 py-2 text-xs text-gray-400 italic">
              Client nou — va fi creat la salvare
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Product autocomplete
// ─────────────────────────────────────────────────────────────
function ProductInput({ value, catalog, onChange, placeholder = 'Produs...' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const filtered = value.trim()
    ? catalog.filter(p => p.denumire.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : catalog.slice(0, 8)

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
        placeholder={placeholder}
        className="w-full border-0 bg-transparent text-sm outline-none focus:ring-1 focus:ring-primary-300 rounded px-1 placeholder:text-gray-300"
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

// ─────────────────────────────────────────────────────────────
// Dimensiune autocomplete
// ─────────────────────────────────────────────────────────────
function DimensiuneInput({ value, catalog, onChange, placeholder = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const filtered = value.trim()
    ? catalog.filter(d => d.dimensiune.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : catalog.slice(0, 6)

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
        placeholder={placeholder}
        className="w-full border-0 bg-transparent text-sm text-center outline-none focus:ring-1 focus:ring-primary-300 rounded px-1 placeholder:text-gray-300"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 z-50 w-40 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {filtered.map(d => (
            <button key={d.id}
              onMouseDown={() => { onChange(d.dimensiune); setOpen(false) }}
              className="w-full text-center px-3 py-1.5 text-sm hover:bg-primary-50 hover:text-primary-700"
            >
              {d.dimensiune}
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
function PrintLayout({ clientName, data, observatii, linii, optiuniChecked = [] }) {
  const PRINT_ROWS = 8   // rows per A5 landscape page

  // Pad rows to fill pages
  const allRows = [...linii]
  const totalPages = Math.max(1, Math.ceil(allRows.length / PRINT_ROWS))
  while (allRows.length < totalPages * PRINT_ROWS) {
    allRows.push({ produs_text: '', dimensiune: '', cantitate: '', model: '' })
  }
  const pages = []
  for (let i = 0; i < allRows.length; i += PRINT_ROWS) {
    pages.push(allRows.slice(i, i + PRINT_ROWS))
  }

  const B  = '1px solid #333'        // border
  const F  = '7.5pt'                 // font size
  const FF = 'Arial, Helvetica, sans-serif'

  const cell = (extra = {}) => ({
    border: B, padding: '1.5mm 2mm', fontSize: F, fontFamily: FF,
    verticalAlign: 'middle', lineHeight: '1.2', ...extra,
  })
  const hcell = (extra = {}) => ({
    ...cell(extra), fontWeight: 'bold', background: '#f0f0f0', textAlign: 'center',
  })

  return (
    <>
      {pages.map((rows, pi) => {
        const isLast = pi === pages.length - 1
        return (
          <div key={pi} style={{
            width: '100%', fontFamily: FF, fontSize: F,
            boxSizing: 'border-box',
            pageBreakAfter: isLast ? 'avoid' : 'always',
            breakAfter:     isLast ? 'avoid' : 'page',
          }}>

            {/* ── Header ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginBottom: '1mm' }}>
              <tbody>
                {/* Row 1: Client + Transport + NrColete + Data + Genti */}
                <tr>
                  <td style={cell({ width: '30%' })}><b>Client:</b> {clientName}</td>
                  <td style={cell({ width: '22%' })}><b>Transport:</b></td>
                  <td style={cell({ width: '16%' })}><b>Nr. Colete:</b></td>
                  <td style={cell({ width: '16%' })}><b>Data:</b> {data ? format(new Date(data), 'dd.MM.yy') : ''}</td>
                  <td style={cell({ width: '16%', background: '#d9ead3' })}><b>Genți:</b></td>
                </tr>
              </tbody>
            </table>

            {/* ── Products table ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '30%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '7.5%' }} />
                <col style={{ width: '7.5%' }} />
                <col style={{ width: '7.5%' }} />
                <col style={{ width: '7.5%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={hcell({ textAlign: 'left' })}>Produs</th>
                  <th style={hcell()}>Dimensiune</th>
                  <th style={hcell()}>Cant</th>
                  <th style={hcell({ textAlign: 'left' })}>Model</th>
                  <th style={hcell({ color: '#c00000' })}>Croit</th>
                  <th style={hcell({ color: '#c00000' })}>Cusut</th>
                  <th style={hcell()}>Produs</th>
                  <th style={hcell()}>Livrat</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} style={{ height: '7mm' }}>
                    <td style={cell({ overflow: 'hidden', whiteSpace: 'nowrap' })}>{row.produs_text}</td>
                    <td style={cell({ textAlign: 'center' })}>{row.dimensiune}</td>
                    <td style={cell({ textAlign: 'center' })}>{row.cantitate || ''}</td>
                    <td style={cell({ overflow: 'hidden', whiteSpace: 'nowrap' })}>{row.model}</td>
                    <td style={cell({ textAlign: 'center' })} />
                    <td style={cell({ textAlign: 'center' })} />
                    <td style={cell({ textAlign: 'center' })} />
                    <td style={cell({ textAlign: 'center' })} />
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Footer — only on last page ── */}
            {isLast && (
              <>
                {optiuniChecked.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: '1mm' }}>
                    <colgroup>
                      <col style={{ width: '88%' }} /><col style={{ width: '12%' }} />
                    </colgroup>
                    <tbody>
                      {optiuniChecked.map(label => (
                        <tr key={label}>
                          <td style={cell({ color: '#c55a11' })}>{label}</td>
                          <td style={cell({ textAlign: 'center', fontWeight: 'bold' })}>DA</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Observatii */}
                {observatii && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1mm' }}>
                    <tbody>
                      <tr>
                        <td style={cell({ padding: '1.5mm 2mm' })}>
                          <b>Observații: </b>{observatii}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </>
            )}

            {pages.length > 1 && (
              <div style={{ textAlign: 'right', fontSize: '6pt', marginTop: '1mm', color: '#888' }}>
                Pagina {pi + 1} / {pages.length}
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
// SetariTab — gestionare opțiuni dinamice
// ═════════════════════════════════════════════════════════════
function SetariTab({ pEdit, pDelete }) {
  const queryClient = useQueryClient()
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const { data: optiuni = [], isLoading } = useQuery({
    queryKey: ['com_optiuni_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('com_optiuni').select('*').order('pozitie')
      if (error) throw error
      return data
    },
  })

  const addOptiune = async () => {
    if (!newLabel.trim()) return
    setAdding(true)
    const maxPoz = optiuni.length > 0 ? Math.max(...optiuni.map(o => o.pozitie)) + 1 : 1
    await supabase.from('com_optiuni').insert({ label: newLabel.trim(), pozitie: maxPoz })
    queryClient.invalidateQueries({ queryKey: ['com_optiuni_all'] })
    queryClient.invalidateQueries({ queryKey: ['com_optiuni'] })
    setNewLabel('')
    setAdding(false)
  }

  const toggleActiv = async (o) => {
    await supabase.from('com_optiuni').update({ activ: !o.activ }).eq('id', o.id)
    queryClient.invalidateQueries({ queryKey: ['com_optiuni_all'] })
    queryClient.invalidateQueries({ queryKey: ['com_optiuni'] })
  }

  const updateLabel = async (id, label) => {
    if (!label.trim()) return
    await supabase.from('com_optiuni').update({ label: label.trim() }).eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['com_optiuni_all'] })
    queryClient.invalidateQueries({ queryKey: ['com_optiuni'] })
    setEditingId(null)
  }

  const deleteOptiune = async (id) => {
    if (!confirm('Ștergi această opțiune?')) return
    await supabase.from('com_optiuni').delete().eq('id', id)
    queryClient.invalidateQueries({ queryKey: ['com_optiuni_all'] })
    queryClient.invalidateQueries({ queryKey: ['com_optiuni'] })
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">Opțiuni comandă</h3>
        <p className="text-xs text-gray-400 mt-0.5">Bifele care apar la fiecare comandă (ex: etichete, ambalaje).</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-4 text-sm text-gray-400">Se încarcă...</div>
        ) : optiuni.length === 0 ? (
          <div className="p-4 text-sm text-gray-400 italic">Nicio opțiune adăugată încă.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {optiuni.map(o => (
              <div key={o.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${o.activ ? 'bg-green-500' : 'bg-gray-300'}`} />
                {editingId === o.id ? (
                  <EditLabelInline
                    initial={o.label}
                    onSave={label => updateLabel(o.id, label)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <span className={`flex-1 text-sm ${o.activ ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                      {o.label}
                    </span>
                    {pEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleActiv(o)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                            o.activ
                              ? 'bg-green-50 text-green-700 hover:bg-green-100'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {o.activ ? 'Activ' : 'Inactiv'}
                        </button>
                        <button onClick={() => setEditingId(o.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {pDelete && (
                          <button onClick={() => deleteOptiune(o.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {pEdit && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addOptiune()}
            placeholder="Opțiune nouă (ex: Cutie carton)..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
          />
          <button onClick={addOptiune} disabled={adding || !newLabel.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
            <Plus className="w-4 h-4" /> Adaugă
          </button>
        </div>
      )}
    </div>
  )
}

function EditLabelInline({ initial, onSave, onCancel }) {
  const [val, setVal] = useState(initial)
  return (
    <div className="flex-1 flex items-center gap-2">
      <input
        type="text" value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(val); if (e.key === 'Escape') onCancel() }}
        autoFocus
        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-400"
      />
      <button onClick={() => onSave(val)} className="p-1 text-green-600 hover:bg-green-50 rounded">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={onCancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
        <X className="w-4 h-4" />
      </button>
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

  // Media zilelor de la primire la livrare
  const livrateWithDays = comenzi
    .filter(c => c.status === 'livrate' && c.data && c.data_livrare)
    .map(c => {
      const zile = Math.round((new Date(c.data_livrare) - new Date(c.data)) / (1000 * 60 * 60 * 24))
      return Math.max(0, zile)
    })
  const mediaZile = livrateWithDays.length > 0
    ? Math.round(livrateWithDays.reduce((a, b) => a + b, 0) / livrateWithDays.length)
    : null

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

      {mediaZile !== null && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-4">
          <div>
            <p className="text-sm text-purple-600 font-medium">Timp mediu de livrare</p>
            <p className="text-3xl font-bold text-purple-900 mt-1">{mediaZile} <span className="text-lg font-medium">zile</span></p>
          </div>
          <p className="text-xs text-purple-400 ml-auto">de la data primirii până la livrare<br/>({livrateWithDays.length} comenzi livrate)</p>
        </div>
      )}

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
