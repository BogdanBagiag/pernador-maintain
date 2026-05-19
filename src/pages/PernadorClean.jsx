import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import {
  Plus, X, Trash2, Loader2, ShieldOff, Sparkles,
  User, Phone, Eye, ChevronRight, ChevronLeft,
  Package, Check, Pencil, Settings,
} from 'lucide-react'

// ─── Configurare statusuri ────────────────────────────────────────────────────
const STATUSES = [
  { key: 'adus',     label: 'Adus',     emoji: '📥', dot: 'bg-blue-400',   header: 'bg-blue-50 border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
  { key: 'in_lucru', label: 'În lucru', emoji: '🧼', dot: 'bg-amber-400',  header: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  { key: 'gata',     label: 'Gata',     emoji: '✅', dot: 'bg-green-400',  header: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700' },
  { key: 'ridicat',  label: 'Ridicat',  emoji: '🏠', dot: 'bg-gray-400',   header: 'bg-gray-50 border-gray-200',   badge: 'bg-gray-100 text-gray-600' },
]

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.key, s]))

const emptyProdus = () => ({
  produs: '', cantitate: 1, dimensiune: '', culoare: '', modificare_dimensiuni: false,
})

// ─── Componenta card kanban ───────────────────────────────────────────────────
function BonCard({ bon, prevStatus, nextStatus, onMove, onView, onDelete, deleting }) {
  const [pendingMove, setPendingMove] = useState(null)
  const totalBucati = (bon.produse || []).reduce((s, p) => s + (parseInt(p.cantitate) || 0), 0)

  const handleArrow = (targetStatus) => {
    setPendingMove(targetStatus)
  }

  const confirmMove = () => {
    onMove(bon.id, pendingMove)
    setPendingMove(null)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 space-y-2 hover:shadow-md transition-shadow">
      {/* Nr bon + actions */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
          #{bon.nr_bon}
        </span>
        <div className="flex items-center gap-1">
          {prevStatus && (
            <button
              onClick={() => handleArrow(prevStatus)}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title={`Mută în ${STATUS_MAP[prevStatus]?.label}`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          {nextStatus && (
            <button
              onClick={() => handleArrow(nextStatus)}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title={`Mută în ${STATUS_MAP[nextStatus]?.label}`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onView}
            className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Client */}
      <div>
        <p className="text-sm font-semibold text-gray-800 truncate">{bon.nume}</p>
        {bon.telefon && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Phone className="w-3 h-3" /> {bon.telefon}
          </p>
        )}
      </div>

      {/* Produse summary */}
      {(bon.produse || []).length > 0 && (
        <div className="text-xs text-gray-500 space-y-0.5">
          {(bon.produse || []).slice(0, 3).map((p, i) => (
            <div key={i} className="flex items-center gap-1">
              <Package className="w-3 h-3 flex-shrink-0 text-gray-300" />
              <span className="truncate">
                {p.cantitate}x {p.produs || '—'}
                {p.dimensiune ? ` (${p.dimensiune})` : ''}
                {p.culoare ? ` · ${p.culoare}` : ''}
                {p.modificare_dimensiuni ? ' ✂️' : ''}
              </span>
            </div>
          ))}
          {(bon.produse || []).length > 3 && (
            <p className="text-gray-400 italic">+{bon.produse.length - 3} produse</p>
          )}
        </div>
      )}

      {/* Data */}
      <p className="text-[10px] text-gray-300">
        {bon.created_at ? format(new Date(bon.created_at), 'dd.MM.yyyy HH:mm') : '—'}
      </p>

      {/* Confirmare mutare */}
      {pendingMove && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs space-y-1.5">
          <p className="text-amber-800 font-medium">
            Muți în <strong>{STATUS_MAP[pendingMove]?.label}</strong>?
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmMove}
              className="flex-1 bg-amber-500 text-white rounded px-2 py-1 font-medium hover:bg-amber-600"
            >
              Da, mută
            </button>
            <button
              onClick={() => setPendingMove(null)}
              className="flex-1 bg-white border border-gray-200 text-gray-600 rounded px-2 py-1 hover:bg-gray-50"
            >
              Nu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── LookupConfigModal ────────────────────────────────────────────────────────
function LookupConfigModal({ label, table, items, onClose, onRefresh }) {
  const [newNume, setNewNume] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const handleAdd = async () => {
    if (!newNume.trim()) return
    setSaving(true); setError('')
    const { error: err } = await supabase.from(table).insert({ nume: newNume.trim(), pozitie: items.length })
    setSaving(false)
    if (err) { setError('Eroare la salvare.'); return }
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
              <input
                type="text" value={newNume}
                onChange={e => setNewNume(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Valoare nouă..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
              <button onClick={handleAdd} disabled={!newNume.trim() || saving}
                className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {items.length === 0
                ? <p className="text-sm text-gray-400 text-center py-4">Nicio valoare adăugată.</p>
                : items.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 gap-2">
                    <span className="text-sm text-gray-800 flex-1">{item.nume}</span>
                    <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id}
                      className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
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

// ─── Modal adăugare bon ───────────────────────────────────────────────────────
function BonModal({ onClose, onSaved, userId, initialData = null, produseOpt = [], dimensiuniOpt = [], culoriOpt = [] }) {
  const isEdit = !!initialData
  const [form, setForm] = useState({
    nume: initialData?.nume || '',
    telefon: initialData?.telefon || '',
    observatii: initialData?.observatii || '',
  })
  const [produse, setProduse] = useState(
    initialData?.produse?.length
      ? initialData.produse
      : [emptyProdus(), emptyProdus()]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Mobile back button
  useEffect(() => {
    history.pushState({ bonModal: true }, '')
    const onPop = () => onClose()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [onClose])

  const updateProdus = (idx, field, value) => {
    setProduse(prev => {
      const next = prev.map((p, i) => i === idx ? { ...p, [field]: value } : p)
      // Auto-adaugă rând dacă ultimul e completat
      const last = next[next.length - 1]
      const lastFilled = last.produs || last.dimensiune || last.culoare || last.cantitate > 1
      if (idx === next.length - 1 && lastFilled) {
        return [...next, emptyProdus()]
      }
      return next
    })
  }

  const removeProdus = (idx) => {
    if (produse.length <= 1) return
    setProduse(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (!form.nume.trim()) { setError('Numele clientului este obligatoriu.'); return }
    setSaving(true)
    setError('')

    const produseClean = produse.filter(p => p.produs || p.dimensiune || p.culoare || p.cantitate > 1)

    let err
    if (isEdit) {
      const { error: e } = await supabase
        .from('pernador_clean')
        .update({ ...form, produse: produseClean })
        .eq('id', initialData.id)
      err = e
    } else {
      const { error: e } = await supabase
        .from('pernador_clean')
        .insert({ ...form, produse: produseClean, status: 'adus', created_by: userId })
      err = e
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Editează bon' : 'Bon nou'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-3.5 h-3.5 inline mr-1" />
                Nume client <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.nume}
                onChange={e => setForm(f => ({ ...f, nume: e.target.value }))}
                className="input"
                placeholder="ex: Ion Popescu"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-3.5 h-3.5 inline mr-1" />
                Telefon
              </label>
              <input
                type="text"
                value={form.telefon}
                onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))}
                className="input"
                placeholder="ex: 0722 123 456"
              />
            </div>
          </div>

          {/* Produse */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Produse</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">Produs</th>
                    <th className="px-2 py-2 text-center w-16">Cant.</th>
                    <th className="px-2 py-2 text-left">Dimensiune</th>
                    <th className="px-2 py-2 text-left">Culoare</th>
                    <th className="px-2 py-2 text-center w-10" title="Modificare dimensiuni">✂️</th>
                    <th className="px-2 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {produse.map((p, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="px-3 py-1.5">
                        <input
                          list={`produs-list-${idx}`}
                          value={p.produs}
                          onChange={e => updateProdus(idx, 'produs', e.target.value)}
                          className="w-full border-0 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-300 focus:ring-1 focus:ring-primary-300 rounded px-1"
                          placeholder="ex: Pernă"
                        />
                        <datalist id={`produs-list-${idx}`}>
                          {produseOpt.map(o => <option key={o.id} value={o.nume} />)}
                        </datalist>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="1"
                          value={p.cantitate}
                          onChange={e => updateProdus(idx, 'cantitate', parseInt(e.target.value) || 1)}
                          className="w-full border-0 bg-transparent outline-none text-sm text-center text-gray-800 focus:ring-1 focus:ring-primary-300 rounded px-1"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          list={`dim-list-${idx}`}
                          value={p.dimensiune}
                          onChange={e => updateProdus(idx, 'dimensiune', e.target.value)}
                          className="w-full border-0 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-300 focus:ring-1 focus:ring-primary-300 rounded px-1"
                          placeholder="50x70"
                        />
                        <datalist id={`dim-list-${idx}`}>
                          {dimensiuniOpt.map(o => <option key={o.id} value={o.nume} />)}
                        </datalist>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          list={`culoare-list-${idx}`}
                          value={p.culoare}
                          onChange={e => updateProdus(idx, 'culoare', e.target.value)}
                          className="w-full border-0 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-300 focus:ring-1 focus:ring-primary-300 rounded px-1"
                          placeholder="alb"
                        />
                        <datalist id={`culoare-list-${idx}`}>
                          {culoriOpt.map(o => <option key={o.id} value={o.nume} />)}
                        </datalist>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={p.modificare_dimensiuni}
                          onChange={e => updateProdus(idx, 'modificare_dimensiuni', e.target.checked)}
                          className="w-4 h-4 rounded accent-primary-600 cursor-pointer"
                          title="Modificare dimensiuni"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => removeProdus(idx)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                          tabIndex={-1}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => setProduse(p => [...p, emptyProdus()])}
              className="mt-2 text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Adaugă produs
            </button>
          </div>

          {/* Observații */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observații</label>
            <textarea
              value={form.observatii}
              onChange={e => setForm(f => ({ ...f, observatii: e.target.value }))}
              className="input resize-none"
              rows={2}
              placeholder="Observații suplimentare..."
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Anulează</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? 'Salvează' : 'Creează bon'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal view bon ───────────────────────────────────────────────────────────
function ViewBonModal({ bon, onClose, onEdit }) {
  const st = STATUS_MAP[bon.status] || {}

  useEffect(() => {
    history.pushState({ viewBon: true }, '')
    const onPop = () => onClose()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">Bon #{bon.nr_bon}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.badge}`}>
              {st.emoji} {st.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button onClick={onEdit} className="text-gray-400 hover:text-primary-600">
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Client */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Nume client</p>
              <p className="text-sm font-semibold text-gray-800">{bon.nume || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Telefon</p>
              <p className="text-sm text-gray-800">{bon.telefon || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Data înregistrare</p>
              <p className="text-sm text-gray-800">
                {bon.created_at ? format(new Date(bon.created_at), 'dd.MM.yyyy HH:mm') : '—'}
              </p>
            </div>
          </div>

          {/* Produse */}
          {(bon.produse || []).length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Produse</p>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500">
                      <th className="px-3 py-2 text-left">Produs</th>
                      <th className="px-2 py-2 text-center">Cant.</th>
                      <th className="px-2 py-2 text-left">Dimensiune</th>
                      <th className="px-2 py-2 text-left">Culoare</th>
                      <th className="px-2 py-2 text-center">✂️</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(bon.produse || []).map((p, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium text-gray-800">{p.produs || '—'}</td>
                        <td className="px-2 py-2 text-center text-gray-600">{p.cantitate}</td>
                        <td className="px-2 py-2 text-gray-600">{p.dimensiune || '—'}</td>
                        <td className="px-2 py-2 text-gray-600">{p.culoare || '—'}</td>
                        <td className="px-2 py-2 text-center">
                          {p.modificare_dimensiuni
                            ? <Check className="w-4 h-4 text-green-500 mx-auto" />
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Observații */}
          {bon.observatii && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Observații</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{bon.observatii}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Închide</button>
        </div>
      </div>
    </div>
  )
}

// ─── Pagina principală ────────────────────────────────────────────────────────
export default function PernadorClean() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [showModal, setShowModal]   = useState(false)
  const [editBon, setEditBon]       = useState(null)
  const [viewBon, setViewBon]       = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [configModal, setConfigModal] = useState(null) // 'produse' | 'dimensiuni' | 'culori'

  // ── Opțiuni predefinite ───────────────────────────────────
  const { data: produseOpt = [], refetch: refetchProduse } = useQuery({
    queryKey: ['pc_produse_opt'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pernador_clean_produse_opt').select('*').order('pozitie').order('nume')
      if (error) throw error
      return data
    },
  })
  const { data: dimensiuniOpt = [], refetch: refetchDimensiuni } = useQuery({
    queryKey: ['pc_dimensiuni'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pernador_clean_dimensiuni').select('*').order('pozitie').order('nume')
      if (error) throw error
      return data
    },
  })
  const { data: culoriOpt = [], refetch: refetchCulori } = useQuery({
    queryKey: ['pc_culori'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pernador_clean_culori').select('*').order('pozitie').order('nume')
      if (error) throw error
      return data
    },
  })

  const CONFIG_MAP = {
    produse:    { label: 'Produse',    table: 'pernador_clean_produse_opt', items: produseOpt,    refetch: refetchProduse },
    dimensiuni: { label: 'Dimensiuni', table: 'pernador_clean_dimensiuni',  items: dimensiuniOpt, refetch: refetchDimensiuni },
    culori:     { label: 'Culori',     table: 'pernador_clean_culori',      items: culoriOpt,     refetch: refetchCulori },
  }

  const { data: bonuri = [], isLoading } = useQuery({
    queryKey: ['pernador_clean'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pernador_clean')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // Move status
  const moveStatus = useMutation({
    mutationFn: async ({ id, newStatus }) => {
      const { error } = await supabase
        .from('pernador_clean')
        .update({ status: newStatus })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['pernador_clean'] })
      const prev = queryClient.getQueryData(['pernador_clean'])
      queryClient.setQueryData(['pernador_clean'], (old = []) =>
        old.map(b => b.id === id ? { ...b, status: newStatus } : b)
      )
      return { prev }
    },
    onError: (_, __, ctx) => queryClient.setQueryData(['pernador_clean'], ctx.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['pernador_clean'] }),
  })

  const handleDelete = async (id) => {
    if (!confirm('Ștergi acest bon?')) return
    setDeletingId(id)
    await supabase.from('pernador_clean').delete().eq('id', id)
    setDeletingId(null)
    queryClient.invalidateQueries({ queryKey: ['pernador_clean'] })
  }

  const counts = STATUSES.reduce((acc, s) => {
    acc[s.key] = bonuri.filter(b => b.status === s.key).length
    return acc
  }, {})

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  )

  return (
    <div className="max-w-full mx-auto space-y-5">

      {/* Titlu */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Pernador Clean</h1>
        <p className="text-sm text-gray-500 mt-0.5">Sistem de înregistrare curățătorie perne și pilote</p>
      </div>

      {/* Carduri sumar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map(s => (
          <div key={s.key} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${s.badge}`}>
              <span className="text-base">{s.emoji}</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className="text-xl font-bold text-gray-800">{counts[s.key] || 0}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Butoane acțiuni */}
      <div className="flex items-center justify-between gap-3">
        {/* Settings dropdown */}
        <div className="flex gap-2 flex-wrap">
          {['produse', 'dimensiuni', 'culori'].map(key => (
            <button
              key={key}
              onClick={() => setConfigModal(key)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              {CONFIG_MAP[key].label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Bon nou
        </button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUSES.map((status, si) => {
          const cards = bonuri.filter(b => b.status === status.key)
          const prevStatus = si > 0 ? STATUSES[si - 1].key : null
          const nextStatus = si < STATUSES.length - 1 ? STATUSES[si + 1].key : null

          return (
            <div key={status.key} className={`rounded-xl border ${status.header} flex flex-col`}>
              {/* Header coloană */}
              <div className="px-4 py-3 flex items-center gap-2 border-b border-current border-opacity-10">
                <div className={`w-2.5 h-2.5 rounded-full ${status.dot}`} />
                <span className="font-semibold text-sm text-gray-800">{status.label}</span>
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${status.badge}`}>
                  {cards.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 min-h-[120px]">
                {cards.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-gray-300 italic">
                    Niciun bon
                  </div>
                )}
                {cards.map(bon => (
                  <BonCard
                    key={bon.id}
                    bon={bon}
                    prevStatus={prevStatus}
                    nextStatus={nextStatus}
                    onMove={(id, s) => moveStatus.mutate({ id, newStatus: s })}
                    onView={() => setViewBon(bon)}
                    onDelete={() => handleDelete(bon.id)}
                    deleting={deletingId === bon.id}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal adăugare */}
      {showModal && (
        <BonModal
          userId={user?.id}
          produseOpt={produseOpt}
          dimensiuniOpt={dimensiuniOpt}
          culoriOpt={culoriOpt}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            queryClient.invalidateQueries({ queryKey: ['pernador_clean'] })
          }}
        />
      )}

      {/* Modal editare */}
      {editBon && (
        <BonModal
          userId={user?.id}
          initialData={editBon}
          produseOpt={produseOpt}
          dimensiuniOpt={dimensiuniOpt}
          culoriOpt={culoriOpt}
          onClose={() => setEditBon(null)}
          onSaved={() => {
            setEditBon(null)
            queryClient.invalidateQueries({ queryKey: ['pernador_clean'] })
          }}
        />
      )}

      {/* Config modal */}
      {configModal && CONFIG_MAP[configModal] && (
        <LookupConfigModal
          label={CONFIG_MAP[configModal].label}
          table={CONFIG_MAP[configModal].table}
          items={CONFIG_MAP[configModal].items}
          onClose={() => setConfigModal(null)}
          onRefresh={CONFIG_MAP[configModal].refetch}
        />
      )}

      {/* Modal view */}
      {viewBon && (
        <ViewBonModal
          bon={viewBon}
          onClose={() => setViewBon(null)}
          onEdit={() => { setEditBon(viewBon); setViewBon(null) }}
        />
      )}
    </div>
  )
}
