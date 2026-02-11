import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { 
  ArrowLeft, Edit, MapPin, Calendar, Hash, Building, Trash2, Shield, 
  AlertCircle, Upload, Download, FileText, File, X, CheckCircle, XCircle, 
  Eye, Edit2, Package, Clock, Wrench, Play, Pause, User, Plus 
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import QRCodeGenerator from '../components/QRCodeGenerator'
import InspectionModal from '../components/InspectionModal'
import ViewInspectionModal from '../components/ViewInspectionModal'
import EditInspectionModal from '../components/EditInspectionModal'
import ScheduleCompletionWizard from '../components/ScheduleCompletionWizard'
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

  // State for maintenance schedule modals
  const [showCompletionWizard, setShowCompletionWizard] = useState(false)
  const [selectedScheduleForCompletion, setSelectedScheduleForCompletion] = useState(null)

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

  // Get frequency label in Romanian
  const getFrequencyLabel = (frequency) => {
    const labels = {
      daily: 'Zilnic',
      weekly: 'Săptămânal',
      monthly: 'Lunar',
      quarterly: 'Trimestrial',
      yearly: 'Anual'
    }
    return labels[frequency] || frequency
  }

  // Check if maintenance is overdue
  const isMaintenanceOverdue = (dueDate) => {
    return new Date(dueDate) < new Date()
  }

  // Get days until due
  const getDaysUntilDue = (dueDate) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = due - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
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

      // Save to database
      const { error: dbError } = await supabase
        .from('equipment_attachments')
        .insert([{
          equipment_id: id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          document_type: documentType,
          uploaded_by: profile.id
        }])

      if (dbError) throw dbError
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['equipment-attachments', id])
      setSelectedFile(null)
      setDocumentType('other')
      // Reset file input
      const fileInput = document.getElementById('file-upload')
      if (fileInput) fileInput.value = ''
    },
    onError: (error) => {
      setUploadError(error.message || 'Eroare la încărcarea fișierului')
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

  // Toggle active mutation for maintenance schedules
  const toggleScheduleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }) => {
      const { error } = await supabase
        .from('maintenance_schedules')
        .update({ is_active: !isActive })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-maintenance-schedules', id] })
    },
  })

  // Delete mutation for maintenance schedules
  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId) => {
      const { error } = await supabase
        .from('maintenance_schedules')
        .delete()
        .eq('id', scheduleId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-maintenance-schedules', id] })
    },
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

  // Fetch maintenance schedules for this equipment
  const { data: maintenanceSchedules } = useQuery({
    queryKey: ['equipment-maintenance-schedules', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select(`
          *,
          assigned_user:profiles!maintenance_schedules_assigned_to_fkey(id, full_name),
          checklist_template:checklist_templates(id, name),
          procedure_template:procedure_templates(id, name)
        `)
        .eq('equipment_id', id)
        .order('next_due_date', { ascending: true })
        .limit(10)
      
      if (error) throw error
      return data
    },
  })

  // Fetch compatible parts from inventory
  const { data: compatibleParts } = useQuery({
    queryKey: ['equipment-compatible-parts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_parts')
        .select('*')
        .eq('is_active', true)
      
      if (error) throw error
      
      // Filter parts that have this equipment in compatible_equipment array
      return data?.filter(part => 
        part.compatible_equipment && 
        part.compatible_equipment.includes(id)
      ) || []
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
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Equipment Not Found</h2>
          <p className="text-gray-600 mb-4">The equipment you're looking for doesn't exist.</p>
          <Link to="/equipment" className="btn-primary">
            Back to Equipment List
          </Link>
        </div>
      </div>
    )
  }

  const statusColors = {
    operational: 'bg-green-100 text-green-800 border-green-200',
    maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    broken: 'bg-red-100 text-red-800 border-red-200',
    retired: 'bg-gray-100 text-gray-800 border-gray-200',
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            <button
              onClick={() => navigate('/equipment')}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words">
                {equipment.name}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 break-words">
                {equipment.manufacturer && `${equipment.manufacturer} `}
                {equipment.model && equipment.model}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 shrink-0">
            {canEdit && (
              <Link
                to={`/equipment/${id}/edit`}
                className="btn-secondary text-xs sm:text-sm py-1.5 sm:py-2 px-3 sm:px-4"
              >
                <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Edit
              </Link>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isLoading}
                className="btn-danger text-xs sm:text-sm py-1.5 sm:py-2 px-3 sm:px-4"
              >
                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Equipment Details Card */}
          <div className="card p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Status */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Status</label>
                <span className={`badge ${statusColors[equipment.status]} capitalize text-xs sm:text-sm`}>
                  {equipment.status}
                </span>
              </div>

              {/* Serial Number */}
              {equipment.serial_number && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                    <Hash className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Serial Number
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 font-mono break-all">{equipment.serial_number}</p>
                </div>
              )}

              {/* Inventory Number */}
              {equipment.inventory_number && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                    <Hash className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Nr. Inventar
                  </label>
                  <p className="text-sm sm:text-base text-gray-900 font-mono break-all">{equipment.inventory_number}</p>
                </div>
              )}

              {/* Location */}
              {equipment.location && (
                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Location
                  </label>
                  <Link
                    to={`/locations/${equipment.location.id}`}
                    className="text-sm sm:text-base text-primary-600 hover:text-primary-700 break-words"
                  >
                    {equipment.location.name}
                    {equipment.location.building && `, ${equipment.location.building}`}
                    {equipment.location.floor && ` - Floor ${equipment.location.floor}`}
                    {equipment.location.room && ` - Room ${equipment.location.room}`}
                  </Link>
                </div>
              )}

              {/* Purchase Date */}
              {equipment.purchase_date && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2 flex items-center">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Purchase Date
                  </label>
                  <p className="text-sm sm:text-base text-gray-900">
                    {new Date(equipment.purchase_date).toLocaleDateString()}
                  </p>
                </div>
              )}

              {/* Description */}
              {equipment.description && (
                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Description</label>
                  <p className="text-sm sm:text-base text-gray-900 whitespace-pre-wrap break-words">{equipment.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Equipment Image */}
          {equipment.image_url && (
            <div className="card p-3 sm:p-4 lg:p-6">
              <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Equipment Image</h2>
              <img
                src={equipment.image_url}
                alt={equipment.name}
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}

          {/* Inspections History */}
          <div className="card p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 flex items-center">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary-600" />
                Inspecții
              </h2>
              {canEdit && (
                <button
                  onClick={() => setShowInspectionModal(true)}
                  className="btn-primary text-xs sm:text-sm py-1.5 sm:py-2 px-3 sm:px-4 w-full sm:w-auto"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Adaugă Inspecție
                </button>
              )}
            </div>

            {isLoadingInspections ? (
              <div className="flex justify-center py-6 sm:py-8">
                <LoadingSpinner />
              </div>
            ) : !inspections || inspections.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-gray-500">
                <Shield className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-gray-400" />
                <p className="text-sm sm:text-base">Nu există inspecții înregistrate</p>
                {canEdit && (
                  <p className="text-xs sm:text-sm mt-1">Adaugă prima inspecție pentru acest echipament</p>
                )}
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {inspections.map((inspection) => {
                  const statusInfo = getInspectionStatusInfo(inspection.status)
                  const isExpired = inspection.valid_until && new Date(inspection.valid_until) < new Date()
                  
                  return (
                    <div
                      key={inspection.id}
                      className="p-3 sm:p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`inline-flex items-center px-2 py-0.5 sm:py-1 rounded-full border text-xs sm:text-sm font-medium ${statusInfo.color}`}>
                              {statusInfo.icon}
                              <span className="ml-1">{statusInfo.label}</span>
                            </span>
                            {isExpired && (
                              <span className="inline-flex items-center px-2 py-0.5 sm:py-1 rounded-full border text-xs sm:text-sm font-medium bg-red-100 text-red-800 border-red-200">
                                <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                Expirat
                              </span>
                            )}
                          </div>

                          <div className="space-y-1 text-xs sm:text-sm text-gray-600">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="flex items-center">
                                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                {new Date(inspection.inspection_date).toLocaleDateString('ro-RO')}
                              </span>
                              {inspection.inspector && (
                                <span className="flex items-center">
                                  <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                  {inspection.inspector.full_name}
                                </span>
                              )}
                            </div>
                            
                            {inspection.valid_until && (
                              <div className="flex items-center">
                                <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                Valid până: {new Date(inspection.valid_until).toLocaleDateString('ro-RO')}
                              </div>
                            )}

                            {inspection.notes && (
                              <p className="text-gray-700 mt-1 line-clamp-2 break-words">
                                {inspection.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 justify-end sm:ml-4">
                          <button
                            onClick={() => setViewingInspection(inspection)}
                            className="p-1.5 sm:p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Vizualizează"
                          >
                            <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => setEditingInspection(inspection)}
                              className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editează"
                            >
                              <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* File Attachments */}
          <div className="card p-3 sm:p-4 lg:p-6">
            <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary-600" />
              Documente Atașate
            </h2>

            {/* Upload Form */}
            {canEdit && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
                <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">Încarcă Document Nou</h3>
                
                <div className="space-y-3">
                  {/* Document Type Selector */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Tip Document
                    </label>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="input text-xs sm:text-sm"
                    >
                      <option value="invoice">Factură</option>
                      <option value="warranty">Garanție</option>
                      <option value="manual">Manual</option>
                      <option value="certificate">Certificat</option>
                      <option value="other">Altele</option>
                    </select>
                  </div>

                  {/* File Selector */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Selectează Fișier (max 2MB)
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      onChange={handleFileSelect}
                      className="block w-full text-xs sm:text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-white focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                    {selectedFile && (
                      <p className="mt-1 sm:mt-2 text-xs text-gray-600">
                        Selectat: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </p>
                    )}
                  </div>

                  {/* Upload Button */}
                  <button
                    onClick={handleFileUpload}
                    disabled={!selectedFile || uploadingFile}
                    className="btn-primary w-full sm:w-auto text-xs sm:text-sm py-2"
                  >
                    {uploadingFile ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Se încarcă...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                        Încarcă Document
                      </>
                    )}
                  </button>

                  {/* Error Message */}
                  {uploadError && (
                    <div className="flex items-center p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 mr-2 shrink-0" />
                      <p className="text-xs sm:text-sm text-red-600">{uploadError}</p>
                    </div>
                  )}
                </div>
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
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    {/* File Info */}
                    <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                      <File className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm sm:text-base break-words">{attachment.file_name}</p>
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

          {/* Preventive Maintenance Schedules */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-primary-600" />
                Mentenanțe Preventive
              </h2>
              <Link
                to="/schedules"
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Vezi Toate
              </Link>
            </div>
            
            {!maintenanceSchedules || maintenanceSchedules.length === 0 ? (
              <div className="text-center py-8">
                <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-500 mb-2">Niciun program de mentenanță</p>
                <Link
                  to="/schedules"
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium inline-flex items-center"
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Creează Program de Mentenanță
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {maintenanceSchedules.map((schedule) => {
                  const overdue = isMaintenanceOverdue(schedule.next_due_date)
                  const daysUntil = getDaysUntilDue(schedule.next_due_date)
                  const hasProcedure = !!schedule.procedure_template
                  const hasChecklist = !!schedule.checklist_template
                  
                  return (
                    <div
                      key={schedule.id}
                      className={`p-4 border rounded-lg transition-all ${
                        !schedule.is_active 
                          ? 'border-gray-200 bg-gray-50 opacity-60' 
                          : overdue
                            ? 'border-red-300 bg-red-50 hover:border-red-400'
                            : daysUntil <= 7
                              ? 'border-yellow-300 bg-yellow-50 hover:border-yellow-400'
                              : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                      }`}
                    >
                      {/* Main Content Row */}
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        {/* Left Section - Details */}
                        <div className="flex-1 min-w-0">
                          {/* Title & Status */}
                          <div className="flex items-start gap-2 mb-2">
                            <h3 className="font-medium text-gray-900 break-words flex-1">
                              {schedule.title}
                            </h3>
                            {!schedule.is_active && (
                              <span className="badge bg-gray-100 text-gray-600 border-gray-300 text-xs shrink-0">
                                <Pause className="w-3 h-3 mr-1" />
                                Inactiv
                              </span>
                            )}
                          </div>

                          {/* Description */}
                          {schedule.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {schedule.description}
                            </p>
                          )}

                          {/* Metadata */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {/* Frequency */}
                            <span className="badge badge-secondary">
                              {getFrequencyLabel(schedule.frequency)}
                            </span>

                            {/* Procedure */}
                            {hasProcedure && (
                              <span className="badge bg-purple-100 text-purple-800 border-purple-200">
                                📋 Procedură
                              </span>
                            )}

                            {/* Checklist */}
                            {hasChecklist && (
                              <span className="badge bg-blue-100 text-blue-800 border-blue-200">
                                ✓ Checklist
                              </span>
                            )}

                            {/* Assigned User */}
                            {schedule.assigned_user && (
                              <span className="text-gray-600 flex items-center">
                                <User className="w-3 h-3 mr-1" />
                                {schedule.assigned_user.full_name}
                              </span>
                            )}

                            {/* Estimated Hours */}
                            {schedule.estimated_hours && (
                              <span className="text-gray-600 flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {schedule.estimated_hours}h
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right Section - Due Date & Actions */}
                        <div className="flex flex-row md:flex-col items-center md:items-end gap-3 md:gap-2 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4 border-gray-200">
                          {/* Next Due Date */}
                          {schedule.is_active && (
                            <div className="text-left md:text-right flex-1 md:flex-initial">
                              <p className="text-xs text-gray-600 mb-1">Scadență:</p>
                              <p className={`text-sm font-semibold ${
                                overdue ? 'text-red-600' :
                                daysUntil >= 0 && daysUntil <= 7 ? 'text-yellow-600' :
                                'text-gray-900'
                              }`}>
                                {new Date(schedule.next_due_date).toLocaleDateString('ro-RO')}
                              </p>
                              <p className={`text-xs font-medium ${
                                overdue ? 'text-red-600' :
                                daysUntil >= 0 && daysUntil <= 7 ? 'text-yellow-600' :
                                'text-gray-500'
                              }`}>
                                {overdue ? (
                                  <>⚠️ {Math.abs(daysUntil)}z întârziere</>
                                ) : daysUntil === 0 ? (
                                  <>🔔 Astăzi!</>
                                ) : daysUntil <= 7 ? (
                                  <>⏰ în {daysUntil}z</>
                                ) : (
                                  <>✓ în {daysUntil}z</>
                                )}
                              </p>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 md:gap-1.5">
                            {/* Complete Button */}
                            {schedule.is_active && (
                              <button
                                onClick={() => {
                                  setSelectedScheduleForCompletion(schedule)
                                  setShowCompletionWizard(true)
                                }}
                                className="p-1.5 md:p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Complete Maintenance"
                              >
                                <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                              </button>
                            )}

                            {/* Pause/Resume Button */}
                            <button
                              onClick={() => toggleScheduleActiveMutation.mutate({ 
                                id: schedule.id, 
                                isActive: schedule.is_active 
                              })}
                              disabled={toggleScheduleActiveMutation.isLoading}
                              className="p-1.5 md:p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                              title={schedule.is_active ? 'Pause' : 'Resume'}
                            >
                              {schedule.is_active ? (
                                <Pause className="w-4 h-4 md:w-5 md:h-5" />
                              ) : (
                                <Play className="w-4 h-4 md:w-5 md:h-5" />
                              )}
                            </button>

                            {/* Edit Button */}
                            {canEdit && (
                              <Link
                                to={`/schedules?edit=${schedule.id}`}
                                className="p-1.5 md:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-block"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4 md:w-5 md:h-5" />
                              </Link>
                            )}

                            {/* Delete Button */}
                            {canDelete && (
                              <button
                                onClick={() => {
                                  if (window.confirm('Sigur vrei să ștergi acest program de mentenanță?')) {
                                    deleteScheduleMutation.mutate(schedule.id)
                                  }
                                }}
                                disabled={deleteScheduleMutation.isLoading}
                                className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Last Completed Info */}
                      {schedule.last_completed_date && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-600">
                            Ultima completare: {new Date(schedule.last_completed_date).toLocaleDateString('ro-RO')}
                            {schedule.times_completed > 0 && (
                              <span className="ml-2 text-green-600 font-medium">
                                ({schedule.times_completed} {schedule.times_completed === 1 ? 'dată' : 'dăți'})
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Compatible Parts from Inventory */}
          {compatibleParts && compatibleParts.length > 0 && (
            <div className="card p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 flex items-center">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary-600" />
                  Piese din Inventar
                </h2>
                <Link
                  to="/parts-inventory"
                  className="text-primary-600 hover:text-primary-700 text-xs sm:text-sm font-medium"
                >
                  Vezi Inventar
                </Link>
              </div>
              
              <div className="space-y-2 sm:space-y-3">
                {compatibleParts.map((part) => (
                  <div
                    key={part.id}
                    className="p-3 sm:p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm sm:text-base break-words">{part.name}</p>
                        {part.part_number && (
                          <p className="text-xs text-gray-500 font-mono mt-1 break-all">{part.part_number}</p>
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-2">
                          <span className="text-xs sm:text-sm text-gray-600">
                            Stoc: <span className={`font-semibold ${
                              part.quantity_in_stock <= part.min_quantity ? 'text-yellow-600' : 'text-gray-900'
                            }`}>
                              {part.quantity_in_stock} {part.unit_of_measure}
                            </span>
                          </span>
                          <span className="text-xs sm:text-sm text-gray-600">
                            {part.unit_price.toFixed(2)} RON/{part.unit_of_measure}
                          </span>
                        </div>
                      </div>
                      {part.quantity_in_stock <= part.min_quantity && (
                        <span className="badge badge-warning text-xs shrink-0">
                          Stoc Scăzut
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

      {/* Maintenance Schedule Completion Wizard */}
      {showCompletionWizard && selectedScheduleForCompletion && (
        <ScheduleCompletionWizard
          schedule={selectedScheduleForCompletion}
          onClose={() => {
            setShowCompletionWizard(false)
            setSelectedScheduleForCompletion(null)
          }}
          onComplete={() => {
            setShowCompletionWizard(false)
            setSelectedScheduleForCompletion(null)
            queryClient.invalidateQueries({ queryKey: ['equipment-maintenance-schedules', id] })
          }}
        />
      )}
    </div>
  )
}
