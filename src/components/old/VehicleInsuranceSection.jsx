import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Shield, Plus, Calendar, DollarSign, FileText, Trash2, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Download } from 'lucide-react'

export default function VehicleInsuranceSection({ vehicleId, insurance, isLoading }) {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [showHistory, setShowHistory] = useState({ rca: false, casco: false })
  const [formData, setFormData] = useState({
    insurance_type: 'rca',
    insurance_company: '',
    policy_number: '',
    start_date: '',
    end_date: '',
    premium_amount: '',
    notes: '',
  })
  const [policyFile, setPolicyFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'

  // Separate active and historical insurance
  const activeRCA = insurance?.find(ins => ins.insurance_type === 'rca' && ins.is_active)
  const activeCASCO = insurance?.find(ins => ins.insurance_type === 'casco' && ins.is_active)
  const historicalRCA = insurance?.filter(ins => ins.insurance_type === 'rca' && !ins.is_active) || []
  const historicalCASCO = insurance?.filter(ins => ins.insurance_type === 'casco' && !ins.is_active) || []

  // Check if insurance is expiring soon (30 days)
  const isExpiringSoon = (endDate) => {
    const daysUntilExpiry = Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  }

  // Check if insurance is expired
  const isExpired = (endDate) => {
    return new Date(endDate) < new Date()
  }

  // Get days until expiry
  const getDaysUntilExpiry = (endDate) => {
    return Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))
  }

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setError('Fișierul este prea mare. Maxim 5MB.')
      return
    }

    setPolicyFile(file)
    setError('')
  }

  // Add insurance mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      setUploading(true)

      // Upload policy file if provided
      let policyFileUrl = null
      let policyFileName = null

      if (policyFile) {
        const fileExt = policyFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `vehicle-insurance/${vehicleId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('maintenance-files')
          .upload(filePath, policyFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('maintenance-files')
          .getPublicUrl(filePath)

        policyFileUrl = publicUrl
        policyFileName = policyFile.name
      }

      // Check if the insurance is already expired
      const isExpiredInsurance = new Date(formData.end_date) < new Date()
      
      // Only set as active if NOT expired
      // If expired, add it directly to history (is_active = false)
      const isActiveValue = !isExpiredInsurance

      // Insert new insurance
      // Note: trigger will deactivate old ones only if this one is active
      const { error } = await supabase
        .from('vehicle_insurance')
        .insert([{
          vehicle_id: vehicleId,
          insurance_type: formData.insurance_type,
          insurance_company: formData.insurance_company,
          policy_number: formData.policy_number,
          start_date: formData.start_date,
          end_date: formData.end_date,
          premium_amount: parseFloat(formData.premium_amount),
          policy_file_url: policyFileUrl,
          policy_file_name: policyFileName,
          notes: formData.notes || null,
          is_active: isActiveValue,
          created_by: profile.id
        }])

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vehicle-insurance', vehicleId])
      setShowAddModal(false)
      setPolicyFile(null)
      setFormData({
        insurance_type: 'rca',
        insurance_company: '',
        policy_number: '',
        start_date: '',
        end_date: '',
        premium_amount: '',
        notes: '',
      })
      setError('')
    },
    onError: (error) => {
      setError(error.message || 'Eroare la adăugarea asigurării')
    },
    onSettled: () => {
      setUploading(false)
    }
  })

  // Delete insurance mutation
  const deleteMutation = useMutation({
    mutationFn: async (insuranceId) => {
      const { error } = await supabase
        .from('vehicle_insurance')
        .delete()
        .eq('id', insuranceId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vehicle-insurance', vehicleId])
    }
  })

  const handleDelete = (ins) => {
    if (window.confirm(`Ștergi asigurarea ${ins.insurance_type.toUpperCase()} din ${ins.insurance_company}?`)) {
      deleteMutation.mutate(ins.id)
    }
  }

  // Render insurance card
  const renderInsuranceCard = (ins, isActive = true) => {
    if (!ins) return null

    const expired = isExpired(ins.end_date)
    const expiringSoon = !expired && isExpiringSoon(ins.end_date)
    const daysLeft = getDaysUntilExpiry(ins.end_date)

    return (
      <div className={`border rounded-lg p-4 ${
        isActive 
          ? expired 
            ? 'border-red-300 bg-red-50' 
            : expiringSoon 
              ? 'border-yellow-300 bg-yellow-50' 
              : 'border-green-300 bg-green-50'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Shield className={`w-5 h-5 ${
              expired ? 'text-red-600' : expiringSoon ? 'text-yellow-600' : 'text-green-600'
            }`} />
            <span className="font-semibold text-gray-900">
              {ins.insurance_company}
            </span>
            {isActive && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                expired 
                  ? 'bg-red-100 text-red-800' 
                  : expiringSoon 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-green-100 text-green-800'
              }`}>
                {expired ? (
                  <>
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Expirat
                  </>
                ) : expiringSoon ? (
                  <>
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {daysLeft} zile
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Activ
                  </>
                )}
              </span>
            )}
          </div>
          
          {canEdit && (
            <button
              onClick={() => handleDelete(ins)}
              className="text-red-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center text-gray-600">
            <FileText className="w-4 h-4 mr-2" />
            <span>Poliță: {ins.policy_number}</span>
          </div>

          <div className="flex items-center text-gray-600">
            <Calendar className="w-4 h-4 mr-2" />
            <span>
              {new Date(ins.start_date).toLocaleDateString('ro-RO')} - {new Date(ins.end_date).toLocaleDateString('ro-RO')}
            </span>
          </div>

          <div className="flex items-center text-gray-600">
            <DollarSign className="w-4 h-4 mr-2" />
            <span>{ins.premium_amount?.toFixed(2)} RON</span>
          </div>

          {ins.notes && (
            <p className="text-gray-500 text-xs mt-2">{ins.notes}</p>
          )}

          {ins.policy_file_url && (
            <a
              href={ins.policy_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-primary-600 hover:text-primary-700 text-xs mt-2"
            >
              <Download className="w-3 h-3 mr-1" />
              Descarcă poliță
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-gray-900">{t('vehicles.insurance')}</h2>
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('vehicles.addInsurance')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Se încarcă...</div>
      ) : (
        <div className="space-y-6">
          {/* RCA Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-medium text-gray-900">{t('vehicles.rca')}</h3>
              {historicalRCA.length > 0 && (
                <button
                  onClick={() => setShowHistory({ ...showHistory, rca: !showHistory.rca })}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
                >
                  {showHistory.rca ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                  Istoric ({historicalRCA.length})
                </button>
              )}
            </div>

            {activeRCA ? (
              renderInsuranceCard(activeRCA, true)
            ) : (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>{t('vehicles.noInsurance')}</p>
              </div>
            )}

            {/* RCA History */}
            {showHistory.rca && historicalRCA.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Istoric RCA:</p>
                {historicalRCA.map(ins => (
                  <div key={ins.id}>
                    {renderInsuranceCard(ins, false)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CASCO Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-medium text-gray-900">{t('vehicles.casco')}</h3>
              {historicalCASCO.length > 0 && (
                <button
                  onClick={() => setShowHistory({ ...showHistory, casco: !showHistory.casco })}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
                >
                  {showHistory.casco ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                  Istoric ({historicalCASCO.length})
                </button>
              )}
            </div>

            {activeCASCO ? (
              renderInsuranceCard(activeCASCO, true)
            ) : (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>{t('vehicles.noInsurance')}</p>
              </div>
            )}

            {/* CASCO History */}
            {showHistory.casco && historicalCASCO.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Istoric CASCO:</p>
                {historicalCASCO.map(ins => (
                  <div key={ins.id}>
                    {renderInsuranceCard(ins, false)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Insurance Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowAddModal(false)} />

            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {t('vehicles.addInsurance')}
              </h3>

              {error && (
                <div className="mb-4 rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Insurance Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tip Asigurare *</label>
                  <select
                    value={formData.insurance_type}
                    onChange={(e) => setFormData({ ...formData, insurance_type: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  >
                    <option value="rca">RCA</option>
                    <option value="casco">CASCO</option>
                  </select>
                </div>

                {/* Insurance Company */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Companie Asigurare *</label>
                  <input
                    type="text"
                    required
                    value={formData.insurance_company}
                    onChange={(e) => setFormData({ ...formData, insurance_company: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="ex: Allianz, Generali, City Insurance"
                  />
                </div>

                {/* Policy Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Număr Poliță *</label>
                  <input
                    type="text"
                    required
                    value={formData.policy_number}
                    onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data Început *</label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data Sfârșit *</label>
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>
                </div>

                {/* Premium Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Primă Asigurare (RON) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.premium_amount}
                    onChange={(e) => setFormData({ ...formData, premium_amount: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  />
                </div>

                {/* Policy File */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Document Poliță</label>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                </div>

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

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Anulează
                </button>
                <button
                  onClick={() => addMutation.mutate()}
                  disabled={uploading || !formData.insurance_company || !formData.policy_number || !formData.start_date || !formData.end_date || !formData.premium_amount}
                  className="px-4 py-2 bg-primary-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Se salvează...' : 'Salvează'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
