import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Edit, MapPin, Calendar, Hash, Building, Trash2, Shield, AlertCircle, Upload, Download, FileText, File, X, CheckCircle, XCircle, Eye, Edit2 } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import QRCodeGenerator from '../components/QRCodeGenerator'
import InspectionModal from '../components/InspectionModal'
import ViewInspectionModal from '../components/ViewInspectionModal'
import EditInspectionModal from '../components/EditInspectionModal'
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
  
  // State for inspection modals
  const [showInspectionModal, setShowInspectionModal] = useState(false)
  const [viewingInspection, setViewingInspection] = useState(null)
  const [editingInspection, setEditingInspection] = useState(null)

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

  // Get inspection status label and color
  const getInspectionStatusInfo = (status) => {
    const statusInfo = {
      passed: {
        label: 'Promovat',
        icon: <CheckCircle className="w-5 h-5" />,
        color: 'bg-green-100 text-green-800 border-green-200'
      },
      failed: {
        label: 'Respins',
        icon: <XCircle className="w-5 h-5" />,
        color: 'bg-red-100 text-red-800 border-red-200'
      },
      conditional: {
        label: 'Condiționat',
        icon: <AlertCircle className="w-5 h-5" />,
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
      }
    }
    return statusInfo[status] || statusInfo.passed
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

  // Fetch equipment inspections history
  const { data: inspections, isLoading: isLoadingInspections } = useQuery({
    queryKey: ['equipment-inspections', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_inspections')
        .select(`
          *,
          inspector:inspector_id(full_name, email),
          creator:created_by(full_name)
        `)
        .eq('equipment_id', id)
        .order('inspection_date', { ascending: false })
      
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
    <div className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="mb-3 sm:mb-4 lg:mb-6">
        <button
          onClick={() => navigate('/equipment')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-2 sm:mb-3 text-xs sm:text-sm"
        >
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Back to Equipment
        </button>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900 break-words leading-tight">{equipment.name}</h1>
            <div className="flex items-center mt-1.5 sm:mt-2">
              <span className={`badge ${getStatusColor(equipment.status)} capitalize text-xs`}>
                {equipment.status}
              </span>
            </div>
          </div>
          <div className="flex flex-row gap-2 shrink-0">
            {canEdit && (
              <Link
                to={`/equipment/${id}/edit`}
                className="btn-primary inline-flex items-center justify-center text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2"
              >
                <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="ml-1 sm:ml-2">Edit</span>
              </Link>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isLoading}
                className="btn-secondary text-red-600 hover:bg-red-50 border-red-300 inline-flex items-center justify-center disabled:opacity-50 text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2"
              >
                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="ml-1 sm:ml-2">Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4 lg:space-y-6">
          {/* Details Card */}
          <div className="card p-3 sm:p-4 lg:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Details</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {equipment.manufacturer && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1">
                    Brand
                  </label>
                  <p className="text-sm sm:text-base text-gray-900">{equipment.manufacturer}</p>
                </div>
              )}

              {equipment.model && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1">
                    Model
                  </label>
                  <p className="text-sm sm:text-base text-gray-900">{equipment.model}</p>
                </div>
              )}

              {equipment.serial_number && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1">
                    <Hash className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                    Serial Number
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 font-mono break-all">{equipment.serial_number}</p>
                </div>
              )}

              {equipment.inventory_number && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1">
                    <Hash className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                    Nr. Inventar
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 font-mono break-all">{equipment.inventory_number}</p>
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

              {/* Periodic Inspection Information */}
              {equipment.inspection_required && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Inspecții Periodice
                  </label>
                  {(() => {
                    if (!equipment.last_inspection_date || !equipment.inspection_frequency_months) {
                      return (
                        <div className="space-y-2">
                          <p className="text-gray-900">
                            Frecvență: {equipment.inspection_frequency_months ? 
                              `${equipment.inspection_frequency_months} ${equipment.inspection_frequency_months === 1 ? 'lună' : 'luni'}` : 
                              'Neconfigurată'}
                          </p>
                          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            Necesită prima inspecție
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => setShowInspectionModal(true)}
                              className="mt-2 btn-primary text-sm"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Marchează Prima Inspecție
                            </button>
                          )}
                        </div>
                      )
                    }

                    const lastInspection = new Date(equipment.last_inspection_date)
                    const frequencyMonths = parseInt(equipment.inspection_frequency_months)
                    const nextInspection = new Date(lastInspection)
                    nextInspection.setMonth(nextInspection.getMonth() + frequencyMonths)
                    
                    const isOverdue = nextInspection < new Date()
                    const daysUntil = Math.ceil((nextInspection - new Date()) / (1000 * 60 * 60 * 24))
                    const monthsUntil = Math.ceil(daysUntil / 30)
                    
                    return (
                      <div className="space-y-2">
                        <p className="text-gray-900">
                          Frecvență: {frequencyMonths} {frequencyMonths === 1 ? 'lună' : 'luni'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Ultima inspecție: {lastInspection.toLocaleDateString('ro-RO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          isOverdue 
                            ? 'bg-red-100 text-red-800' 
                            : daysUntil <= 30 
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                        }`}>
                          {isOverdue ? (
                            <>
                              <AlertCircle className="w-4 h-4 mr-1" />
                              Expirată! Scadență: {nextInspection.toLocaleDateString('ro-RO', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </>
                          ) : daysUntil <= 30 ? (
                            <>
                              <AlertCircle className="w-4 h-4 mr-1" />
                              Scadență: {nextInspection.toLocaleDateString('ro-RO', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })} ({daysUntil} zile)
                            </>
                          ) : (
                            <>
                              <Shield className="w-4 h-4 mr-1" />
                              Scadență: {nextInspection.toLocaleDateString('ro-RO', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })} ({monthsUntil} luni)
                            </>
                          )}
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => setShowInspectionModal(true)}
                            className="mt-2 btn-primary text-sm"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Marchează Inspecție Nouă
                          </button>
                        )}
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
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Location</h2>
              
              <div className="space-y-3">
                <div className="flex items-start">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mr-2 sm:mr-3 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 break-words">{equipment.location.name}</p>
                    {equipment.location.building && (
                      <p className="text-sm text-gray-600 flex items-start mt-1">
                        <Building className="w-3 h-3 sm:w-4 sm:h-4 mr-1 mt-0.5 shrink-0" />
                        <span className="break-words">{equipment.location.building}</span>
                      </p>
                    )}
                    {(equipment.location.floor || equipment.location.room) && (
                      <p className="text-sm text-gray-600 mt-1 break-words">
                        {equipment.location.floor && `Floor: ${equipment.location.floor}`}
                        {equipment.location.floor && equipment.location.room && ' • '}
                        {equipment.location.room && `Room: ${equipment.location.room}`}
                      </p>
                    )}
                    {equipment.location.address && (
                      <p className="text-sm text-gray-500 mt-2 break-words">
                        {equipment.location.address}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Istoric Inspecții */}
          {equipment.inspection_required && (
            <div className="card">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2" />
                  Istoric Inspecții
                </h2>
              </div>

              {isLoadingInspections ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : inspections && inspections.length > 0 ? (
                <div className="space-y-4">
                  {inspections.map((inspection) => {
                    const statusInfo = getInspectionStatusInfo(inspection.status)
                    const canEditInspection = profile?.role === 'admin' || inspection.created_by === profile?.id
                    
                    return (
                      <div
                        key={inspection.id}
                        className="p-3 sm:p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-primary-300 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold border ${statusInfo.color}`}>
                                {statusInfo.icon}
                                <span className="ml-1 sm:ml-2">{statusInfo.label}</span>
                              </span>
                              <p className="text-xs sm:text-sm font-medium text-gray-900">
                                {new Date(inspection.inspection_date).toLocaleDateString('ro-RO', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>

                            {/* Inspector */}
                            <div className="space-y-1 text-xs sm:text-sm text-gray-600 mb-3">
                              {inspection.inspector_name ? (
                                <p>
                                  <span className="font-medium">Inspector:</span> {inspection.inspector_name}
                                </p>
                              ) : inspection.inspector ? (
                                <p>
                                  <span className="font-medium">Inspector:</span> {inspection.inspector.full_name}
                                </p>
                              ) : null}

                              {/* Next Inspection */}
                              {inspection.next_inspection_date && (
                                <p>
                                  <span className="font-medium">Scadență:</span>{' '}
                                  {new Date(inspection.next_inspection_date).toLocaleDateString('ro-RO', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </p>
                              )}

                              {/* Findings Preview */}
                              {inspection.findings && (
                                <div className="mt-2">
                                  <p className="font-medium text-gray-700">Observații:</p>
                                  <p className="text-gray-600 line-clamp-2">{inspection.findings}</p>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2">
                              {/* View Details Button */}
                              <button
                                onClick={() => setViewingInspection(inspection)}
                                className="inline-flex items-center px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                              >
                                <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                                <span className="hidden sm:inline">Vizualizare</span>
                                <span className="sm:hidden">Vezi</span>
                              </button>

                              {/* Edit Button - only for creator or admin */}
                              {canEditInspection && (
                                <button
                                  onClick={() => setEditingInspection(inspection)}
                                  className="inline-flex items-center px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                  <Edit2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                                  Editează
                                </button>
                              )}

                              {/* Certificate Badge */}
                              {inspection.certificate_url && (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded border border-green-200">
                                  <FileText className="w-3 h-3 mr-1" />
                                  <span className="hidden sm:inline">Cu certificat</span>
                                  <span className="sm:hidden">Cert.</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick Download Certificate */}
                          {inspection.certificate_url && (
                            <a
                              href={inspection.certificate_url}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              title="Descarcă Certificat"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                          )}
                        </div>

                        {/* Created Info */}
                        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                          Înregistrat de {inspection.creator?.full_name || 'N/A'} la{' '}
                          {new Date(inspection.created_at).toLocaleDateString('ro-RO')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Nu există inspecții înregistrate</p>
                  {canEdit && (
                    <button
                      onClick={() => setShowInspectionModal(true)}
                      className="mt-3 btn-primary text-sm"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Marchează Prima Inspecție
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Documente Atașate */}
          <div className="card p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1 sm:mr-2" />
                Documente Atașate
              </h2>
            </div>

            {/* Upload Form */}
            {canEdit && (
              <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 lg:p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
                  <Upload className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Încarcă Document Nou
                </h3>
                
                <div className="space-y-3">
                  {/* Document Type Selector */}
                  <div>
                    <label htmlFor="documentType" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Tip Document
                    </label>
                    <select
                      id="documentType"
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="input text-sm"
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
                    <label htmlFor="fileUpload" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Fișier (max 2MB)
                    </label>
                    <input
                      id="fileUpload"
                      type="file"
                      onChange={handleFileSelect}
                      className="block w-full text-xs sm:text-sm text-gray-500
                        file:mr-2 sm:file:mr-4 file:py-1.5 sm:file:py-2 file:px-3 sm:file:px-4
                        file:rounded-lg file:border-0
                        file:text-xs sm:file:text-sm file:font-semibold
                        file:bg-primary-50 file:text-primary-700
                        hover:file:bg-primary-100
                        cursor-pointer"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
                    />
                  </div>
                </div>

                {/* Selected File Info */}
                {selectedFile && (
                  <div className="mt-2 sm:mt-3 flex items-center justify-between p-2 sm:p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <File className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="p-1 text-gray-400 hover:text-red-600 flex-shrink-0 ml-2"
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
                    className="btn-primary mt-2 sm:mt-3 w-full sm:w-auto text-xs sm:text-sm py-1.5 sm:py-2"
                  >
                    {uploadingFile ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span className="ml-2">Se încarcă...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Încarcă Fișier
                      </>
                    )}
                  </button>
                )}

                {/* Error Message */}
                {uploadError && (
                  <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs sm:text-sm text-red-800">{uploadError}</p>
                  </div>
                )}
              </div>
            )}

            {/* Attachments List */}
            {isLoadingAttachments ? (
              <div className="flex justify-center py-6 sm:py-8">
                <LoadingSpinner />
              </div>
            ) : attachments && attachments.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2.5 sm:p-3 lg:p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-300 transition-colors gap-2 sm:gap-3"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <FileText className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                          {attachment.file_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-gray-500 mt-0.5 sm:mt-1">
                          <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium text-xs">
                            {getDocumentTypeLabel(attachment.document_type)}
                          </span>
                          <span className="text-xs">{formatFileSize(attachment.file_size)}</span>
                          <span className="hidden sm:inline text-xs">
                            {new Date(attachment.created_at).toLocaleDateString('ro-RO')}
                          </span>
                          {attachment.uploader && (
                            <span className="hidden md:inline text-xs">de {attachment.uploader.full_name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 sm:gap-2 justify-end">
                      {/* Download Button */}
                      <a
                        href={attachment.file_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                        title="Descarcă"
                      >
                        <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Descarcă</span>
                      </a>

                      {/* Delete Button - only for uploader or admin */}
                      {(attachment.uploaded_by === profile?.id || profile?.role === 'admin') && (
                        <button
                          onClick={() => handleAttachmentDelete(attachment)}
                          disabled={deleteAttachmentMutation.isLoading}
                          className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Șterge"
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8 text-gray-500">
                <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-gray-400" />
                <p className="text-sm sm:text-base">Nu există documente atașate</p>
                {canEdit && (
                  <p className="text-xs sm:text-sm mt-1">Folosește formularul de mai sus pentru a încărca documente</p>
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
        <div className="lg:col-span-1 space-y-3 sm:space-y-4">
          <QRCodeGenerator 
            equipmentId={equipment.id} 
            equipmentName={equipment.name}
          />
          
          <div className="card p-3 sm:p-4 lg:p-6">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2 sm:mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                to={`/work-orders/new?equipment=${id}`}
                className="btn-primary w-full text-xs sm:text-sm py-2"
              >
                Create Work Order
              </Link>
              <Link
                to={`/equipment/${id}/edit`}
                className="btn-secondary w-full text-xs sm:text-sm py-2"
              >
                Edit Equipment
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Inspection Modal */}
      {showInspectionModal && equipment && (
        <InspectionModal
          equipment={equipment}
          onClose={() => setShowInspectionModal(false)}
        />
      )}

      {/* View Inspection Modal */}
      {viewingInspection && equipment && (
        <ViewInspectionModal
          inspection={viewingInspection}
          equipment={equipment}
          onClose={() => setViewingInspection(null)}
          onEdit={() => {
            setEditingInspection(viewingInspection)
            setViewingInspection(null)
          }}
        />
      )}

      {/* Edit Inspection Modal */}
      {editingInspection && equipment && (
        <EditInspectionModal
          inspection={editingInspection}
          equipment={equipment}
          onClose={() => setEditingInspection(null)}
        />
      )}
    </div>
  )
}
