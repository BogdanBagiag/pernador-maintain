import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ShieldCheck, Plus, Calendar, Trash2, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Edit2, FileText, Building2, Coins,
} from 'lucide-react'
import DateInput, { getTodayISO } from './DateInput'

const emptyForm = () => ({
  tip: 'Asigurare clădire',
  asigurator: '',
  numar_polita: '',
  data_inceput: getTodayISO(),
  data_expirare: '',
  suma_asigurata: '',
  prima_asigurare: '',
  observatii: '',
})

export default function LocationInsurancesSection({ locationId, canEdit }) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [formData, setFormData] = useState(emptyForm())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState(null)
  const [fileError, setFileError] = useState(null) // { insuranceId, message }

  const { data: insurances, isLoading } = useQuery({
    queryKey: ['location-insurances', locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('location_insurances')
        .select('*')
        .eq('location_id', locationId)
        .order('data_expirare', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const insuranceIds = (insurances || []).map((i) => i.id)

  // Documente atasate asigurarilor acestei locatii (o asigurare poate avea mai multe fisiere)
  const { data: files } = useQuery({
    queryKey: ['location-insurance-files', locationId, insuranceIds.join(',')],
    queryFn: async () => {
      if (insuranceIds.length === 0) return []
      const { data, error } = await supabase
        .from('location_insurance_files')
        .select('*')
        .in('insurance_id', insuranceIds)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: insuranceIds.length > 0,
  })

  const filesByInsurance = (files || []).reduce((acc, f) => {
    if (!acc[f.insurance_id]) acc[f.insurance_id] = []
    acc[f.insurance_id].push(f)
    return acc
  }, {})

  const isExpired = (d) => new Date(d) < new Date(new Date().toDateString())
  const daysUntil = (d) => Math.ceil((new Date(d) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24))
  const isExpiringSoon = (d) => !isExpired(d) && daysUntil(d) <= 30

  // Pentru fiecare "tip" distinct, cea mai recentă înregistrare (după data_expirare) e cea "curentă"
  const groupedByTip = (insurances || []).reduce((acc, item) => {
    if (!acc[item.tip]) acc[item.tip] = []
    acc[item.tip].push(item)
    return acc
  }, {})
  const currentByTip = Object.entries(groupedByTip).map(([tip, items]) => items[0])
  const currentIds = new Set(currentByTip.map((i) => i.id))
  const historical = (insurances || []).filter((i) => !currentIds.has(i.id))

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
      asigurator: item.asigurator || '',
      numar_polita: item.numar_polita || '',
      data_inceput: item.data_inceput,
      data_expirare: item.data_expirare,
      suma_asigurata: item.suma_asigurata?.toString() || '',
      prima_asigurare: item.prima_asigurare?.toString() || '',
      observatii: item.observatii || '',
    })
    setShowModal(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        location_id: locationId,
        tip: formData.tip.trim() || 'Asigurare clădire',
        asigurator: formData.asigurator.trim() || null,
        numar_polita: formData.numar_polita.trim() || null,
        data_inceput: formData.data_inceput,
        data_expirare: formData.data_expirare,
        suma_asigurata: formData.suma_asigurata ? parseFloat(formData.suma_asigurata) : null,
        prima_asigurare: formData.prima_asigurare ? parseFloat(formData.prima_asigurare) : null,
        observatii: formData.observatii.trim() || null,
      }
      if (editingItem) {
        const { error } = await supabase
          .from('location_insurances')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('location_insurances')
          .insert({ ...payload, created_by: profile?.id })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-insurances', locationId] })
      queryClient.invalidateQueries({ queryKey: ['all-location-insurances'] })
      handleClose()
    },
    onError: (e) => setError(e.message || 'Eroare la salvare'),
    onSettled: () => setSaving(false),
  })

  const handleSave = () => {
    setError('')
    if (!formData.data_inceput || !formData.data_expirare) {
      setError('Data începutului și data expirării sunt obligatorii.')
      return
    }
    setSaving(true)
    saveMutation.mutate()
  }

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('location_insurances').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-insurances', locationId] })
      queryClient.invalidateQueries({ queryKey: ['all-location-insurances'] })
    },
  })

  const handleDelete = (item) => {
    if (window.confirm(`Ștergi asigurarea ${item.tip} din ${new Date(item.data_inceput).toLocaleDateString('ro-RO')}?`)) {
      deleteMutation.mutate(item.id)
    }
  }

  // Upload unul sau mai multe documente pentru o asigurare
  const uploadFilesMutation = useMutation({
    mutationFn: async ({ insuranceId, fileList }) => {
      for (const file of fileList) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `location-insurances/${locationId}/${insuranceId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('maintenance-files')
          .upload(filePath, file)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('maintenance-files').getPublicUrl(filePath)

        const { error: dbError } = await supabase.from('location_insurance_files').insert({
          insurance_id: insuranceId,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: profile?.id,
        })
        if (dbError) throw dbError
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['location-insurance-files', locationId] })
      setFileError((prev) => (prev?.insuranceId === variables.insuranceId ? null : prev))
    },
    onError: (e, variables) => {
      console.error('Eroare la încărcarea documentului de asigurare:', e)
      setFileError({ insuranceId: variables.insuranceId, message: e.message || 'Eroare la încărcarea documentului.' })
    },
    onSettled: () => setUploadingId(null),
  })

  const handleFilesSelected = (insuranceId, fileList) => {
    if (!fileList || fileList.length === 0) return
    setFileError(null)
    setUploadingId(insuranceId)
    uploadFilesMutation.mutate({ insuranceId, fileList })
  }

  const deleteFileMutation = useMutation({
    mutationFn: async (file) => {
      const urlParts = file.file_url.split('/maintenance-files/')
      if (urlParts.length > 1) {
        const filePath = urlParts[1].split('?')[0]
        const { error: storageError } = await supabase.storage.from('maintenance-files').remove([filePath])
        if (storageError) console.error('Storage delete error:', storageError)
      }
      const { error } = await supabase.from('location_insurance_files').delete().eq('id', file.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-insurance-files', locationId] })
    },
  })

  const handleDeleteFile = (file) => {
    if (window.confirm(`Ștergi documentul "${file.file_name}"?`)) {
      deleteFileMutation.mutate(file)
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
            <ShieldCheck className={`w-5 h-5 flex-shrink-0 ${expired ? 'text-red-600' : expiringSoon ? 'text-yellow-600' : 'text-green-600'}`} />
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
              Activă: {new Date(item.data_inceput).toLocaleDateString('ro-RO')} · Valabilă până: {new Date(item.data_expirare).toLocaleDateString('ro-RO')}
            </span>
          </div>
          {item.asigurator && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>{item.asigurator}</span>
            </div>
          )}
          {item.numar_polita && (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Poliță nr.: {item.numar_polita}</span>
            </div>
          )}
          {(item.suma_asigurata || item.prima_asigurare) && (
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4" />
              <span>
                {item.suma_asigurata && `Sumă asigurată: ${item.suma_asigurata.toLocaleString('ro-RO')} LEI`}
                {item.suma_asigurata && item.prima_asigurare && ' · '}
                {item.prima_asigurare && `Primă: ${item.prima_asigurare.toLocaleString('ro-RO')} LEI`}
              </span>
            </div>
          )}
        </div>

        {item.observatii && <p className="text-gray-500 text-xs mt-2">{item.observatii}</p>}

        {/* Documente atasate */}
        <div className="mt-3 pt-3 border-t border-gray-200/70">
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="text-xs font-medium text-gray-500">
              Documente ({(filesByInsurance[item.id] || []).length})
            </p>
            {canEdit && (
              <>
                <input
                  type="file"
                  multiple
                  id={`location-insurance-files-${item.id}`}
                  className="hidden"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || [])
                    e.target.value = ''
                    handleFilesSelected(item.id, selected)
                  }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById(`location-insurance-files-${item.id}`).click()}
                  disabled={uploadingId === item.id}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50 flex-shrink-0"
                >
                  {uploadingId === item.id ? 'Se încarcă...' : '+ Adaugă document'}
                </button>
              </>
            )}
          </div>
          {(filesByInsurance[item.id] || []).length > 0 && (
            <ul className="space-y-1">
              {filesByInsurance[item.id].map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
                  <a
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary-600 hover:text-primary-700 truncate min-w-0"
                    title={f.file_name}
                  >
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{f.file_name}</span>
                  </a>
                  {canEdit && (
                    <button
                      onClick={() => handleDeleteFile(f)}
                      className="text-gray-300 hover:text-red-500 flex-shrink-0"
                      title="Șterge document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {fileError?.insuranceId === item.id && (
            <p className="text-xs text-red-600 mt-1.5">{fileError.message}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Asigurări ({insurances?.length || 0})
        </h2>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" /> Adaugă asigurare
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-center py-4 text-gray-500">Se încarcă...</p>
      ) : currentByTip.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
          <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>Nicio asigurare înregistrată.</p>
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
                {editingItem ? 'Editează asigurare' : 'Adaugă asigurare'}
              </h3>
              {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tip asigurare *</label>
                  <input
                    type="text"
                    value={formData.tip}
                    onChange={(e) => setFormData({ ...formData, tip: e.target.value })}
                    placeholder="ex: Asigurare clădire, PAD..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data început *</label>
                    <DateInput
                      value={formData.data_inceput}
                      onChange={(e) => setFormData({ ...formData, data_inceput: e.target.value })}
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
                  <label className="block text-sm font-medium text-gray-700">Asigurator</label>
                  <input
                    type="text"
                    value={formData.asigurator}
                    onChange={(e) => setFormData({ ...formData, asigurator: e.target.value })}
                    placeholder="ex: Allianz, Groupama..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Număr poliță</label>
                  <input
                    type="text"
                    value={formData.numar_polita}
                    onChange={(e) => setFormData({ ...formData, numar_polita: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sumă asigurată (LEI)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.suma_asigurata}
                      onChange={(e) => setFormData({ ...formData, suma_asigurata: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Primă (LEI)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.prima_asigurare}
                      onChange={(e) => setFormData({ ...formData, prima_asigurare: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
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
                  disabled={saving || !formData.data_inceput || !formData.data_expirare}
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
