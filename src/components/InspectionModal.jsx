import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { X, Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'

export default function InspectionModal({ equipment, onClose }) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    inspection_date: new Date().toISOString().split('T')[0], // Today
    inspector_name: '',
    status: 'passed',
    findings: ''
  })
  const [certificateFile, setCertificateFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file size (5MB max for certificates)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setError('Fișierul este prea mare. Maxim 5MB.')
      setCertificateFile(null)
      return
    }

    setCertificateFile(file)
    setError('')
  }

  // Submit inspection
  const submitMutation = useMutation({
    mutationFn: async () => {
      setUploading(true)
      let certificateUrl = null

      // Upload certificate if provided
      if (certificateFile) {
        const fileExt = certificateFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `inspection-certificates/${equipment.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('maintenance-files')
          .upload(filePath, certificateFile, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('maintenance-files')
          .getPublicUrl(filePath)

        certificateUrl = publicUrl
      }

      // Calculate next inspection date
      const inspectionDate = new Date(formData.inspection_date)
      const nextInspectionDate = new Date(inspectionDate)
      nextInspectionDate.setMonth(nextInspectionDate.getMonth() + parseInt(equipment.inspection_frequency_months))

      // Insert inspection record
      const { error: dbError } = await supabase
        .from('equipment_inspections')
        .insert({
          equipment_id: equipment.id,
          inspection_date: formData.inspection_date,
          inspector_name: formData.inspector_name || null,
          inspector_id: profile?.id,
          status: formData.status,
          findings: formData.findings || null,
          next_inspection_date: nextInspectionDate.toISOString().split('T')[0],
          certificate_url: certificateUrl,
          created_by: profile?.id
        })

      if (dbError) throw dbError

      // Update equipment last_inspection_date
      const { error: updateError } = await supabase
        .from('equipment')
        .update({ last_inspection_date: formData.inspection_date })
        .eq('id', equipment.id)

      if (updateError) throw updateError
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['equipment', equipment.id])
      queryClient.invalidateQueries(['equipment-inspections', equipment.id])
      onClose()
    },
    onError: (error) => {
      setError(error.message || 'Failed to save inspection')
      setUploading(false)
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!formData.inspection_date) {
      setError('Data inspecției este obligatorie')
      return
    }

    setError('')
    submitMutation.mutate()
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'conditional':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Marchează Inspecție Completată
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Equipment Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700">Echipament</p>
            <p className="text-lg font-semibold text-gray-900">{equipment.name}</p>
            <p className="text-sm text-gray-600">
              Frecvență: {equipment.inspection_frequency_months} luni
            </p>
          </div>

          {/* Inspection Date */}
          <div>
            <label htmlFor="inspection_date" className="block text-sm font-medium text-gray-700 mb-1">
              Data Inspecției <span className="text-red-500">*</span>
            </label>
            <input
              id="inspection_date"
              type="date"
              value={formData.inspection_date}
              onChange={(e) => setFormData({ ...formData, inspection_date: e.target.value })}
              className="input"
              required
            />
          </div>

          {/* Inspector Name */}
          <div>
            <label htmlFor="inspector_name" className="block text-sm font-medium text-gray-700 mb-1">
              Inspector / Firmă Externă <span className="text-gray-400 text-xs">(opțional)</span>
            </label>
            <input
              id="inspector_name"
              type="text"
              value={formData.inspector_name}
              onChange={(e) => setFormData({ ...formData, inspector_name: e.target.value })}
              className="input"
              placeholder="ex: Service Autorizat XYZ, Ion Popescu"
            />
            <p className="text-xs text-gray-500 mt-1">
              Lasă gol dacă inspecția a fost făcută intern
            </p>
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status Inspecție <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: 'passed' })}
                className={`p-3 rounded-lg border-2 transition-all ${
                  formData.status === 'passed'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <CheckCircle className={`w-6 h-6 mx-auto mb-1 ${
                  formData.status === 'passed' ? 'text-green-600' : 'text-gray-400'
                }`} />
                <p className={`text-sm font-medium ${
                  formData.status === 'passed' ? 'text-green-900' : 'text-gray-600'
                }`}>
                  Promovat
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: 'conditional' })}
                className={`p-3 rounded-lg border-2 transition-all ${
                  formData.status === 'conditional'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-gray-200 hover:border-yellow-300'
                }`}
              >
                <AlertCircle className={`w-6 h-6 mx-auto mb-1 ${
                  formData.status === 'conditional' ? 'text-yellow-600' : 'text-gray-400'
                }`} />
                <p className={`text-sm font-medium ${
                  formData.status === 'conditional' ? 'text-yellow-900' : 'text-gray-600'
                }`}>
                  Condiționat
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: 'failed' })}
                className={`p-3 rounded-lg border-2 transition-all ${
                  formData.status === 'failed'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-red-300'
                }`}
              >
                <XCircle className={`w-6 h-6 mx-auto mb-1 ${
                  formData.status === 'failed' ? 'text-red-600' : 'text-gray-400'
                }`} />
                <p className={`text-sm font-medium ${
                  formData.status === 'failed' ? 'text-red-900' : 'text-gray-600'
                }`}>
                  Respins
                </p>
              </button>
            </div>
          </div>

          {/* Findings / Notes */}
          <div>
            <label htmlFor="findings" className="block text-sm font-medium text-gray-700 mb-1">
              Note / Observații <span className="text-gray-400 text-xs">(opțional)</span>
            </label>
            <textarea
              id="findings"
              value={formData.findings}
              onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
              className="input"
              rows="4"
              placeholder="Observații inspector, probleme identificate, recomandări..."
            />
          </div>

          {/* Certificate Upload */}
          <div>
            <label htmlFor="certificate" className="block text-sm font-medium text-gray-700 mb-1">
              Certificat Inspecție <span className="text-gray-400 text-xs">(opțional, max 5MB)</span>
            </label>
            <input
              id="certificate"
              type="file"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-primary-50 file:text-primary-700
                hover:file:bg-primary-100
                cursor-pointer"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
            <p className="text-xs text-gray-500 mt-1">
              PDF, DOC, DOCX, JPG, PNG - Max 5MB
            </p>
          </div>

          {/* Selected File Preview */}
          {certificateFile && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{certificateFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(certificateFile.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCertificateFile(null)}
                className="p-1 text-gray-400 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Next Inspection Preview */}
          {formData.inspection_date && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">📋 Următoarea inspecție programată:</span>{' '}
                {(() => {
                  const inspDate = new Date(formData.inspection_date)
                  const nextDate = new Date(inspDate)
                  nextDate.setMonth(nextDate.getMonth() + parseInt(equipment.inspection_frequency_months))
                  return nextDate.toLocaleDateString('ro-RO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                })()}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="btn-secondary"
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="btn-primary"
            >
              {uploading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Se salvează...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Salvează Inspecția
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
