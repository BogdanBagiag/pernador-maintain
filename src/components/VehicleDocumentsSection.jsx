import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { FileText, Upload, Download, Trash2, X, Calendar, AlertCircle } from 'lucide-react'
import DateInput from './DateInput'

export default function VehicleDocumentsSection({ vehicleId, documents, isLoading }) {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadData, setUploadData] = useState({
    document_type: 'certificat_inmatriculare',
    document_name: '',
    issue_date: '',
    expiry_date: '',
    notes: '',
  })
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'

  // Get document type label
  const getDocumentTypeLabel = (type) => {
    return t(`vehicles.${type}`) || type
  }

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setError('Fișierul este prea mare. Maxim 5MB.')
      return
    }

    setSelectedFile(file)
    setError('')
  }

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('Selectați un fișier')

      setUploading(true)

      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `vehicle-documents/${vehicleId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('maintenance-files')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('maintenance-files')
        .getPublicUrl(filePath)

      // Save to database
      const { error: dbError } = await supabase
        .from('vehicle_documents')
        .insert([{
          vehicle_id: vehicleId,
          document_type: uploadData.document_type,
          document_name: uploadData.document_name || selectedFile.name,
          file_url: publicUrl,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          issue_date: uploadData.issue_date || null,
          expiry_date: uploadData.expiry_date || null,
          notes: uploadData.notes || null,
          uploaded_by: profile.id
        }])

      if (dbError) throw dbError
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vehicle-documents', vehicleId])
      setShowUploadModal(false)
      setSelectedFile(null)
      setUploadData({
        document_type: 'certificat_inmatriculare',
        document_name: '',
        issue_date: '',
        expiry_date: '',
        notes: '',
      })
      setError('')
    },
    onError: (error) => {
      setError(error.message || 'Eroare la încărcarea documentului')
    },
    onSettled: () => {
      setUploading(false)
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (document) => {
      // Extract file path from URL
      const urlParts = document.file_url.split('/maintenance-files/')
      if (urlParts.length > 1) {
        const filePath = urlParts[1].split('?')[0]
        
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('maintenance-files')
          .remove([filePath])
        
        if (storageError) console.error('Storage delete error:', storageError)
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('vehicle_documents')
        .delete()
        .eq('id', document.id)

      if (dbError) throw dbError
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vehicle-documents', vehicleId])
    }
  })

  const handleDelete = (document) => {
    if (window.confirm(`Ștergi ${document.document_name}?`)) {
      deleteMutation.mutate(document)
    }
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Check if document is expired
  const isExpired = (expiryDate) => {
    if (!expiryDate) return false
    return new Date(expiryDate) < new Date()
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">{t('vehicles.documents')}</h2>
        {canEdit && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            {t('vehicles.addDocument')}
          </button>
        )}
      </div>

      {/* Documents List */}
      {isLoading ? (
        <div className="text-center py-4 text-gray-500">Se încarcă...</div>
      ) : documents && documents.length > 0 ? (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-start space-x-3 flex-1">
                <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {doc.document_name}
                    </p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {getDocumentTypeLabel(doc.document_type)}
                    </span>
                    {doc.expiry_date && isExpired(doc.expiry_date) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Expirat
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                    <span>{formatFileSize(doc.file_size)}</span>
                    {doc.issue_date && (
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        Emis: {new Date(doc.issue_date).toLocaleDateString('ro-RO')}
                      </span>
                    )}
                    {doc.expiry_date && (
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        Expiră: {new Date(doc.expiry_date).toLocaleDateString('ro-RO')}
                      </span>
                    )}
                  </div>
                  {doc.notes && (
                    <p className="mt-1 text-xs text-gray-500">{doc.notes}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-gray-600"
                  title="Descarcă"
                >
                  <Download className="w-5 h-5" />
                </a>
                {canEdit && (
                  <button
                    onClick={() => handleDelete(doc)}
                    className="p-2 text-red-400 hover:text-red-600"
                    title="Șterge"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>{t('vehicles.noDocuments')}</p>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowUploadModal(false)} />

            <div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="px-4 pt-5 pb-4 bg-white sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {t('vehicles.addDocument')}
                  </h3>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {error && (
                  <div className="mb-4 rounded-md bg-red-50 p-4">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Document Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t('vehicles.documentType')}
                    </label>
                    <select
                      value={uploadData.document_type}
                      onChange={(e) => setUploadData({ ...uploadData, document_type: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    >
                      <option value="certificat_inmatriculare">{t('vehicles.certificat_inmatriculare')}</option>
                      <option value="procura">{t('vehicles.procura')}</option>
                      <option value="contract_vanzare">{t('vehicles.contract_vanzare')}</option>
                      <option value="other">{t('vehicles.other')}</option>
                    </select>
                  </div>

                  {/* Document Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Nume Document
                    </label>
                    <input
                      type="text"
                      value={uploadData.document_name}
                      onChange={(e) => setUploadData({ ...uploadData, document_name: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      placeholder="Lasă gol pentru nume automat"
                    />
                  </div>

                  {/* Issue Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t('vehicles.issueDate')}
                    </label>
                    <DateInput
                      value={uploadData.issue_date}
                      onChange={(e) => setUploadData({ ...uploadData, issue_date: e.target.value })}
                      placeholder="dd/mm/yyyy"
                    />
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t('vehicles.expiryDate')}
                    </label>
                    <DateInput
                      value={uploadData.expiry_date}
                      onChange={(e) => setUploadData({ ...uploadData, expiry_date: e.target.value })}
                      placeholder="dd/mm/yyyy"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t('vehicles.notes')}
                    </label>
                    <textarea
                      rows={2}
                      value={uploadData.notes}
                      onChange={(e) => setUploadData({ ...uploadData, notes: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    />
                  </div>

                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('vehicles.uploadFile')}
                    </label>
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    {selectedFile && (
                      <p className="mt-2 text-sm text-gray-500">
                        Selectat: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 bg-gray-50 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => uploadMutation.mutate()}
                  disabled={!selectedFile || uploading}
                  className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Se încarcă...' : t('vehicles.uploadFile')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
