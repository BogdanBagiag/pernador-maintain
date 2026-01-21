import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { 
  ArrowLeft, 
  Edit, 
  Wrench,
  MapPin,
  Calendar,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  DollarSign,
  FileText,
  Trash2,
  Save,
  Package,
  Plus,
  Expand,
  X,
  Camera,
  Upload
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import PartsUsageModal from '../components/PartsUsageModal'

export default function WorkOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const [showCompletionForm, setShowCompletionForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [newAssignedTo, setNewAssignedTo] = useState('')
  const [showPartsModal, setShowPartsModal] = useState(false)
  const [selectedParts, setSelectedParts] = useState([])
  const [completionData, setCompletionData] = useState({
    completed_by: '',
    parts_replaced: '',
    parts_cost: '',
    labor_cost: '',
    actual_hours: '',
    completion_notes: '',
    inventory_parts: []
  })
  
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Handle ESC key to close image modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showImageModal) {
        setShowImageModal(false)
      }
    }
    
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showImageModal])

  // Fetch work order with relations
  const { data: workOrder, isLoading } = useQuery({
    queryKey: ['work-order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          equipment:equipment(
            id, 
            name, 
            serial_number,
            location:locations(name, building)
          ),
          location:locations(
            id,
            name,
            building,
            floor,
            room,
            address
          ),
          assigned_to_user:profiles!work_orders_assigned_to_fkey(id, full_name, email),
          created_by_user:profiles!work_orders_created_by_fkey(id, full_name, email)
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
  })

  // Fetch work order attachments
  const { data: attachments } = useQuery({
    queryKey: ['work-order-attachments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_order_attachments')
        .select(`
          *,
          uploaded_by_user:profiles(id, full_name)
        `)
        .eq('work_order_id', id)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      return data
    },
  })

  // Fetch comments
  const { data: comments } = useQuery({
    queryKey: ['work-order-comments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_order_comments')
        .select(`
          *,
          user:profiles(id, full_name, email)
        `)
        .eq('work_order_id', id)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      return data
    },
  })

  // Fetch users for reassignment
  const { data: users } = useQuery({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['admin', 'technician'])
        .order('full_name')
      
      if (error) throw error
      return data
    },
  })

  const reassignMutation = useMutation({
    mutationFn: async (newUserId) => {
      const { error } = await supabase
        .from('work_orders')
        .update({ assigned_to: newUserId })
        .eq('id', id)
      
      if (error) throw error
      return newUserId
    },
    onSuccess: async (newUserId) => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] })
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      setShowReassignModal(false)
      
      
      // Send notification
      if (workOrder) {
        try {
          const { notifyWorkOrderAssigned } = await import('../lib/notifications')
          
          if (newUserId) {
            // Assigned to specific user
            const assignedUser = users?.find(u => u.id === newUserId)
            if (assignedUser) {
              await notifyWorkOrderAssigned(workOrder, assignedUser)
            }
          } else {
            // Unassigned - notify all admins & technicians
            const allUsers = users?.filter(u => ['admin', 'technician'].includes(u.role))
            if (allUsers && allUsers.length > 0) {
              await Promise.all(
                allUsers.map(u => {
                  return notifyWorkOrderAssigned(workOrder, u)
                })
              )
            }
          }
        } catch (err) {
          console.error('âŒ Notification error:', err)
        }
      }
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ newStatus, completionDetails }) => {
      let imageUrl = null
      
      // Upload image if provided
      if (imageFile) {
        setUploadingImage(true)
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `work-order-completions/${fileName}`
        
        const { error: uploadError } = await supabase.storage
          .from('maintenance-files')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: false
          })
        
        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error('Eroare la încărcarea imaginii')
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('maintenance-files')
          .getPublicUrl(filePath)
        
        imageUrl = publicUrl
        setUploadingImage(false)
      }
      
      const updateData = { status: newStatus }
      
      if (newStatus === 'completed') {
        updateData.completed_date = new Date().toISOString()
        
        // Add completion details if provided
        if (completionDetails) {
          if (completionDetails.completed_by) updateData.completed_by = completionDetails.completed_by
          if (completionDetails.parts_replaced) updateData.parts_replaced = completionDetails.parts_replaced
          if (completionDetails.parts_cost) updateData.parts_cost = parseFloat(completionDetails.parts_cost)
          if (completionDetails.labor_cost) updateData.labor_cost = parseFloat(completionDetails.labor_cost)
          if (completionDetails.actual_hours) updateData.actual_hours = parseFloat(completionDetails.actual_hours)
          if (completionDetails.completion_notes) updateData.completion_notes = completionDetails.completion_notes
        }
      }
      
      const { error } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('id', id)
      
      if (error) throw error
      
      // Save completion image as attachment
      if (imageUrl) {
        const { error: attachError } = await supabase
          .from('work_order_attachments')
          .insert({
            work_order_id: id,
            file_url: imageUrl,
            file_name: imageFile.name,
            file_type: imageFile.type,
            attachment_type: 'completion',
            uploaded_by: user.id
          })
        
        if (attachError) {
          console.error('Error saving attachment:', attachError)
          // Don't throw - we still completed the work order
        }
      }
      
      return newStatus
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] })
      queryClient.invalidateQueries({ queryKey: ['work-order-attachments', id] })
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      setShowCompletionForm(false)
      setImageFile(null)
      setImagePreview(null)
      
      // Redirect to work orders list with Open tab active after completing
      if (newStatus === 'completed') {
        navigate('/work-orders?status=open')
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Verifică dacă există piese folosite pentru acest work order
      const { data: usedParts, error: partsError } = await supabase
        .from('parts_usage')
        .select(`
          quantity_used,
          part_id,
          inventory_parts (name, unit_of_measure)
        `)
        .eq('work_order_id', id)
      
      if (partsError) throw partsError
      
      // Șterge work order-ul (CASCADE va șterge automat parts_usage, comments, attachments)
      // Trigger-ul din baza de date va restabili automat stocul
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      return { usedParts }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-parts'] })
      
      // Afișează mesaj despre piesele returnate
      if (data.usedParts && data.usedParts.length > 0) {
        console.log('Piese returnate în stoc:', data.usedParts)
      }
      
      navigate('/work-orders')
    },
  })

  const handleDelete = async () => {
    // Verifică dacă există piese folosite
    const { data: usedParts } = await supabase
      .from('parts_usage')
      .select(`
        quantity_used,
        inventory_parts (name, unit_of_measure)
      `)
      .eq('work_order_id', id)
    
    let confirmMessage = 'Sigur doriți să ștergeți această comandă de lucru?\n\n'
    
    if (usedParts && usedParts.length > 0) {
      confirmMessage += 'Se vor șterge:\n'
      confirmMessage += '• Toate comentariile și atașamentele\n'
      confirmMessage += '• Istoricul pieselor folosite\n\n'
      confirmMessage += 'Piesele vor fi returnate în stoc:\n'
      usedParts.forEach(part => {
        confirmMessage += `• ${part.inventory_parts.name}: ${part.quantity_used} ${part.inventory_parts.unit_of_measure}\n`
      })
      confirmMessage += '\nAceastă acțiune nu poate fi anulată!'
    } else {
      confirmMessage += 'Se vor șterge toate comentariile și atașamentele asociate.\n'
      confirmMessage += 'Această acțiune nu poate fi anulată!'
    }
    
    if (window.confirm(confirmMessage)) {
      deleteMutation.mutate()
    }
  }

  const handleCompletionSubmit = (e) => {
    e.preventDefault()
    updateStatusMutation.mutate({ 
      newStatus: 'completed', 
      completionDetails: completionData 
    }, {
      onSuccess: async () => {
        // Salvează piesele din inventar în parts_usage
        if (selectedParts && selectedParts.length > 0) {
          try {
            const usageRecords = selectedParts.map(part => ({
              part_id: part.partId,
              work_order_id: id,
              equipment_id: workOrder.equipment_id,
              quantity_used: part.quantity,
              unit_cost: part.unitCost,
              used_by: user.id,
              notes: 'Folosit la finalizarea WO'
            }))

            const { error } = await supabase
              .from('parts_usage')
              .insert(usageRecords)

            if (error) {
              console.error('Error saving parts:', error)
            } else {
              // Invalidează cache-ul pentru inventar
              queryClient.invalidateQueries(['inventory-parts'])
            }
          } catch (error) {
            console.error('Error saving inventory parts:', error)
          }
        }
        
        setShowCompletionForm(false)
        setSelectedParts([])
        queryClient.invalidateQueries(['work-order', id])
      }
    })
  }

  const handleCompletionChange = (e) => {
    setCompletionData({
      ...completionData,
      [e.target.name]: e.target.value
    })
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Vă rugăm să selectați un fișier imagine')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Imaginea este prea mare. Maxim 5MB.')
        return
      }
      
      setImageFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  // Handler pentru salvarea pieselor selectate din inventar
  const handlePartsSelected = (parts) => {
    setSelectedParts(parts)
    const inventoryPartsCost = parts.reduce((sum, p) => sum + (p.quantity * p.unitCost), 0)
    setCompletionData(prev => ({
      ...prev,
      inventory_parts: parts,
      parts_cost: (parseFloat(prev.parts_cost || 0) + inventoryPartsCost).toString()
    }))
  }

  // Handler pentru eliminare piesă selectată
  const handleRemoveInventoryPart = (partId) => {
    const part = selectedParts.find(p => p.partId === partId)
    const updatedParts = selectedParts.filter(p => p.partId !== partId)
    setSelectedParts(updatedParts)
    setCompletionData(prev => ({
      ...prev,
      inventory_parts: updatedParts,
      parts_cost: Math.max(0, parseFloat(prev.parts_cost || 0) - (part.quantity * part.unitCost)).toString()
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!workOrder) {
    return (
      <div className="card text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Work order not found
        </h3>
        <button onClick={() => navigate('/work-orders')} className="btn-primary">
          Back to Work Orders
        </button>
      </div>
    )
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <Clock className="w-6 h-6 text-blue-600" />
      case 'in_progress':
        return <Wrench className="w-6 h-6 text-yellow-600" />
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-600" />
      case 'cancelled':
        return <XCircle className="w-6 h-6 text-red-600" />
      default:
        return <Clock className="w-6 h-6 text-gray-600" />
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return 'badge-info'
      case 'in_progress':
        return 'badge-warning'
      case 'on_hold':
        return 'badge-secondary'
      case 'completed':
        return 'badge-success'
      case 'cancelled':
        return 'badge-danger'
      default:
        return 'badge-info'
    }
  }

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'critical':
        return 'badge-danger'
      case 'high':
        return 'badge-warning'
      case 'medium':
        return 'badge-info'
      case 'low':
        return 'badge-secondary'
      default:
        return 'badge-info'
    }
  }

  return (
    <div className="w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8 pt-4">
        <button
          onClick={() => navigate('/work-orders')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Work Orders
        </button>
        
        <div className="flex flex-col gap-4">
          {/* Title and Status */}
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getStatusIcon(workOrder.status)}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 break-words leading-tight">{workOrder.title}</h1>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
                <span className={`badge ${getStatusBadge(workOrder.status)} capitalize text-xs`}>
                  {workOrder.status.replace('_', ' ')}
                </span>
                <span className={`badge ${getPriorityBadge(workOrder.priority)} capitalize text-xs`}>
                  {workOrder.priority}
                </span>
                {workOrder.type && (
                  <span className="badge badge-secondary capitalize text-xs">
                    {workOrder.type}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Action Buttons - Full width on mobile, inline on desktop */}
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
            {(profile?.role === 'admin' || profile?.role === 'manager') && (
              <button
                onClick={() => {
                  setNewAssignedTo(workOrder.assigned_to || '')
                  setShowReassignModal(true)
                }}
                className="btn-secondary inline-flex items-center justify-center whitespace-nowrap w-full sm:w-auto"
              >
                <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Reasignează
              </button>
            )}
            <Link
              to={`/work-orders/${id}/edit`}
              className="btn-primary inline-flex items-center justify-center whitespace-nowrap w-full sm:w-auto"
            >
              <Edit className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Edit
            </Link>
            {profile?.role === 'admin' && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isLoading}
                className="btn-secondary inline-flex items-center justify-center whitespace-nowrap text-red-600 hover:bg-red-50 hover:border-red-300 w-full sm:w-auto"
              >
                {deleteMutation.isLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Șterge
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
          {/* Description */}
          <div className="card">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Description</h2>
            <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap break-words">
              {workOrder.description || 'No description provided'}
            </p>
          </div>

          {/* Attachments Section */}
          {((attachments && attachments.length > 0) || workOrder.image_url) && (
            <div className="card">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Fotografii</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Report attachments (initial photos) */}
                {attachments && attachments.filter(att => att.attachment_type === 'report' || att.attachment_type === 'general').map((attachment) => (
                  <div key={attachment.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">
                        📸 Fotografie Raportare
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(attachment.created_at).toLocaleDateString('ro-RO')}
                      </p>
                    </div>
                    <div className="relative group">
                      <img 
                        src={attachment.file_url} 
                        alt="Report photo" 
                        className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity shadow-md"
                        onClick={() => {
                          setShowImageModal(true)
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-black bg-opacity-50 rounded-full p-2 sm:p-3">
                          <Expand className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                        </div>
                      </div>
                    </div>
                    {attachment.uploaded_by_user && (
                      <p className="text-xs text-gray-500">
                        Încărcat de: {attachment.uploaded_by_user.full_name}
                      </p>
                    )}
                  </div>
                ))}
                
                {/* Legacy image_url (if no attachments exist yet) */}
                {workOrder.image_url && (!attachments || attachments.length === 0) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">
                        📸 Fotografie Raportare
                      </p>
                    </div>
                    <div className="relative group">
                      <img 
                        src={workOrder.image_url} 
                        alt="Issue photo" 
                        className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity shadow-md"
                        onClick={() => setShowImageModal(true)}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-black bg-opacity-50 rounded-full p-2 sm:p-3">
                          <Expand className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Completion attachments (repair photos) */}
                {attachments && attachments.filter(att => att.attachment_type === 'completion').map((attachment) => (
                  <div key={attachment.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-green-700">
                        ✅ Fotografie Reparație
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(attachment.created_at).toLocaleDateString('ro-RO')}
                      </p>
                    </div>
                    <div className="relative group">
                      <img 
                        src={attachment.file_url} 
                        alt="Completion photo" 
                        className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity shadow-md border-2 border-green-200"
                        onClick={() => {
                          setShowImageModal(true)
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-black bg-opacity-50 rounded-full p-2 sm:p-3">
                          <Expand className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                        </div>
                      </div>
                    </div>
                    {attachment.uploaded_by_user && (
                      <p className="text-xs text-gray-500">
                        Încărcat de: {attachment.uploaded_by_user.full_name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              
              <p className="text-xs sm:text-sm text-gray-500 mt-3 text-center">
                Click pe imagine pentru zoom complet
              </p>
            </div>
          )}

          {/* Equipment Info */}
          {workOrder.equipment && (
            <div className="card">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Equipment</h2>
              <Link
                to={`/equipment/${workOrder.equipment.id}`}
                className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Wrench className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-primary-600 mt-1 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm sm:text-base text-gray-900 break-words">{workOrder.equipment.name}</p>
                  {workOrder.equipment.serial_number && (
                    <p className="text-xs sm:text-sm text-gray-600 break-all mt-0.5">SN: {workOrder.equipment.serial_number}</p>
                  )}
                  {workOrder.equipment.location && (
                    <p className="text-xs sm:text-sm text-gray-600 flex items-start mt-1 flex-wrap gap-1">
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                      <span className="break-words">
                        {workOrder.equipment.location.name}
                        {workOrder.equipment.location.building && ` - ${workOrder.equipment.location.building}`}
                      </span>
                    </p>
                  )}
                </div>
              </Link>
            </div>
          )}

          {/* Location Info (when no equipment) */}
          {!workOrder.equipment && workOrder.location && (
            <div className="card">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Location</h2>
              <Link
                to={`/locations/${workOrder.location.id}`}
                className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <MapPin className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-primary-600 mt-1 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm sm:text-base text-gray-900 break-words">{workOrder.location.name}</p>
                  {workOrder.location.building && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-0.5">Building: {workOrder.location.building}</p>
                  )}
                  {workOrder.location.floor && (
                    <p className="text-xs sm:text-sm text-gray-600">Floor: {workOrder.location.floor}</p>
                  )}
                  {workOrder.location.room && (
                    <p className="text-xs sm:text-sm text-gray-600">Room: {workOrder.location.room}</p>
                  )}
                  {workOrder.location.address && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">{workOrder.location.address}</p>
                  )}
                </div>
              </Link>
            </div>
          )}

          {/* Comments Section */}
          <div className="card">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Activity</h2>
            {!comments || comments.length === 0 ? (
              <p className="text-sm sm:text-base text-gray-500 text-center py-6 sm:py-8">No comments yet</p>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <p className="font-medium text-sm sm:text-base text-gray-900 break-words">
                          {comment.user?.full_name || 'Unknown User'}
                        </p>
                        <span className="text-xs sm:text-sm text-gray-500 break-words">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm sm:text-base text-gray-700 mt-1 break-words">{comment.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completion Details - Show only if completed */}
          {workOrder.status === 'completed' && (
            workOrder.completed_by || 
            workOrder.parts_replaced || 
            workOrder.parts_cost || 
            workOrder.labor_cost ||
            workOrder.completion_notes
          ) && (
            <div className="card bg-green-50 border-green-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 mr-2" />
                Detalii Finalizare
              </h2>
              
              <div className="space-y-3 sm:space-y-4">
                {workOrder.completed_by && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                      Finalizat De
                    </label>
                    <p className="text-sm sm:text-base text-gray-900 font-medium break-words">{workOrder.completed_by}</p>
                  </div>
                )}

                {workOrder.parts_replaced && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                      Piese Înlocuite
                    </label>
                    <p className="text-sm sm:text-base text-gray-900 whitespace-pre-wrap break-words">{workOrder.parts_replaced}</p>
                  </div>
                )}

                {(workOrder.parts_cost || workOrder.labor_cost) && (
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {workOrder.parts_cost > 0 && (
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center">
                          <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                          Cost Piese
                        </label>
                        <p className="text-lg sm:text-xl font-bold text-gray-900">
                          {parseFloat(workOrder.parts_cost).toFixed(2)} Lei
                        </p>
                      </div>
                    )}

                    {workOrder.labor_cost > 0 && (
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center">
                          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                          Cost Manoperă
                        </label>
                        <p className="text-lg sm:text-xl font-bold text-gray-900">
                          {parseFloat(workOrder.labor_cost).toFixed(2)} Lei
                        </p>
                      </div>
                    )}

                    {(workOrder.parts_cost > 0 || workOrder.labor_cost > 0) && (
                      <div className="bg-green-100 p-3 rounded-lg">
                        <label className="block text-xs sm:text-sm font-medium text-green-700 mb-1">
                          Cost Total
                        </label>
                        <p className="text-xl sm:text-2xl font-bold text-green-600">
                          {(parseFloat(workOrder.parts_cost || 0) + parseFloat(workOrder.labor_cost || 0)).toFixed(2)} Lei
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {workOrder.actual_hours && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                      Timp Lucrat
                    </label>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                      {workOrder.actual_hours}h
                    </p>
                  </div>
                )}

                {workOrder.completion_notes && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                      Note
                    </label>
                    <div className="bg-white rounded-lg p-3 sm:p-4 border border-green-200">
                      <p className="text-sm sm:text-base text-gray-900 whitespace-pre-wrap break-words">{workOrder.completion_notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6 min-w-0">
          {/* Quick Actions */}
          <div className="card">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Actions</h3>
            <div className="flex flex-col gap-2">
              {workOrder.status === 'open' && (
                <button
                  onClick={() => updateStatusMutation.mutate({ newStatus: 'in_progress' })}
                  className="btn-primary w-full flex items-center justify-center"
                  disabled={updateStatusMutation.isLoading}
                >
                  Începe Lucrul
                </button>
              )}
              {workOrder.status === 'in_progress' && (
                <>
                  <button
                    onClick={() => setShowCompletionForm(true)}
                    className="btn-primary w-full bg-green-600 hover:bg-green-700 flex items-center justify-center"
                    disabled={updateStatusMutation.isLoading}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marchează Complet
                  </button>
                  <button
                    onClick={() => updateStatusMutation.mutate({ newStatus: 'on_hold' })}
                    className="btn-secondary w-full flex items-center justify-center"
                    disabled={updateStatusMutation.isLoading}
                  >
                    Pune în Așteptare
                  </button>
                </>
              )}
              {workOrder.status === 'on_hold' && (
                <button
                  onClick={() => updateStatusMutation.mutate({ newStatus: 'in_progress' })}
                  className="btn-primary w-full flex items-center justify-center"
                  disabled={updateStatusMutation.isLoading}
                >
                  Reia Lucrul
                </button>
              )}
              {workOrder.status !== 'cancelled' && workOrder.status !== 'completed' && (
                <button
                  onClick={() => updateStatusMutation.mutate({ newStatus: 'cancelled' })}
                  className="btn-secondary w-full text-red-600 hover:bg-red-50 flex items-center justify-center"
                  disabled={updateStatusMutation.isLoading}
                >
                  Anulează Comandă
                </button>
              )}
            </div>
          </div>

          {/* Completion Form Modal */}
          {showCompletionForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="text-lg sm:text-2xl font-bold text-gray-900 pr-2">Finalizează Comanda de Lucru</h3>
                    <button
                      onClick={() => setShowCompletionForm(false)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>

                  <form onSubmit={handleCompletionSubmit} className="space-y-4">
                    {/* Completed By */}
                    <div>
                      <label htmlFor="completed_by" className="block text-sm font-medium text-gray-700 mb-1">
                        Finalizat De <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          id="completed_by"
                          name="completed_by"
                          type="text"
                          required
                          value={completionData.completed_by}
                          onChange={handleCompletionChange}
                          className="input pl-10"
                          placeholder="Numele tehnicianului"
                        />
                      </div>
                    </div>

                    {/* Parts Replaced */}
                    <div>
                      <label htmlFor="parts_replaced" className="block text-sm font-medium text-gray-700 mb-1">
                        Piese Înlocuite (Manual)
                      </label>
                      <div className="relative">
                        <Wrench className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <textarea
                          id="parts_replaced"
                          name="parts_replaced"
                          rows={3}
                          value={completionData.parts_replaced}
                          onChange={handleCompletionChange}
                          className="input pl-10"
                          placeholder="ex: Rulment motor, Curea transmisie, Filtru ulei..."
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Listează toate piesele care au fost înlocuite sau folosite (text liber)
                      </p>
                    </div>

                    {/* Piese din Inventar */}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Piese din Inventar
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowPartsModal(true)}
                          className="btn-secondary inline-flex items-center text-sm"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Selectează Piese
                        </button>
                      </div>
                      
                      {selectedParts && selectedParts.length > 0 ? (
                        <div className="space-y-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                          {selectedParts.map((part) => (
                            <div
                              key={part.partId}
                              className="flex items-center justify-between bg-white rounded p-2"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {part.partName}
                                  </p>
                                  {part.partNumber && (
                                    <p className="text-xs text-gray-500 font-mono truncate">{part.partNumber}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <span className="text-sm text-gray-600 whitespace-nowrap">
                                  {part.quantity} {part.unitOfMeasure}
                                </span>
                                <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                                  {(part.quantity * part.unitCost).toFixed(2)} RON
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInventoryPart(part.partId)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Elimină"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          
                          <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                            <span className="text-sm font-medium text-gray-700">Cost Total Piese Inventar:</span>
                            <span className="text-lg font-bold text-blue-900">
                              {selectedParts.reduce((sum, p) => sum + (p.quantity * p.unitCost), 0).toFixed(2)} RON
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 bg-gray-50 border border-gray-200 rounded-lg">
                          <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm text-gray-500">Nicio piesă selectată din inventar</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Click "Selectează Piese" pentru a adăuga piese din inventar
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Costs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Parts Cost */}
                      <div>
                        <label htmlFor="parts_cost" className="block text-sm font-medium text-gray-700 mb-1">
                          Cost Piese (Lei)
                        </label>
                        <div className="relative">
                          <Wrench className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            id="parts_cost"
                            name="parts_cost"
                            type="number"
                            step="0.01"
                            min="0"
                            value={completionData.parts_cost}
                            onChange={handleCompletionChange}
                            className="input pl-10"
                            placeholder="0.00"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Cost pentru piese înlocuite
                        </p>
                      </div>

                      {/* Labor Cost */}
                      <div>
                        <label htmlFor="labor_cost" className="block text-sm font-medium text-gray-700 mb-1">
                          Cost Manoperă (Lei)
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            id="labor_cost"
                            name="labor_cost"
                            type="number"
                            step="0.01"
                            min="0"
                            value={completionData.labor_cost}
                            onChange={handleCompletionChange}
                            className="input pl-10"
                            placeholder="0.00"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Cost pentru manoperă
                        </p>
                      </div>
                    </div>

                    {/* Total Cost Display */}
                    {(completionData.parts_cost || completionData.labor_cost) && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Cost Total:</span>
                          <span className="text-2xl font-bold text-green-600">
                            {(parseFloat(completionData.parts_cost || 0) + parseFloat(completionData.labor_cost || 0)).toFixed(2)} Lei
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Hours and Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Actual Hours */}
                      <div>
                        <label htmlFor="actual_hours" className="block text-sm font-medium text-gray-700 mb-1">
                          Ore Lucrate
                        </label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            id="actual_hours"
                            name="actual_hours"
                            type="number"
                            step="0.5"
                            min="0"
                            value={completionData.actual_hours}
                            onChange={handleCompletionChange}
                            className="input pl-10"
                            placeholder="0.0"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Timp total petrecut la reparație
                        </p>
                      </div>
                    </div>

                    {/* Image Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fotografie Finalizare (opțional)
                      </label>
                      
                      {!imagePreview ? (
                        <div className="space-y-3">
                          {/* Camera Button */}
                          <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 hover:border-blue-400 transition-colors bg-blue-50">
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleImageChange}
                              className="hidden"
                              id="camera-capture"
                            />
                            <label 
                              htmlFor="camera-capture"
                              className="cursor-pointer flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Camera className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-semibold text-gray-900">
                                    📷 Fă Poză cu Camera
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    Fotografiază lucrarea finalizată
                                  </p>
                                </div>
                              </div>
                              <Camera className="w-5 h-5 text-blue-600 flex-shrink-0" />
                            </label>
                          </div>

                          {/* Gallery Button */}
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400 transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="hidden"
                              id="gallery-upload"
                            />
                            <label 
                              htmlFor="gallery-upload"
                              className="cursor-pointer flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Upload className="w-5 h-5 text-gray-600" />
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-semibold text-gray-900">
                                    🖼️ Alege din Galerie
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    Selectează o poză existentă
                                  </p>
                                </div>
                              </div>
                              <Upload className="w-5 h-5 text-gray-500 flex-shrink-0" />
                            </label>
                          </div>

                          <p className="text-xs text-gray-500 text-center">
                            PNG, JPG, GIF până la 5MB
                          </p>
                        </div>
                      ) : (
                        <div className="relative">
                          <img 
                            src={imagePreview} 
                            alt="Preview" 
                            className="w-full h-64 object-cover rounded-lg border-2 border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={removeImage}
                            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="mt-2 flex items-center justify-between">
                            <p className="text-xs text-gray-600">
                              📎 {imageFile?.name}
                            </p>
                            <button
                              type="button"
                              onClick={removeImage}
                              className="text-xs text-red-600 hover:text-red-700 font-medium"
                            >
                              Schimbă poza
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Completion Notes */}
                    <div>
                      <label htmlFor="completion_notes" className="block text-sm font-medium text-gray-700 mb-1">
                        Note Finalizare
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <textarea
                          id="completion_notes"
                          name="completion_notes"
                          rows={4}
                          value={completionData.completion_notes}
                          onChange={handleCompletionChange}
                          className="input pl-10"
                          placeholder="Detalii suplimentare despre reparație, probleme găsite, recomandări..."
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setShowCompletionForm(false)}
                        className="btn-secondary w-full sm:w-auto"
                        disabled={updateStatusMutation.isLoading || uploadingImage}
                      >
                        Anulează
                      </button>
                      <button
                        type="submit"
                        className="btn-primary inline-flex items-center justify-center bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                        disabled={updateStatusMutation.isLoading || uploadingImage}
                      >
                        {updateStatusMutation.isLoading || uploadingImage ? (
                          <>
                            <LoadingSpinner size="sm" />
                            <span className="ml-2">
                              {uploadingImage ? 'Se încarcă imaginea...' : 'Finalizare...'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Save className="w-5 h-5 mr-2" />
                            Finalizează Comanda
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                  
                  {/* Modal Selectare Piese - MUTAT AFARĂ DIN FORM */}
                  {showPartsModal && (
                    <PartsUsageModal
                      workOrderId={id}
                      equipmentId={workOrder?.equipment_id}
                      onClose={() => setShowPartsModal(false)}
                      onSave={(parts) => {
                        handlePartsSelected(parts)
                        setShowPartsModal(false)
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Detalii</h3>
            <dl className="space-y-2 sm:space-y-3">
              {workOrder.assigned_to_user && (
                <div>
                  <dt className="text-xs sm:text-sm font-medium text-gray-500 flex items-center">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                    Asignat Către
                  </dt>
                  <dd className="mt-1 text-sm sm:text-base text-gray-900 break-words">
                    {workOrder.assigned_to_user.full_name}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-xs sm:text-sm font-medium text-gray-500 flex items-center">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                  Creat
                </dt>
                <dd className="mt-1 text-xs sm:text-sm text-gray-900 break-words">
                  {new Date(workOrder.created_at).toLocaleString()}
                </dd>
              </div>

              {workOrder.created_by_user ? (
                <div>
                  <dt className="text-xs sm:text-sm font-medium text-gray-500">Creat De</dt>
                  <dd className="mt-1 text-sm sm:text-base text-gray-900 break-words">
                    {workOrder.created_by_user.full_name}
                  </dd>
                </div>
              ) : (
                <div>
                  <dt className="text-xs sm:text-sm font-medium text-gray-500">Creat De</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      Raport Public
                    </span>
                  </dd>
                </div>
              )}

              {workOrder.scheduled_date && (
                <div>
                  <dt className="text-xs sm:text-sm font-medium text-gray-500 flex items-center">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                    Programat
                  </dt>
                  <dd className="mt-1 text-xs sm:text-sm text-gray-900">
                    {new Date(workOrder.scheduled_date).toLocaleDateString()}
                  </dd>
                </div>
              )}

              {workOrder.completed_date && (
                <div>
                  <dt className="text-xs sm:text-sm font-medium text-gray-500 flex items-center">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                    Finalizat
                  </dt>
                  <dd className="mt-1 text-xs sm:text-sm text-gray-900">
                    {new Date(workOrder.completed_date).toLocaleDateString()}
                  </dd>
                </div>
              )}

              {workOrder.estimated_hours && (
                <div>
                  <dt className="text-xs sm:text-sm font-medium text-gray-500 flex items-center">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                    Ore Estimate
                  </dt>
                  <dd className="mt-1 text-sm sm:text-base text-gray-900">
                    {workOrder.estimated_hours}h
                  </dd>
                </div>
              )}

              {workOrder.actual_hours && (
                <div>
                  <dt className="text-xs sm:text-sm font-medium text-gray-500">Ore Lucrate</dt>
                  <dd className="mt-1 text-sm sm:text-base text-gray-900">
                    {workOrder.actual_hours}h
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Reassignment Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reasignează Work Order
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asignează Către
              </label>
              <select
                value={newAssignedTo}
                onChange={(e) => setNewAssignedTo(e.target.value)}
                className="input w-full"
              >
                <option value="">Neasignat (toți primesc notificare)</option>
                {users?.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowReassignModal(false)}
                className="btn-secondary"
                disabled={reassignMutation.isLoading}
              >
                Anulează
              </button>
              <button
                onClick={() => reassignMutation.mutate(newAssignedTo || null)}
                className="btn-primary"
                disabled={reassignMutation.isLoading}
              >
                {reassignMutation.isLoading ? (
                  <span className="flex items-center">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Se salvează...</span>
                  </span>
                ) : (
                  'Salvează'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && workOrder?.image_url && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-2 sm:p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative w-full h-full flex flex-col">
            {/* Close button */}
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-2 right-2 sm:-top-12 sm:right-0 text-white hover:text-gray-300 transition-colors z-10"
              aria-label="Close"
            >
              <div className="flex items-center gap-2 bg-black bg-opacity-70 px-3 py-2 sm:px-4 rounded-lg">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-xs sm:text-sm hidden sm:inline">Închide (ESC)</span>
              </div>
            </button>
            
            {/* Image container with pinch-to-zoom support */}
            <div className="flex-1 flex items-center justify-center overflow-auto">
              <img 
                src={workOrder.image_url} 
                alt="Issue photo - full size" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                style={{
                  touchAction: 'pinch-zoom',
                  maxWidth: '100%',
                  maxHeight: '100%'
                }}
              />
            </div>
            
            {/* Bottom hint */}
            <div className="absolute bottom-2 left-0 right-0 text-center sm:bottom-auto sm:-bottom-12">
              <p className="text-white text-xs sm:text-sm bg-black bg-opacity-70 inline-block px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg">
                <span className="sm:hidden">Apasă pe fundal pentru a închide</span>
                <span className="hidden sm:inline">Click pe fundal sau apasă ESC pentru a închide</span>
              </p>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
