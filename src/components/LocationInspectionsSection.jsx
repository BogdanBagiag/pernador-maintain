import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ClipboardCheck, Plus, Calendar, Trash2, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Edit2, FileText, Building2,
} from 'lucide-react'
import DateInput, { getTodayISO } from './DateInput'

const emptyForm = () => ({
  tip: 'PRAM',
  data_inspectie: getTodayISO(),
  data_expirare: '',
  furnizor: '',
  numar_document: '',
  observatii: '',
})

export default function LocationInspectionsSection({ locationId, canEdit }) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [formData, setFormData] = useState(emptyForm())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: inspections, isLoading } = useQuery({
    queryKey: ['location-inspections', locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('location_inspections')
        .select('*')
        .eq('location_id', locationId)
        .order('data_expirare', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const isExpired = (d) => new Date(d) < new Date(new Date().toDateString())
  const daysUntil = (d) => Math.ceil((new Date(d) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24))
  const isExpiringSoon = (d) => !isExpired(d) && daysUntil(d) <= 30

  // Pentru fiecare "tip" distinct, cea mai recentă înregistrare (după data_expirare) e cea "curentă"
  const groupedByTip = (inspections || []).reduce((acc, item) => {
    if (!acc[item.tip]) acc[item.tip] = []
    acc[item.tip].push(item)
    return acc
  }, {})
  const currentByTip = Object.entries(groupedByTip).map(([tip, items]) => items[0])
  const currentIds = new Set(currentByTip.map((i) => i.id))
  const historical = (inspections || []).filter((i) => !currentIds.has(i.id))

  const handleClose = () => {
    setShowModal(false)
    setEditingItem(null)
    setFormData(emptyForm())
    setError('')
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({
      tip: item.tip,
      data_inspectie: item.data_inspectie,
      data_expirare: item.data_expirare,
      furnizor: item.furnizor || '',
      numar_document: item.numar_document || '',
      observatii: item.observatii || '',
    })
    setShowModal(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        location_id: locationId,
        tip: formData.tip.trim() || 'PRAM',
        data_inspectie: formData.data_inspectie,
        data_expirare: formData.data_expirare,
        furnizor: formData.furnizor.trim() || null,
        numar_document: formData.numar_document.trim() || null,
        observatii: formData.observatii.trim() || null,
      }
      if (editingItem) {
        const { error } = await supabase
          .from('location_inspections')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('location_inspections')
          .insert({ ...payload, created_by: profile?.id })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-inspections', locationId] })
      queryClient.invalidateQueries({ queryKey: ['all-location-inspections'] })
      handleClose()
    },
    onError: (e) => setError(e.message || 'Eroare la salvare'),
    onSettled: () => setSaving(false),
  })

  const handleSave = () => {
    setError('')
    if (!formData.data_expirare) {
      setError('Data expirării este obligatorie.')
      return
    }
    setSaving(true)
    saveMutation.mutate()
  }

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('location_inspections').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-inspections', locationId] })
      queryClient.invalidateQueries({ queryKey: ['all-location-inspections'] })
    },
  })

  const handleDelete = (item) => {
    if (window.confirm(`Ștergi înregistrarea ${item.tip} din ${new Date(item.data_inspectie).toLocaleDateString('ro-RO')}?`)) {
      deleteMutation.mutate(item.id)
    }
  }

  const renderCard = (item, isCurrent) => {
    const expired = isExpired(item.data_expirare)
    const expiringSoon = !expired && isExpiringSoon(item.data_expirare)
    const days = daysUntil(item.data_expirare)

    return (
      <div
        key={item.id}
        className={`border rounded-lg p-4 ${
          isCurrent
            ? expired ? 'border-red-300 bg-red-50' : expiringSoon ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50'
            : 'border-gray-200 bg-gray-50'
        }`}
      >
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="flex items-center flex-wrap gap-2">
            <ClipboardCheck className={`w-5 h-5 flex-shrink-0 ${expired ? 'text-red-600' : expiringSoon ? 'text-yellow-600' : 'text-green-600'}`} />
            <span className="font-semibold text-gray-900">{item.tip}</span>
            {isCurrent && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                expired ? 'bg-red-100 text-red-800' : expiringSoon ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
              }`}>
                {expired
                  ? <><AlertTriangle className="w-3 h-3 mr-1" />Expirat</>
                  : expiringSoon
                    ? <><AlertTriangle className="w-3 h-3 mr-1" />{days} zile</>
                    : <><CheckCircle className="w-3 h-3 mr-1" />În termen</>}
              </span>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => handleEdit(item)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editează">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(item)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Șterge">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>
              Efectuată: {new Date(item.data_inspectie).toLocaleDateString('ro-RO')} · Valabilă până: {new Date(item.data_expirare).toLocaleDateString('ro-RO')}
            </span>
          </div>
          {item.furnizor && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>{item.furnizor}</span>
            </div>
          )}
          {item.numar_document && (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Nr. document: {item.numar_document}</span>
            </div>
          )}
        </div>

        {item.observatii && <p className="text-gray-500 text-xs mt-2">{item.observatii}</p>}
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Inspecții ({inspections?.length || 0})
        </h2>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" /> Adaugă inspecție
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-center py-4 text-gray-500">Se încarcă...</p>
      ) : currentByTip.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>Nicio inspecție înregistrată (ex: PRAM).</p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentByTip.map((item) => renderCard(item, true))}
        </div>
      )}

      {historical.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowHistory(!showHistory)} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Istoric ({historical.length})
          </button>
          {showHistory && (
            <div className="mt-3 space-y-3">
              {historical.map((item) => renderCard(item, false))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={handleClose} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingItem ? 'Editează inspecție' : 'Adaugă inspecție'}
              </h3>
              {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tip inspecție *</label>
                  <input
                    type="text"
                    value={formData.tip}
                    onChange={(e) => setFormData({ ...formData, tip: e.target.value })}
                    placeholder="ex: PRAM, ISCIR, Stingătoare..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data efectuării *</label>
                    <DateInput
                      value={formData.data_inspectie}
                      onChange={(e) => setFormData({ ...formData, data_inspectie: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data expirării *</label>
                    <DateInput
                      value={formData.data_expirare}
                      onChange={(e) => setFormData({ ...formData, data_expirare: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Furnizor / Executant</label>
                  <input
                    type="text"
                    value={formData.furnizor}
                    onChange={(e) => setFormData({ ...formData, furnizor: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Număr document / certificat</label>
                  <input
                    type="text"
                    value={formData.numar_document}
                    onChange={(e) => setFormData({ ...formData, numar_document: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Observații</label>
                  <textarea
                    rows={2}
                    value={formData.observatii}
                    onChange={(e) => setFormData({ ...formData, observatii: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={handleClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Anulează
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.data_expirare}
                  className="px-4 py-2 bg-primary-600 rounded-md text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? 'Se salvează...' : editingItem ? 'Actualizează' : 'Salvează'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
