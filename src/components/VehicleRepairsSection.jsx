import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Wrench, Plus, Calendar, DollarSign, MapPin, Trash2, FileText, Download, Gauge, Edit2 } from 'lucide-react'
import DateInput, { getTodayISO } from './DateInput'

export default function VehicleRepairsSection({ vehicleId, repairs, isLoading }) {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    repair_type: 'corectiva',
    title: '',
    description: '',
    service_provider: '',
    service_location: '',
    repair_date: getTodayISO(),
    mileage_at_repair: '',
    labor_cost: '',
    parts_cost: '',
    total_cost: '',
    status: 'completed',
    notes: '',
  })
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [estimateFile, setEstimateFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'

  const getStatusBadge = (status) => {
    const badges = {
      scheduled: { bg: 'bg-blue-100', text: 'text-blue-800', label: t('vehicles.scheduled') },
      in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: t('vehicles.inProgress') },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: t('vehicles.completed') },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: t('vehicles.cancelled') }
    }
    return badges[status] || badges.completed
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Fișierul este prea mare. Maxim 5MB.')
      return
    }
    setInvoiceFile(file)
    setError('')
  }

  // Handle estimate file selection
  const handleEstimateFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Fișierul este prea mare. Maxim 5MB.')
      return
    }
    setEstimateFile(file)
    setError('')
  }

  const calculateTotal = () => {
    const labor = parseFloat(formData.labor_cost) || 0
    const parts = parseFloat(formData.parts_cost) || 0
    setFormData({ ...formData, total_cost: (labor + parts).toFixed(2) })
  }

  // Handle edit
  const handleEdit = (repair) => {
    setEditMode(true)
    setEditingItem(repair)
    setFormData({
      repair_type: repair.repair_type,
      title: repair.title,
      description: repair.description || '',
      service_provider: repair.service_provider || '',
      service_location: repair.service_location || '',
      repair_date: repair.repair_date,
      mileage_at_repair: repair.mileage_at_repair?.toString() || '',
      labor_cost: repair.labor_cost?.toString() || '',
      parts_cost: repair.parts_cost?.toString() || '',
      total_cost: repair.total_cost?.toString() || '',
      status: repair.status,
      notes: repair.notes || '',
    })
    setShowAddModal(true)
  }

  // Handle close modal
  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditMode(false)
    setEditingItem(null)
    setInvoiceFile(null)
    setEstimateFile(null)
    setFormData({ repair_type: 'corectiva', title: '', description: '', service_provider: '', service_location: '', repair_date: getTodayISO(), mileage_at_repair: '', labor_cost: '', parts_cost: '', total_cost: '', status: 'completed', notes: '' })
    setError('')
  }

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      setUploading(true)

      let invoiceUrl = editingItem.invoice_file_url
      let invoiceName = editingItem.invoice_file_name
      let estimateUrl = editingItem.estimate_file_url
      let estimateName = editingItem.estimate_file_name

      // Upload invoice if provided
      if (invoiceFile) {
        const fileExt = invoiceFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `vehicle-repairs/${vehicleId}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('maintenance-files').upload(filePath, invoiceFile)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('maintenance-files').getPublicUrl(filePath)
        invoiceUrl = publicUrl
        invoiceName = invoiceFile.name
      }

      // Upload estimate if provided
      if (estimateFile) {
        const fileExt = estimateFile.name.split('.').pop()
        const fileName = `estimate-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `vehicle-repairs/${vehicleId}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('maintenance-files').upload(filePath, estimateFile)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('maintenance-files').getPublicUrl(filePath)
        estimateUrl = publicUrl
        estimateName = estimateFile.name
      }

      const { error } = await supabase.from('vehicle_repairs')
        .update({
          repair_type: formData.repair_type,
          title: formData.title,
          description: formData.description || null,
          service_provider: formData.service_provider || null,
          service_location: formData.service_location || null,
          repair_date: formData.repair_date,
          mileage_at_repair: formData.mileage_at_repair ? parseInt(formData.mileage_at_repair) : null,
          labor_cost: formData.labor_cost ? parseFloat(formData.labor_cost) : null,
          parts_cost: formData.parts_cost ? parseFloat(formData.parts_cost) : null,
          total_cost: parseFloat(formData.total_cost),
          status: formData.status,
          invoice_file_url: invoiceUrl,
          invoice_file_name: invoiceName,
          estimate_file_url: estimateUrl,
          estimate_file_name: estimateName,
          notes: formData.notes || null,
        })
        .eq('id', editingItem.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vehicle-repairs', vehicleId])
      handleCloseModal()
    },
    onError: (error) => setError(error.message || 'Eroare la actualizarea reparației'),
    onSettled: () => setUploading(false)
  })

  // Add repair mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      if (editMode) return updateMutation.mutateAsync()

      setUploading(true)

      let invoiceUrl = null, invoiceName = null
      let estimateUrl = null, estimateName = null

      // Upload invoice if provided
      if (invoiceFile) {
        const fileExt = invoiceFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `vehicle-repairs/${vehicleId}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('maintenance-files').upload(filePath, invoiceFile)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('maintenance-files').getPublicUrl(filePath)
        invoiceUrl = publicUrl
        invoiceName = invoiceFile.name
      }

      // Upload estimate if provided
      if (estimateFile) {
        const fileExt = estimateFile.name.split('.').pop()
        const fileName = `estimate-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `vehicle-repairs/${vehicleId}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('maintenance-files').upload(filePath, estimateFile)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('maintenance-files').getPublicUrl(filePath)
        estimateUrl = publicUrl
        estimateName = estimateFile.name
      }

      const { error } = await supabase.from('vehicle_repairs').insert([{
        vehicle_id: vehicleId,
        repair_type: formData.repair_type,
        title: formData.title,
        description: formData.description || null,
        service_provider: formData.service_provider || null,
        service_location: formData.service_location || null,
        repair_date: formData.repair_date,
        mileage_at_repair: formData.mileage_at_repair ? parseInt(formData.mileage_at_repair) : null,
        labor_cost: formData.labor_cost ? parseFloat(formData.labor_cost) : null,
        parts_cost: formData.parts_cost ? parseFloat(formData.parts_cost) : null,
        total_cost: parseFloat(formData.total_cost),
        status: formData.status,
        invoice_file_url: invoiceUrl,
        invoice_file_name: invoiceName,
        estimate_file_url: estimateUrl,
        estimate_file_name: estimateName,
        notes: formData.notes || null,
        created_by: profile.id
      }])
      if (error) throw error
    },
    onSuccess: () => {
      if (!editMode) {
        queryClient.invalidateQueries(['vehicle-repairs', vehicleId])
        handleCloseModal()
      }
    },
    onError: (error) => setError(error.message || 'Eroare la adăugarea reparației'),
    onSettled: () => { if (!editMode) setUploading(false) }
  })

  const deleteMutation = useMutation({
    mutationFn: async (repairId) => {
      const { error } = await supabase.from('vehicle_repairs').delete().eq('id', repairId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(['vehicle-repairs', vehicleId])
  })

  const handleDelete = (repair) => {
    if (window.confirm(`Ștergi reparația "${repair.title}"?`)) {
      deleteMutation.mutate(repair.id)
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-gray-900">{t('vehicles.repairs')}</h2>
        {canEdit && (
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700">
            <Plus className="w-4 h-4 mr-2" />{t('vehicles.addRepair')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Se încarcă...</div>
      ) : repairs && repairs.length > 0 ? (
        <div className="space-y-4">
          {repairs.map((repair) => {
            const statusBadge = getStatusBadge(repair.status)
            return (
              <div key={repair.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-base font-semibold text-gray-900">{repair.title}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                        {statusBadge.label}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {t(`vehicles.${repair.repair_type}`)}
                      </span>
                    </div>
                    {repair.description && <p className="text-sm text-gray-600 mb-2">{repair.description}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center space-x-2 ml-4">
                      <button onClick={() => handleEdit(repair)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editează">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(repair)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Șterge">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>{new Date(repair.repair_date).toLocaleDateString('ro-RO')}</span>
                  </div>
                  {repair.mileage_at_repair && (
                    <div className="flex items-center text-gray-600">
                      <Gauge className="w-4 h-4 mr-2" />
                      <span>{repair.mileage_at_repair?.toLocaleString()} km</span>
                    </div>
                  )}
                  {repair.service_provider && (
                    <div className="flex items-center text-gray-600">
                      <Wrench className="w-4 h-4 mr-2" />
                      <span className="truncate">{repair.service_provider}</span>
                    </div>
                  )}
                  <div className="flex items-center text-gray-600 font-semibold">
                    <DollarSign className="w-4 h-4 mr-1" />
                    <span>{repair.total_cost?.toFixed(2)} RON</span>
                  </div>
                </div>

                {(repair.labor_cost || repair.parts_cost) && (
                  <div className="mt-2 text-xs text-gray-500 flex space-x-4">
                    {repair.labor_cost && <span>Manoperă: {repair.labor_cost.toFixed(2)} RON</span>}
                    {repair.parts_cost && <span>Piese: {repair.parts_cost.toFixed(2)} RON</span>}
                  </div>
                )}

                {repair.invoice_file_url && (
                  <div className="mt-3">
                    <a href={repair.invoice_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary-600 hover:text-primary-700 text-xs">
                      <Download className="w-3 h-3 mr-1" />Descarcă factură
                    </a>
                  </div>
                )}

                {repair.estimate_file_url && (
                  <div className="mt-3">
                    <a href={repair.estimate_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-600 hover:text-blue-700 text-xs ml-4">
                      <Download className="w-3 h-3 mr-1" />Descarcă deviz
                    </a>
                  </div>
                )}

                {repair.notes && <p className="mt-3 text-xs text-gray-500 italic">{repair.notes}</p>}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
          <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>{t('vehicles.noRepairs')}</p>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={handleCloseModal} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">{editMode ? 'Editează Reparație' : t('vehicles.addRepair')}</h3>
              {error && <div className="mb-4 rounded-md bg-red-50 p-4"><p className="text-sm text-red-800">{error}</p></div>}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tip Reparație *</label>
                    <select value={formData.repair_type} onChange={(e) => setFormData({ ...formData, repair_type: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                      <option value="preventiva">{t('vehicles.preventiva')}</option>
                      <option value="corectiva">{t('vehicles.corectiva')}</option>
                      <option value="accident">{t('vehicles.accident')}</option>
                      <option value="revizie">{t('vehicles.revizie')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status *</label>
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                      <option value="scheduled">{t('vehicles.scheduled')}</option>
                      <option value="in_progress">{t('vehicles.inProgress')}</option>
                      <option value="completed">{t('vehicles.completed')}</option>
                      <option value="cancelled">{t('vehicles.cancelled')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Titlu Reparație *</label>
                  <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" placeholder="ex: Schimb ulei și filtre" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Descriere</label>
                  <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Service/Atelier</label>
                    <input type="text" value={formData.service_provider} onChange={(e) => setFormData({ ...formData, service_provider: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Locație Service</label>
                    <input type="text" value={formData.service_location} onChange={(e) => setFormData({ ...formData, service_location: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data Reparație *</label>
                    <DateInput
                      value={formData.repair_date}
                      onChange={(e) => setFormData({ ...formData, repair_date: e.target.value })}
                      required
                      placeholder="dd/mm/yyyy"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Kilometraj</label>
                    <input type="number" value={formData.mileage_at_repair} onChange={(e) => setFormData({ ...formData, mileage_at_repair: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cost Manoperă</label>
                    <input type="number" step="0.01" value={formData.labor_cost} onChange={(e) => setFormData({ ...formData, labor_cost: e.target.value })} onBlur={calculateTotal} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cost Piese</label>
                    <input type="number" step="0.01" value={formData.parts_cost} onChange={(e) => setFormData({ ...formData, parts_cost: e.target.value })} onBlur={calculateTotal} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cost Total (RON) *</label>
                    <input type="number" step="0.01" required value={formData.total_cost} onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deviz {editMode && '(opțional - înlocuiește existent)'}
                    </label>
                    {editMode && editingItem?.estimate_file_name && (
                      <p className="text-xs text-gray-500 mb-1">
                        📄 Curent: {editingItem.estimate_file_name}
                      </p>
                    )}
                    <input type="file" onChange={handleEstimateFileSelect} accept=".pdf,.jpg,.jpeg,.png" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Factură {editMode && '(opțional - înlocuiește existent)'}
                    </label>
                    {editMode && editingItem?.invoice_file_name && (
                      <p className="text-xs text-gray-500 mb-1">
                        📄 Curent: {editingItem.invoice_file_name}
                      </p>
                    )}
                    <input type="file" onChange={handleFileSelect} accept=".pdf,.jpg,.jpeg,.png" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Observații</label>
                  <textarea rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={handleCloseModal} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Anulează</button>
                <button onClick={() => addMutation.mutate()} disabled={uploading || !formData.title || !formData.repair_date || !formData.total_cost} className="px-4 py-2 bg-primary-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {uploading ? 'Se salvează...' : editMode ? 'Actualizează' : 'Salvează'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
