import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { ClipboardCheck, Plus, Calendar, DollarSign, Trash2, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Download, Edit2, MapPin, FileText } from 'lucide-react'
import DateInput, { getTodayISO } from './DateInput'

export default function VehicleITPSection({ vehicleId, itpRecords, isLoading }) {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [formData, setFormData] = useState({
    itp_date: getTodayISO(),
    expiry_date: '',
    result: 'admis',
    itp_station: '',
    itp_location: '',
    certificate_number: '',
    mileage_at_itp: '',
    deficiencies: '',
    notes: '',
    cost: '',
  })
  const [certificateFile, setCertificateFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'

  const activeITP = itpRecords?.find(itp => itp.is_active)
  const historicalITP = itpRecords?.filter(itp => !itp.is_active) || []

  const isExpired = (expiryDate) => new Date(expiryDate) < new Date()
  const isExpiringSoon = (expiryDate) => {
    const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    return days <= 30 && days > 0
  }
  const getDaysUntilExpiry = (expiryDate) => Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24))

  // Get result badge styling
  const getResultBadge = (result) => {
    const badges = {
      admis: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle, label: t('vehicles.admis') },
      respins: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle, label: t('vehicles.respins') },
      admis_conditii: { bg: 'bg-orange-100', text: 'text-orange-800', icon: AlertTriangle, label: t('vehicles.admis_conditii') }
    }
    return badges[result] || badges.admis
  }

  // Handle certificate file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Fișierul este prea mare. Maxim 5MB.')
      return
    }
    setCertificateFile(file)
    setError('')
  }

  // Handle edit
  const handleEdit = (itp) => {
    setEditMode(true)
    setEditingItem(itp)
    setFormData({
      itp_date: itp.itp_date,
      expiry_date: itp.expiry_date,
      result: itp.result,
      itp_station: itp.itp_station || '',
      itp_location: itp.itp_location || '',
      certificate_number: itp.certificate_number || '',
      mileage_at_itp: itp.mileage_at_itp?.toString() || '',
      deficiencies: itp.deficiencies || '',
      notes: itp.notes || '',
      cost: itp.cost?.toString() || '',
    })
    setShowAddModal(true)
  }

  // Handle close modal
  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditMode(false)
    setEditingItem(null)
    setCertificateFile(null)
    setFormData({
      itp_date: getTodayISO(),
      expiry_date: '',
      result: 'admis',
      itp_station: '',
      itp_location: '',
      certificate_number: '',
      mileage_at_itp: '',
      deficiencies: '',
      notes: '',
      cost: '',
    })
    setError('')
  }

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      setUploading(true)

      let certificateUrl = editingItem.certificate_file_url
      let certificateName = editingItem.certificate_file_name

      if (certificateFile) {
        const fileExt = certificateFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `vehicle-itp/${vehicleId}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('maintenance-files').upload(filePath, certificateFile)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('maintenance-files').getPublicUrl(filePath)
        certificateUrl = publicUrl
        certificateName = certificateFile.name
      }

      // Check if ITP is expired
      const isExpiredITP = new Date(formData.expiry_date) < new Date()
      const isActiveValue = !isExpiredITP

      const { error } = await supabase.from('vehicle_itp')
        .update({
          itp_date: formData.itp_date,
          expiry_date: formData.expiry_date,
          result: formData.result,
          itp_station: formData.itp_station || null,
          itp_location: formData.itp_location || null,
          certificate_number: formData.certificate_number || null,
          mileage_at_itp: formData.mileage_at_itp ? parseInt(formData.mileage_at_itp) : null,
          deficiencies: formData.deficiencies || null,
          notes: formData.notes || null,
          cost: formData.cost ? parseFloat(formData.cost) : null,
          certificate_file_url: certificateUrl,
          certificate_file_name: certificateName,
          is_active: isActiveValue,
        })
        .eq('id', editingItem.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vehicle-itp', vehicleId])
      handleCloseModal()
    },
    onError: (error) => setError(error.message || 'Eroare la actualizarea ITP'),
    onSettled: () => setUploading(false)
  })

  // Add ITP mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      if (editMode) return updateMutation.mutateAsync()

      setUploading(true)

      let certificateUrl = null, certificateName = null
      if (certificateFile) {
        const fileExt = certificateFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `vehicle-itp/${vehicleId}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('maintenance-files').upload(filePath, certificateFile)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('maintenance-files').getPublicUrl(filePath)
        certificateUrl = publicUrl
        certificateName = certificateFile.name
      }

      // Check if ITP is expired
      const isExpiredITP = new Date(formData.expiry_date) < new Date()
      const isActiveValue = !isExpiredITP

      const { error } = await supabase.from('vehicle_itp').insert([{
        vehicle_id: vehicleId,
        itp_date: formData.itp_date,
        expiry_date: formData.expiry_date,
        result: formData.result,
        itp_station: formData.itp_station || null,
        itp_location: formData.itp_location || null,
        certificate_number: formData.certificate_number || null,
        mileage_at_itp: formData.mileage_at_itp ? parseInt(formData.mileage_at_itp) : null,
        deficiencies: formData.deficiencies || null,
        notes: formData.notes || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        certificate_file_url: certificateUrl,
        certificate_file_name: certificateName,
        is_active: isActiveValue,
        created_by: profile.id
      }])
      if (error) throw error
    },
    onSuccess: () => {
      if (!editMode) {
        queryClient.invalidateQueries(['vehicle-itp', vehicleId])
        handleCloseModal()
      }
    },
    onError: (error) => setError(error.message || 'Eroare la adăugarea ITP'),
    onSettled: () => { if (!editMode) setUploading(false) }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (itpId) => {
      const { error } = await supabase.from('vehicle_itp').delete().eq('id', itpId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(['vehicle-itp', vehicleId])
  })

  const handleDelete = (itp) => {
    if (window.confirm(`Ștergi ITP din ${new Date(itp.itp_date).toLocaleDateString('ro-RO')}?`)) {
      deleteMutation.mutate(itp.id)
    }
  }

  // Render ITP card
  const renderITPCard = (itp, isActive = true) => {
    if (!itp) return null
    const expired = isExpired(itp.expiry_date)
    const expiringSoon = !expired && isExpiringSoon(itp.expiry_date)
    const daysLeft = getDaysUntilExpiry(itp.expiry_date)
    const resultBadge = getResultBadge(itp.result)
    const ResultIcon = resultBadge.icon

    return (
      <div className={`border rounded-lg p-4 ${
        isActive 
          ? expired ? 'border-red-300 bg-red-50' : expiringSoon ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <ClipboardCheck className={`w-5 h-5 ${expired ? 'text-red-600' : expiringSoon ? 'text-yellow-600' : 'text-green-600'}`} />
            <span className="font-semibold text-gray-900">
              ITP {new Date(itp.itp_date).toLocaleDateString('ro-RO')}
            </span>
            {isActive && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                expired ? 'bg-red-100 text-red-800' : expiringSoon ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
              }`}>
                {expired ? <><AlertTriangle className="w-3 h-3 mr-1" />Expirat</> : expiringSoon ? <><AlertTriangle className="w-3 h-3 mr-1" />{daysLeft} zile</> : <><CheckCircle className="w-3 h-3 mr-1" />Valabil</>}
              </span>
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${resultBadge.bg} ${resultBadge.text}`}>
              <ResultIcon className="w-3 h-3 mr-1" />
              {resultBadge.label}
            </span>
          </div>
          
          {canEdit && (
            <div className="flex items-center space-x-2">
              <button onClick={() => handleEdit(itp)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editează">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(itp)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Șterge">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center text-gray-600">
            <Calendar className="w-4 h-4 mr-2" />
            <span>Valabil până: {new Date(itp.expiry_date).toLocaleDateString('ro-RO')}</span>
          </div>
          {itp.itp_station && (
            <div className="flex items-center text-gray-600">
              <MapPin className="w-4 h-4 mr-2" />
              <span>{itp.itp_station}{itp.itp_location && `, ${itp.itp_location}`}</span>
            </div>
          )}
          {itp.certificate_number && (
            <div className="flex items-center text-gray-600">
              <FileText className="w-4 h-4 mr-2" />
              <span>Certificat: {itp.certificate_number}</span>
            </div>
          )}
          {itp.cost && (
            <div className="flex items-center text-gray-600">
              <DollarSign className="w-4 h-4 mr-2" />
              <span>{itp.cost.toFixed(2)} RON</span>
            </div>
          )}
        </div>

        {itp.deficiencies && (
          <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
            <p className="font-medium text-orange-900">Deficiențe:</p>
            <p className="text-orange-800 mt-1">{itp.deficiencies}</p>
          </div>
        )}

        {itp.notes && <p className="text-gray-500 text-xs mt-2">{itp.notes}</p>}

        {itp.certificate_file_url && (
          <a href={itp.certificate_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary-600 hover:text-primary-700 text-xs mt-3">
            <Download className="w-3 h-3 mr-1" />Descarcă certificat ITP
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-gray-900">{t('vehicles.itp')}</h2>
        {canEdit && (
          <button onClick={() => setShowAddModal(true)} className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700">
            <Plus className="w-4 h-4 mr-2" />{t('vehicles.addITP')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Se încarcă...</div>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-medium text-gray-900">{t('vehicles.currentITP')}</h3>
              {historicalITP.length > 0 && (
                <button onClick={() => setShowHistory(!showHistory)} className="text-sm text-primary-600 hover:text-primary-700 flex items-center">
                  {showHistory ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                  Istoric ({historicalITP.length})
                </button>
              )}
            </div>

            {activeITP ? renderITPCard(activeITP, true) : (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>{t('vehicles.noITP')}</p>
              </div>
            )}

            {showHistory && historicalITP.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Istoric ITP:</p>
                {historicalITP.map(itp => <div key={itp.id}>{renderITPCard(itp, false)}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={handleCloseModal} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editMode ? 'Editează ITP' : t('vehicles.addITP')}
              </h3>
              {error && <div className="mb-4 rounded-md bg-red-50 p-4"><p className="text-sm text-red-800">{error}</p></div>}
              
              <div className="space-y-4">
                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data ITP *</label>
                    <DateInput
                      value={formData.itp_date}
                      onChange={(e) => setFormData({ ...formData, itp_date: e.target.value })}
                      required
                      placeholder="dd/mm/yyyy"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data Expirare *</label>
                    <DateInput
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                      required
                      placeholder="dd/mm/yyyy"
                    />
                  </div>
                </div>

                {/* Result */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rezultat ITP *</label>
                  <select 
                    value={formData.result} 
                    onChange={(e) => setFormData({ ...formData, result: e.target.value })} 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  >
                    <option value="admis">{t('vehicles.admis')}</option>
                    <option value="respins">{t('vehicles.respins')}</option>
                    <option value="admis_conditii">{t('vehicles.admis_conditii')}</option>
                  </select>
                </div>

                {/* ITP Station */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Stație ITP</label>
                    <input 
                      type="text" 
                      value={formData.itp_station} 
                      onChange={(e) => setFormData({ ...formData, itp_station: e.target.value })} 
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                      placeholder="ex: ITP Rapid"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Locație Stație</label>
                    <input 
                      type="text" 
                      value={formData.itp_location} 
                      onChange={(e) => setFormData({ ...formData, itp_location: e.target.value })} 
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                      placeholder="ex: București"
                    />
                  </div>
                </div>

                {/* Certificate Number and Mileage */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Număr Certificat</label>
                    <input 
                      type="text" 
                      value={formData.certificate_number} 
                      onChange={(e) => setFormData({ ...formData, certificate_number: e.target.value })} 
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Kilometraj</label>
                    <input 
                      type="number" 
                      value={formData.mileage_at_itp} 
                      onChange={(e) => setFormData({ ...formData, mileage_at_itp: e.target.value })} 
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                      placeholder="ex: 50000"
                    />
                  </div>
                </div>

                {/* Cost */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cost (RON)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={formData.cost} 
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })} 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                    placeholder="ex: 150.00"
                  />
                </div>

                {/* Deficiencies */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Deficiențe Constatate</label>
                  <textarea 
                    rows={3} 
                    value={formData.deficiencies} 
                    onChange={(e) => setFormData({ ...formData, deficiencies: e.target.value })} 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm" 
                    placeholder="Lista deficiențelor (dacă există)"
                  />
                </div>

                {/* Certificate Upload */}
                {!editMode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Certificat ITP</label>
                    <input 
                      type="file" 
                      onChange={handleFileSelect} 
                      accept=".pdf,.jpg,.jpeg,.png" 
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" 
                    />
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
                  disabled={uploading || !formData.itp_date || !formData.expiry_date} 
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
