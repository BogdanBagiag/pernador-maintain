import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Edit, MapPin, Calendar, Hash, Building, Trash2, Shield, AlertCircle, Upload, Download, FileText, File, X } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import QRCodeGenerator from '../components/QRCodeGenerator'
import { useState } from 'react'

export default function EquipmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  // Check permissions
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'
  const canDelete = profile?.role === 'admin'

  // State for file attachments
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [documentType, setDocumentType] = useState('other')

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      navigate('/equipment')
    },
  })

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this equipment? This action cannot be undone.')) {
      deleteMutation.mutate()
    }
  }

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file size (2MB = 2097152 bytes)
    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      setUploadError('Fișierul este prea mare. Maxim 2MB.')
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
    setUploadError('')
  }

  // Handle file upload
  const handleFileUpload = async () => {
    if (!selectedFile) return

    setUploadingFile(true)
    setUploadError('')

    uploadMutation.mutate({
      file: selectedFile,
      documentType: documentType
    })
  }

  // Handle attachment delete
  const handleAttachmentDelete = (attachment) => {
    if (window.confirm(`Ștergi ${attachment.file_name}?`)) {
      deleteAttachmentMutation.mutate({
        attachmentId: attachment.id,
        fileUrl: attachment.file_url
      })
    }
  }

  // Get document type label in Romanian
  const getDocumentTypeLabel = (type) => {
    const labels = {
      invoice: 'Factură',
      warranty: 'Garanție',
      manual: 'Manual',
      certificate: 'Certificat',
      other: 'Altele'
    }
    return labels[type] || type
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Fetch equipment with location
  const { data: equipment, isLoading } = useQuery({
    queryKey: ['equipment', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select(`
          *,
          location:locations(id, name, building, floor, room, address)
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
  })

  // Fetch equipment attachments
  const { data: attachments, isLoading: isLoadingAttachments } = useQuery({
    queryKey: ['equipment-attachments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_attachments')
        .select(`
          *,
          uploader:uploaded_by(full_name, email)
        `)
        .eq('equipment_id', id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  // Upload attachment mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, documentType }) => {
      // Upload file to storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `equipment-attachments/${id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('maintenance-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('maintenance-files')
        .getPublicUrl(filePath)

      // Save attachment record
      const { error: dbError } = await supabase
        .from('equipment_attachments')
        .insert({
          equipment_id: id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          document_type: documentType,
          uploaded_by: profile?.id
        })

      if (dbError) throw dbError
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['equipment-attachments', id])
      setSelectedFile(null)
      setDocumentType('other')
      setUploadError('')
    },
    onError: (error) => {
      setUploadError(error.message || 'Failed to upload file')
    },
    onSettled: () => {
      setUploadingFile(false)
    }
  })

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: async ({ attachmentId, fileUrl }) => {
      // Extract file path from URL
      const urlParts = fileUrl.split('/maintenance-files/')
      if (urlParts.length > 1) {
        const filePath = urlParts[1].split('?')[0] // Remove query params
        
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('maintenance-files')
          .remove([filePath])
        
        if (storageError) console.error('Storage delete error:', storageError)
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('equipment_attachments')
        .delete()
        .eq('id', attachmentId)

      if (dbError) throw dbError
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['equipment-attachments', id])
    }
  })

  // Fetch work orders for this equipment
  const { data: workOrders } = useQuery({
    queryKey: ['equipment-work-orders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('equipment_id', id)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) throw error
      return data
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!equipment) {
    return (
      <div className="card text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Equipment not found
        </h3>
        <button onClick={() => navigate('/equipment')} className="btn-primary">
          Back to Equipment
        </button>
      </div>
    )
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'operational':
        return 'badge-success'
      case 'maintenance':
        return 'badge-warning'
      case 'broken':
        return 'badge-danger'
      case 'retired':
        return 'badge-info'
      default:
        return 'badge-info'
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/equipment')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Equipment
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{equipment.name}</h1>
            <div className="flex items-center mt-2">
              <span className={`badge ${getStatusColor(equipment.status)} capitalize`}>
                {equipment.status}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            {canEdit && (
              <Link
                to={`/equipment/${id}/edit`}
                className="btn-primary inline-flex items-center"
              >
                <Edit className="w-5 h-5 mr-2" />
                Edit
              </Link>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isLoading}
                className="btn-secondary text-red-600 hover:bg-red-50 border-red-300 inline-flex items-center disabled:opacity-50"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Details</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {equipment.manufacturer && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Brand
                  </label>
                  <p className="text-gray-900">{equipment.manufacturer}</p>
                </div>
              )}

              {equipment.model && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Model
                  </label>
                  <p className="text-gray-900">{equipment.model}</p>
                </div>
              )}

              {equipment.serial_number && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <Hash className="w-4 h-4 inline mr-1" />
                    Serial Number
                  </label>
                  <p className="text-gray-900 font-mono">{equipment.serial_number}</p>
                </div>
              )}

              {equipment.inventory_number && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <Hash className="w-4 h-4 inline mr-1" />
                    Nr. Inventar
                  </label>
                  <p className="text-gray-900 font-mono">{equipment.inventory_number}</p>
                </div>
              )}

              {equipment.purchase_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Data Achiziție
                  </label>
                  <p className="text-gray-900">
                    {new Date(equipment.purchase_date).toLocaleDateString('ro-RO', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}

              {/* Warranty Information */}
              {equipment.warranty_months && equipment.purchase_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <Shield className="w-4 h-4 inline mr-1" />
                    Garanție
                  </label>
                  {(() => {
                    const purchaseDate = new Date(equipment.purchase_date)
                    const warrantyMonths = parseInt(equipment.warranty_months)
                    const expiryDate = new Date(purchaseDate)
                    expiryDate.setMonth(expiryDate.getMonth() + warrantyMonths)
                    
                    const isExpired = expiryDate < new Date()
                    const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24))
                    const monthsLeft = Math.ceil(daysLeft / 30)
                    
                    return (
                      <div className="space-y-2">
                        <p className="text-gray-900">
                          {warrantyMonths} {warrantyMonths === 1 ? 'lună' : 'luni'}
                        </p>
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          isExpired 
                            ? 'bg-red-100 text-red-800' 
                            : daysLeft <= 90 
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                        }`}>
                          {isExpired ? (
                            <>
                              <AlertCircle className="w-4 h-4 mr-1" />
                              Expirată la {expiryDate.toLocaleDateString('ro-RO', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </>
                          ) : daysLeft <= 90 ? (
                            <>
                              <AlertCircle className="w-4 h-4 mr-1" />
                              Expiră la {expiryDate.toLocaleDateString('ro-RO', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })} ({daysLeft} zile)
                            </>
                          ) : (
                            <>
                              <Shield className="w-4 h-4 mr-1" />
                              Valabilă până la {expiryDate.toLocaleDateString('ro-RO', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })} ({monthsLeft} luni)
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {equipment.description && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Description
                </label>
                <p className="text-gray-900 whitespace-pre-wrap">{equipment.description}</p>
              </div>
            )}
          </div>

          {/* Location Card */}
          {equipment.location && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Location</h2>
              
              <div className="space-y-3">
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{equipment.location.name}</p>
                    {equipment.location.building && (
                      <p className="text-sm text-gray-600 flex items-center mt-1">
                        <Building className="w-4 h-4 mr-1" />
                        {equipment.location.building}
                      </p>
                    )}
                    {(equipment.location.floor || equipment.location.room) && (
                      <p className="text-sm text-gray-600 mt-1">
                        {equipment.location.floor && `Floor: ${equipment.location.floor}`}
                        {equipment.location.floor && equipment.location.room && ' â€¢ '}
                        {equipment.location.room && `Room: ${equipment.location.room}`}
                      </p>
                    )}
                    {equipment.location.address && (
                      <p className="text-sm text-gray-500 mt-2">
                        {equipment.location.address}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Documente Atașate */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                <FileText className="w-5 h-5 inline mr-2" />
                Documente Atașate
              </h2>
            </div>

            {/* Upload Form */}
            {canEdit && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  <Upload className="w-4 h-4 inline mr-1" />
                  Încarcă Document Nou
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Document Type Selector */}
                  <div>
                    <label htmlFor="documentType" className="block text-sm font-medium text-gray-700 mb-1">
                      Tip Document
                    </label>
                    <select
                      id="documentType"
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="input"
                    >
                      <option value="invoice">Factură</option>
                      <option value="warranty">Garanție</option>
                      <option value="manual">Manual</option>
                      <option value="certificate">Certificat</option>
                      <option value="other">Altele</option>
                    </select>
                  </div>

                  {/* File Input */}
                  <div>
                    <label htmlFor="fileUpload" className="block text-sm font-medium text-gray-700 mb-1">
                      Fișier (max 2MB)
                    </label>
                    <input
                      id="fileUpload"
                      type="file"
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-primary-50 file:text-primary-700
                        hover:file:bg-primary-100
                        cursor-pointer"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
                    />
                  </div>
                </div>

                {/* Selected File Info */}
                {selectedFile && (
                  <div className="mt-3 flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2">
                      <File className="w-5 h-5 text-primary-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Upload Button */}
                {selectedFile && (
                  <button
                    onClick={handleFileUpload}
                    disabled={uploadingFile}
                    className="btn-primary mt-3"
                  >
                    {uploadingFile ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span className="ml-2">Se încarcă...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Încarcă Fișier
                      </>
                    )}
                  </button>
                )}

                {/* Error Message */}
                {uploadError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{uploadError}</p>
                  </div>
                )}
              </div>
            )}

            {/* Attachments List */}
            {isLoadingAttachments ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : attachments && attachments.length > 0 ? (
              <div className="space-y-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <FileText className="w-8 h-8 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.file_name}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                            {getDocumentTypeLabel(attachment.document_type)}
                          </span>
                          <span>{formatFileSize(attachment.file_size)}</span>
                          <span>
                            {new Date(attachment.created_at).toLocaleDateString('ro-RO')}
                          </span>
                          {attachment.uploader && (
                            <span>de {attachment.uploader.full_name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 ml-4">
                      {/* Download Button */}
                      <a
                        href={attachment.file_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Descarcă"
                      >
                        <Download className="w-5 h-5" />
                      </a>

                      {/* Delete Button - only for uploader or admin */}
                      {(attachment.uploaded_by === profile?.id || profile?.role === 'admin') && (
                        <button
                          onClick={() => handleAttachmentDelete(attachment)}
                          disabled={deleteAttachmentMutation.isLoading}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Nu există documente atașate</p>
                {canEdit && (
                  <p className="text-sm mt-1">Folosește formularul de mai sus pentru a încărca documente</p>
                )}
              </div>
            )}
          </div>

          {/* Recent Work Orders */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Recent Work Orders</h2>
              <Link
                to={`/work-orders/new?equipment=${id}`}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Create Work Order
              </Link>
            </div>
            
            {!workOrders || workOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No work orders yet
              </p>
            ) : (
              <div className="space-y-3">
                {workOrders.map((wo) => (
                  <Link
                    key={wo.id}
                    to={`/work-orders/${wo.id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{wo.title}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(wo.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`badge badge-${
                        wo.status === 'completed' ? 'success' :
                        wo.status === 'in_progress' ? 'warning' :
                        'info'
                      } capitalize`}>
                        {wo.status.replace('_', ' ')}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - QR Code */}
        <div className="lg:col-span-1">
          <QRCodeGenerator 
            equipmentId={equipment.id} 
            equipmentName={equipment.name}
          />
          
          <div className="card mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                to={`/work-orders/new?equipment=${id}`}
                className="btn-primary w-full"
              >
                Create Work Order
              </Link>
              <Link
                to={`/equipment/${id}/edit`}
                className="btn-secondary w-full"
              >
                Edit Equipment
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
