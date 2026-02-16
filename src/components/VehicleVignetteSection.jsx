import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Ticket, Plus, Calendar, DollarSign, Trash2, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Download, Edit2 } from 'lucide-react'
import DateInput from './DateInput'

export default function VehicleVignetteSection({ vehicleId, vignettes, isLoading }) {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [formData, setFormData] = useState({
    vignette_type: '1_an',
    country: 'Romania',
    serial_number: '',
    start_date: '',
    end_date: '',
    price: '',
    notes: '',
  })
  const [receiptFile, setReceiptFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'

  const activeVignette = vignettes?.find(v => v.is_active)
  const historicalVignettes = vignettes?.filter(v => !v.is_active) || []

  const isExpired = (endDate) => new Date(endDate) < new Date()
  const isExpiringSoon = (endDate) => {
    const days = Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))
    return days <= 30 && days > 0
  }
  const getDaysUntilExpiry = (endDate) => Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Fișierul este prea mare. Maxim 5MB.')
      return
    }
    setReceiptFile(file)
    setError('')
  }

  // Handle edit
  const handleEdit = (vignette) => {
    setEditMode(true)
    setEditingItem(vignette)
    setFormData({
      vignette_type: vignette.vignette_type,
      country: vignette.country,
      serial_number: vignette.serial_number || '',
      start_date: vignette.start_date,
      end_date: vignette.end_date,
      price: vignette.price.toString(),
      notes: vignette.notes || '',
    })
    setShowAddModal(true)
  }

  // Handle close modal
  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditMode(false)
    setEditingItem(null)
    setReceiptFile(null)
    setFormData({ vignette_type: '1_an', country: 'Romania', serial_number: '', start_date: '', end_date: '', price: '', notes: '' })
    setError('')
  }

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      setUploading(true)

      let receiptUrl = editingItem.receipt_file_url
      let receiptName = editingItem.receipt_file_name

      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `vehicle-vignettes/${vehicleId}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('maintenance-files').upload(filePath, receiptFile)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('maintenance-files').getPublicUrl(filePath)
        receiptUrl = publicUrl
        receiptName = receiptFile.name
      }

      const isExpiredVignette = new Date(formData.end_date) < new Date()
      const isActiveValue = !isExpiredVignette

      const { error } = await supabase.from('vehicle_vignettes')
        .update({
          vignette_type: formData.vignette_type,
          country: formData.country,
          serial_number: formData.serial_number || null,
          start_date: formData.start_date,
          end_date: formData.end_date,
          price: parseFloat(formData.price),
          receipt_file_url: receiptUrl,
          receipt_file_name: receiptName,
          notes: formData.notes || null,
          is_active: isActiveValue,
        })
        .eq('id', editingItem.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vehicle-vignettes', vehicleId])
      handleCloseModal()
    },
    onError: (error) => setError(error.message || 'Eroare la actualizarea rovinietei'),
    onSettled: () => setUploading(false)
  })

  // Add vignette mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      if (editMode) return updateMutation.mutateAsync()

      setUploading(true)

      let receiptUrl = null, receiptName = null
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `vehicle-vignettes/${vehicleId}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('maintenance-files').upload(filePath, receiptFile)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('maintenance-files').getPublicUrl(filePath)
        receiptUrl = publicUrl
        receiptName = receiptFile.name
      }

      const isExpiredVignette = new Date(formData.end_date) < new Date()
      const isActiveValue = !isExpiredVignette

      const { error } = await supabase.from('vehicle_vignettes').insert([{
        vehicle_id: vehicleId,
        vignette_type: formData.vignette_type,
        country: formData.country,
        serial_number: formData.serial_number || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        price: parseFloat(formData.price),
        receipt_file_url: receiptUrl,
        receipt_file_name: receiptName,
        notes: formData.notes || null,
        is_active: isActiveValue,
        created_by: profile.id
      }])
      if (error) throw error
    },
    onSuccess: () => {
      if (!editMode) {
        queryClient.invalidateQueries(['vehicle-vignettes', vehicleId])
        handleCloseModal()
      }
    },
    onError: (error) => setError(error.message || 'Eroare la adăugarea rovinietei'),
    onSettled: () => { if (!editMode) setUploading(false) }
  })

  const deleteMutation = useMutation({
    mutationFn: async (vignetteId) => {
      const { error } = await supabase.from('vehicle_vignettes').delete().eq('id', vignetteId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(['vehicle-vignettes', vehicleId])
  })

  const handleDelete = (vignette) => {
    if (window.confirm(`Ștergi rovinieta ${t(`vehicles.${vignette.vignette_type}`)}?`)) {
      deleteMutation.mutate(vignette.id)
    }
  }

  const renderVignetteCard = (vignette, isActive = true) => {
    if (!vignette) return null
    const expired = isExpired(vignette.end_date)
    const expiringSoon = !expired && isExpiringSoon(vignette.end_date)
    const daysLeft = getDaysUntilExpiry(vignette.end_date)

    return (
      <div className={`border rounded-lg p-4 ${
        isActive 
          ? expired ? 'border-red-300 bg-red-50' : expiringSoon ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Ticket className={`w-5 h-5 ${expired ? 'text-red-600' : expiringSoon ? 'text-yellow-600' : 'text-green-600'}`} />
            <span className="font-semibold text-gray-900">{t(`vehicles.${vignette.vignette_type}`)}</span>
            {isActive && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                expired ? 'bg-red-100 text-red-800' : expiringSoon ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
              }`}>
                {expired ? <><AlertTriangle className="w-3 h-3 mr-1" />Expirat</> : expiringSoon ? <><AlertTriangle className="w-3 h-3 mr-1" />{daysLeft} zile</> : <><CheckCircle className="w-3 h-3 mr-1" />Activ</>}
              </span>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center space-x-2">
              <button onClick={() => handleEdit(vignette)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editează">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(vignette)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Șterge">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center text-gray-600">
            <Calendar className="w-4 h-4 mr-2" />
            <span>{new Date(vignette.start_date).toLocaleDateString('ro-RO')} - {new Date(vignette.end_date).toLocaleDateString('ro-RO')}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <DollarSign className="w-4 h-4 mr-2" />
            <span>{vignette.price?.toFixed(2)} RON</span>
          </div>
          {vignette.serial_number && <p className="text-gray-600 text-xs">Serie: {vignette.serial_number}</p>}
          {vignette.notes && <p className="text-gray-500 text-xs mt-2">{vignette.notes}</p>}
          {vignette.receipt_file_url && (
            <a href={vignette.receipt_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary-600 hover:text-primary-700 text-xs mt-2">
              <Download className="w-3 h-3 mr-1" />Descarcă chitanță
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-gray-900">{t('vehicles.vignette')}</h2>
        {canEdit && (
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700">
            <Plus className="w-4 h-4 mr-2" />{t('vehicles.addVignette')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Se încarcă...</div>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-medium text-gray-900">{t('vehicles.currentVignette')}</h3>
              {historicalVignettes.length > 0 && (
                <button onClick={() => setShowHistory(!showHistory)} className="text-sm text-primary-600 hover:text-primary-700 flex items-center">
                  {showHistory ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                  Istoric ({historicalVignettes.length})
                </button>
              )}
            </div>

            {activeVignette ? renderVignetteCard(activeVignette, true) : (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                <Ticket className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>{t('vehicles.noVignettes')}</p>
              </div>
            )}

            {showHistory && historicalVignettes.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Istoric Roviniete:</p>
                {historicalVignettes.map(v => <div key={v.id}>{renderVignetteCard(v, false)}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={handleCloseModal} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">{editMode ? 'Editează Rovinieta' : t('vehicles.addVignette')}</h3>
              {error && <div className="mb-4 rounded-md bg-red-50 p-4"><p className="text-sm text-red-800">{error}</p></div>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tip Rovinieta *</label>
                  <select value={formData.vignette_type} onChange={(e) => setFormData({ ...formData, vignette_type: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
                    <option value="7_zile">{t('vehicles.7_zile')}</option>
                    <option value="1_luna">{t('vehicles.1_luna')}</option>
                    <option value="3_luni">{t('vehicles.3_luni')}</option>
                    <option value="1_an">{t('vehicles.1_an')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Țară</label>
                  <input type="text" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" placeholder="Romania" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Număr Serie</label>
                  <input type="text" value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data Început *</label>
                    <DateInput
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                      placeholder="dd/mm/yyyy"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data Sfârșit *</label>
                    <DateInput
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                      placeholder="dd/mm/yyyy"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Preț (RON) *</label>
                  <input type="number" step="0.01" required value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chitanță {editMode && '(opțional - înlocuiește existent)'}
                  </label>
                  {editMode && editingItem?.file_name && (
                    <p className="text-xs text-gray-500 mb-1">
                      📄 Curent: {editingItem.file_name}
                    </p>
                  )}
                  <input type="file" onChange={handleFileSelect} accept=".pdf,.jpg,.jpeg,.png" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Observații</label>
                  <textarea rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={handleCloseModal} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Anulează</button>
                <button onClick={() => addMutation.mutate()} disabled={uploading || !formData.start_date || !formData.end_date || !formData.price} className="px-4 py-2 bg-primary-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
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
