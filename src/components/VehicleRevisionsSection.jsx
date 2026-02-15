import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Settings, Plus, Calendar, Gauge, DollarSign, Trash2, Download, Edit2, Droplets, Wrench } from 'lucide-react'
import DateInput, { getTodayISO } from './DateInput'

export default function VehicleRevisionsSection({ vehicleId, revisions, isLoading }) {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    revision_type: 'schimb_ulei',
    revision_date: getTodayISO(),
    mileage_at_revision: '',
    oil_type: '',
    oil_quantity: '',
    oil_brand: '',
    service_provider: '',
    service_location: '',
    labor_cost: '',
    parts_cost: '',
    total_cost: '',
    next_revision_km: '',
    next_revision_date: '',
    notes: '',
  })
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [estimateFile, setEstimateFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'

  // Get icon based on revision type
  const getRevisionIcon = (type) => {
    switch(type) {
      case 'schimb_ulei':
        return Droplets
      case 'schimb_distributie':
        return Settings
      default:
        return Wrench
    }
  }

  // Handle file selection
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

  // Calculate total cost
  const calculateTotal = () => {
    const labor = parseFloat(formData.labor_cost) || 0
    const parts = parseFloat(formData.parts_cost) || 0
    setFormData({ ...formData, total_cost: (labor + parts).toFixed(2) })
  }

  // Handle edit
  const handleEdit = (revision) => {
    setEditMode(true)
    setEditingItem(revision)
    setFormData({
      revision_type: revision.revision_type,
      revision_date: revision.revision_date,
      mileage_at_revision: revision.mileage_at_revision?.toString() || '',
      oil_type: revision.oil_type || '',
      oil_quantity: revision.oil_quantity?.toString() || '',
      oil_brand: revision.oil_brand || '',
      service_provider: revision.service_provider || '',
      service_location: revision.service_location || '',
      labor_cost: revision.labor_cost?.toString() || '',
      parts_cost: revision.parts_cost?.toString() || '',
      total_cost: revision.total_cost?.toString() || '',
      next_revision_km: revision.next_revision_km?.toString() || '',
      next_revision_date: revision.next_revision_date || '',
      notes: revision.notes || '',
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
    setFormData({
      revision_type: 'schimb_ulei',
      revision_date: getTodayISO(),
      mileage_at_revision: '',
      oil_type: '',
      oil_quantity: '',
      oil_brand: '',
      service_provider: '',
      service_location: '',
      labor_cost: '',
      parts_cost: '',
      total_cost: '',
      next_revision_km: '',
      next_revision_date: '',
      notes: '',
    })
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
        const filePath = `vehicle-revisions/${vehicleId}/${fileName}`

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
        const filePath = `vehicle-revisions/${vehicleId}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('maintenance-files').upload(filePath, estimateFile)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('maintenance-files').getPublicUrl(filePath)
        estimateUrl = publicUrl
        estimateName = estimateFile.name
      }

      const { error } = await supabase.from('vehicle_revisions')
        .update({
          revision_type: formData.revision_type,
          revision_date: formData.revision_date,
          mileage_at_revision: formData.mileage_at_revision ? parseInt(formData.mileage_at_revision) : null,
          oil_type: formData.oil_type || null,
          oil_quantity: formData.oil_quantity ? parseFloat(formData.oil_quantity) : null,
          oil_brand: formData.oil_brand || null,
          service_provider: formData.service_provider || null,
          service_location: formData.service_location || null,
          labor_cost: formData.labor_cost ? parseFloat(formData.labor_cost) : null,
          parts_cost: formData.parts_cost ? parseFloat(formData.parts_cost) : null,
          total_cost: parseFloat(formData.total_cost),
          next_revision_km: formData.next_revision_km ? parseInt(formData.next_revision_km) : null,
          next_revision_date: formData.next_revision_date || null,
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
      queryClient.invalidateQueries(['vehicle-revisions', vehicleId])
      handleCloseModal()
    },
    onError: (error) => setError(error.message || 'Eroare la actualizarea reviziei'),
    onSettled: () => setUploading(false)
  })

  // Add revision mutation
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
        const filePath = `vehicle-revisions/${vehicleId}/${fileName}`

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
        const filePath = `vehicle-revisions/${vehicleId}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('maintenance-files').upload(filePath, estimateFile)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('maintenance-files').getPublicUrl(filePath)
        estimateUrl = publicUrl
        estimateName = estimateFile.name
      }

      const { error } = await supabase.from('vehicle_revisions').insert([{
        vehicle_id: vehicleId,
        revision_type: formData.revision_type,
        revision_date: formData.revision_date,
        mileage_at_revision: formData.mileage_at_revision ? parseInt(formData.mileage_at_revision) : null,
        oil_type: formData.oil_type || null,
        oil_quantity: formData.oil_quantity ? parseFloat(formData.oil_quantity) : null,
        oil_brand: formData.oil_brand || null,
        service_provider: formData.service_provider || null,
        service_location: formData.service_location || null,
        labor_cost: formData.labor_cost ? parseFloat(formData.labor_cost) : null,
        parts_cost: formData.parts_cost ? parseFloat(formData.parts_cost) : null,
        total_cost: parseFloat(formData.total_cost),
        next_revision_km: formData.next_revision_km ? parseInt(formData.next_revision_km) : null,
        next_revision_date: formData.next_revision_date || null,
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
        queryClient.invalidateQueries(['vehicle-revisions', vehicleId])
        handleCloseModal()
      }
    },
    onError: (error) => setError(error.message || 'Eroare la adăugarea reviziei'),
    onSettled: () => { if (!editMode) setUploading(false) }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (revisionId) => {
      const { error } = await supabase.from('vehicle_revisions').delete().eq('id', revisionId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(['vehicle-revisions', vehicleId])
  })

  const handleDelete = (revision) => {
    if (window.confirm(`Ștergi revizia ${t(`vehicles.${revision.revision_type}`)}?`)) {
      deleteMutation.mutate(revision.id)
    }
  }

  // Show oil fields only for oil change
  const showOilFields = formData.revision_type === 'schimb_ulei'

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-gray-900">{t('vehicles.revisions')}</h2>
        {canEdit && (
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700">
            <Plus className="w-4 h-4 mr-2" />{t('vehicles.addRevision')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Se încarcă...</div>
      ) : revisions && revisions.length > 0 ? (
        <div className="space-y-4">
          {revisions.map((revision) => {
            const Icon = getRevisionIcon(revision.revision_type)
            return (
              <div key={revision.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Icon className="w-5 h-5 text-primary-600" />
                      <h3 className="text-base font-semibold text-gray-900">
                        {t(`vehicles.${revision.revision_type}`)}
                      </h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {new Date(revision.revision_date).toLocaleDateString('ro-RO')}
                      </span>
                    </div>

                    {/* Main Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-2">
                      {revision.mileage_at_revision && (
                        <div className="flex items-center text-gray-600">
                          <Gauge className="w-4 h-4 mr-2" />
                          <span>{revision.mileage_at_revision.toLocaleString()} km</span>
                        </div>
                      )}
                      {revision.service_provider && (
                        <div className="flex items-center text-gray-600">
                          <Wrench className="w-4 h-4 mr-2" />
                          <span className="truncate">{revision.service_provider}</span>
                        </div>
                      )}
                      <div className="flex items-center text-gray-600 font-semibold">
                        <DollarSign className="w-4 h-4 mr-1" />
                        <span>{revision.total_cost?.toFixed(2)} RON</span>
                      </div>
                    </div>

                    {/* Oil Details (if applicable) */}
                    {revision.revision_type === 'schimb_ulei' && (revision.oil_type || revision.oil_brand) && (
                      <div className="flex items-center space-x-4 text-xs text-gray-600 mb-2">
                        {revision.oil_brand && <span className="font-medium">Ulei: {revision.oil_brand}</span>}
                        {revision.oil_type && <span>{revision.oil_type}</span>}
                        {revision.oil_quantity && <span>{revision.oil_quantity}L</span>}
                      </div>
                    )}

                    {/* Cost Breakdown */}
                    {(revision.labor_cost || revision.parts_cost) && (
                      <div className="text-xs text-gray-500 flex space-x-4">
                        {revision.labor_cost && <span>Manoperă: {revision.labor_cost.toFixed(2)} RON</span>}
                        {revision.parts_cost && <span>Piese: {revision.parts_cost.toFixed(2)} RON</span>}
                      </div>
                    )}

                    {/* Next Revision Info */}
                    {(revision.next_revision_km || revision.next_revision_date) && (
                      <div className="mt-2 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 inline-block">
                        Următoarea revizie: 
                        {revision.next_revision_km && <span> la {revision.next_revision_km.toLocaleString()} km</span>}
                        {revision.next_revision_km && revision.next_revision_date && <span> sau</span>}
                        {revision.next_revision_date && <span> pe {new Date(revision.next_revision_date).toLocaleDateString('ro-RO')}</span>}
                      </div>
                    )}

                    {/* Invoice */}
                    {revision.invoice_file_url && (
                      <div className="mt-2">
                        <a href={revision.invoice_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary-600 hover:text-primary-700 text-xs">
                          <Download className="w-3 h-3 mr-1" />Descarcă factură
                        </a>
                      </div>
                    )}

                    {/* Estimate */}
                    {revision.estimate_file_url && (
                      <div className="mt-2">
                        <a href={revision.estimate_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-600 hover:text-blue-700 text-xs ml-4">
                          <Download className="w-3 h-3 mr-1" />Descarcă deviz
                        </a>
                      </div>
                    )}

                    {/* Notes */}
                    {revision.notes && <p className="mt-2 text-xs text-gray-500 italic">{revision.notes}</p>}
                  </div>

                  {/* Action Buttons */}
                  {canEdit && (
                    <div className="flex items-center space-x-2 ml-4">
                      <button onClick={() => handleEdit(revision)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editează">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(revision)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Șterge">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
          <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>{t('vehicles.noRevisions')}</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={handleCloseModal} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editMode ? 'Editează Revizie' : t('vehicles.addRevision')}
              </h3>
              {error && <div className="mb-4 rounded-md bg-red-50 p-4"><p className="text-sm text-red-800">{error}</p></div>}
              
              <div className="space-y-4">
                {/* Revision Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tip Revizie *</label>
                  <select 
                    value={formData.revision_type} 
                    onChange={(e) => setFormData({ ...formData, revision_type: e.target.value })} 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  >
                    <option value="schimb_ulei">{t('vehicles.schimb_ulei')}</option>
                    <option value="schimb_distributie">{t('vehicles.schimb_distributie')}</option>
                    <option value="revizie_completa">{t('vehicles.revizie_completa')}</option>
                    <option value="schimb_filtre">{t('vehicles.schimb_filtre')}</option>
                    <option value="schimb_placute">{t('vehicles.schimb_placute')}</option>
                    <option value="schimb_discuri">{t('vehicles.schimb_discuri')}</option>
                    <option value="alta_revizie">{t('vehicles.alta_revizie')}</option>
                  </select>
                </div>

                {/* Date and Mileage */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data Revizie *</label>
                    <DateInput
                      value={formData.revision_date}
                      onChange={(e) => setFormData({ ...formData, revision_date: e.target.value })}
                      required
                      placeholder="dd/mm/yyyy"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Kilometraj *</label>
                    <input 
                      type="number" 
                      required
                      value={formData.mileage_at_revision} 
                      onChange={(e) => setFormData({ ...formData, mileage_at_revision: e.target.value })} 
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                      placeholder="ex: 50000"
                    />
                  </div>
                </div>

                {/* Oil Fields (only for oil change) */}
                {showOilFields && (
                  <div className="border-l-4 border-blue-500 pl-4 space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">Detalii Ulei</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Tip Ulei</label>
                        <input 
                          type="text" 
                          value={formData.oil_type} 
                          onChange={(e) => setFormData({ ...formData, oil_type: e.target.value })} 
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                          placeholder="ex: 5W30"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Cantitate (L)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={formData.oil_quantity} 
                          onChange={(e) => setFormData({ ...formData, oil_quantity: e.target.value })} 
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                          placeholder="ex: 4.5"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Marcă Ulei</label>
                        <input 
                          type="text" 
                          value={formData.oil_brand} 
                          onChange={(e) => setFormData({ ...formData, oil_brand: e.target.value })} 
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                          placeholder="ex: Castrol"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Service Provider */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Service/Atelier</label>
                    <input 
                      type="text" 
                      value={formData.service_provider} 
                      onChange={(e) => setFormData({ ...formData, service_provider: e.target.value })} 
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Locație Service</label>
                    <input 
                      type="text" 
                      value={formData.service_location} 
                      onChange={(e) => setFormData({ ...formData, service_location: e.target.value })} 
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                    />
                  </div>
                </div>

                {/* Costs */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cost Manoperă</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={formData.labor_cost} 
                      onChange={(e) => setFormData({ ...formData, labor_cost: e.target.value })} 
                      onBlur={calculateTotal}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cost Piese</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={formData.parts_cost} 
                      onChange={(e) => setFormData({ ...formData, parts_cost: e.target.value })} 
                      onBlur={calculateTotal}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cost Total (RON) *</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      value={formData.total_cost} 
                      onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })} 
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                    />
                  </div>
                </div>

                {/* Next Revision */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Următoarea Revizie (opțional)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">La câți km</label>
                      <input 
                        type="number" 
                        value={formData.next_revision_km} 
                        onChange={(e) => setFormData({ ...formData, next_revision_km: e.target.value })} 
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                        placeholder="ex: 60000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">La ce dată</label>
                      <DateInput
                        value={formData.next_revision_date}
                        onChange={(e) => setFormData({ ...formData, next_revision_date: e.target.value })}
                        placeholder="dd/mm/yyyy"
                      />
                    </div>
                  </div>
                </div>

                {/* File Uploads */}
                {!editMode && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Deviz</label>
                      <input 
                        type="file" 
                        onChange={handleEstimateFileSelect} 
                        accept=".pdf,.jpg,.jpeg,.png" 
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Factură/Chitanță</label>
                      <input 
                        type="file" 
                        onChange={handleFileSelect} 
                        accept=".pdf,.jpg,.jpeg,.png" 
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" 
                      />
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Observații</label>
                  <textarea 
                    rows={2} 
                    value={formData.notes} 
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end space-x-3">
                <button 
                  onClick={handleCloseModal} 
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Anulează
                </button>
                <button 
                  onClick={() => addMutation.mutate()} 
                  disabled={uploading || !formData.revision_date || !formData.mileage_at_revision || !formData.total_cost} 
                  className="px-4 py-2 bg-primary-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
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
