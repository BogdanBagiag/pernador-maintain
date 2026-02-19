import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { notifyWorkOrderAssigned } from '../lib/notifications'
import { 
  ArrowLeft, 
  Save, 
  AlertTriangle,
  Calendar,
  User,
  FileText,
  Wrench,
  Clock,
  Tag,
  MapPin,
  Camera,
  Upload,
  X,
  DollarSign,
  CheckCircle,
  Package,
  Trash2,
  Plus
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import PartsUsageModal from '../components/PartsUsageModal'

export default function WorkOrderForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  
  const isEditing = !!id
  const preSelectedEquipment = searchParams.get('equipment')
  const preSelectedLocation = searchParams.get('location')
  const preSelectedType = searchParams.get('type')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    source_type: preSelectedEquipment ? 'equipment' : preSelectedLocation ? 'location' : 'equipment',
    equipment_id: preSelectedEquipment || '',
    location_id: preSelectedLocation || '',
    type: preSelectedType || 'corrective',
    priority: 'medium',
    status: 'open',
    assigned_to: '',
    scheduled_date: '',
    estimated_hours: ''
  })

  const [errors, setErrors] = useState({})

  const [completionData, setCompletionData] = useState({
    completed_by: '',
    parts_replaced: '',
    parts_cost: '',
    labor_cost: '',
    actual_hours: '',
    completion_notes: '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [editableParts, setEditableParts] = useState([])
  const [showPartsModal, setShowPartsModal] = useState(false) // parts_usage records being edited

  // Fetch equipment list
  const { data: equipment } = useQuery({
    queryKey: ['equipment-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('id, name, serial_number')
        .order('name')
      if (error) throw error
      return data
    },
  })

  // Fetch locations list
  const { data: locations } = useQuery({
    queryKey: ['locations-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, building, floor')
        .order('name')
      if (error) throw error
      return data
    },
  })

  // Fetch users for assignment
  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name')
      if (error) throw error
      return data
    },
  })

  // Fetch work order if editing
  const { data: workOrder, isLoading } = useQuery({
    queryKey: ['work-order-edit', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: isEditing,
  })

  // Fetch existing parts usage for this work order
  const { data: existingParts } = useQuery({
    queryKey: ['work-order-parts-edit', id],
    queryFn: async () => {
      if (!id) return []
      const { data, error } = await supabase
        .from('parts_usage')
        .select(`
          id,
          quantity_used,
          unit_cost,
          notes,
          part_id,
          inventory_parts:part_id (id, name, unit_of_measure, quantity_in_stock)
        `)
        .eq('work_order_id', id)
      if (error) throw error
      return data
    },
    enabled: isEditing,
  })

  // Populate form when editing
  useEffect(() => {
    if (workOrder) {
      setFormData({
        title: workOrder.title || '',
        description: workOrder.description || '',
        source_type: workOrder.equipment_id ? 'equipment' : 'location',
        equipment_id: workOrder.equipment_id || '',
        location_id: workOrder.location_id || '',
        type: workOrder.type || 'corrective',
        priority: workOrder.priority || 'medium',
        status: workOrder.status || 'open',
        assigned_to: workOrder.assigned_to || '',
        scheduled_date: workOrder.scheduled_date ? workOrder.scheduled_date.split('T')[0] : '',
        estimated_hours: workOrder.estimated_hours || ''
      })
      // Populate completion fields if completed
      if (workOrder.status === 'completed') {
        setCompletionData({
          completed_by: workOrder.completed_by || '',
          parts_replaced: workOrder.parts_replaced || '',
          parts_cost: workOrder.parts_cost || '',
          labor_cost: workOrder.labor_cost || '',
          actual_hours: workOrder.actual_hours || '',
          completion_notes: workOrder.completion_notes || '',
        })
        if (workOrder.image_url) {
          setImagePreview(workOrder.image_url)
        }
      }
    }
  }, [workOrder])

  // Populate editable parts when existing parts load
  useEffect(() => {
    if (existingParts && existingParts.length > 0) {
      setEditableParts(existingParts.map(p => ({
        usageId: p.id,
        partId: p.part_id,
        name: p.inventory_parts?.name || '',
        unit: p.inventory_parts?.unit_of_measure || '',
        stockAvailable: p.inventory_parts?.quantity_in_stock || 0,
        quantity: p.quantity_used,
        unitCost: p.unit_cost,
        notes: p.notes || '',
        isDeleted: false,
      })))
    }
  }, [existingParts])

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async ({ dataToSave, imageFile, existingImageUrl }) => {
      let wasAssigned = false
      let assignedUserId = null
      let workOrderData = null

      // Upload image if a new one was selected
      if (imageFile) {
        setUploadingImage(true)
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `issue-reports/${fileName}`
        const { error: uploadError } = await supabase.storage
          .from('maintenance-files')
          .upload(filePath, imageFile, { cacheControl: '3600', upsert: false })
        if (uploadError) throw new Error('Eroare la \xeenc\u0103rcarea imaginii')
        const { data: { publicUrl } } = supabase.storage.from('maintenance-files').getPublicUrl(filePath)
        dataToSave.image_url = publicUrl
        setUploadingImage(false)
      } else if (existingImageUrl && imagePreview) {
        // Keep existing image
        dataToSave.image_url = existingImageUrl
      } else if (existingImageUrl && !imagePreview) {
        // User removed the image - set to null
        dataToSave.image_url = null
      }

      if (isEditing) {
        const oldAssignedTo = workOrder?.assigned_to
        const newAssignedTo = dataToSave.assigned_to
        wasAssigned = newAssignedTo && newAssignedTo !== oldAssignedTo
        assignedUserId = newAssignedTo

        const { error } = await supabase
          .from('work_orders')
          .update(dataToSave)
          .eq('id', id)
        if (error) throw error

        workOrderData = { ...workOrder, ...dataToSave }
      } else {
        const { data: newWO, error } = await supabase
          .from('work_orders')
          .insert({ ...dataToSave, created_by: user.id })
          .select()
          .single()
        if (error) throw error

        wasAssigned = !!dataToSave.assigned_to
        assignedUserId = dataToSave.assigned_to
        workOrderData = newWO
      }

      // Send push notification
      if (wasAssigned && assignedUserId) {
        try {
          const { data: assignedUser } = await supabase
            .from('profiles').select('*').eq('id', assignedUserId).single()
          if (assignedUser) await notifyWorkOrderAssigned(workOrderData, assignedUser)
        } catch (err) { console.error('Notification error:', err) }
      } else if (!isEditing && !assignedUserId) {
        try {
          const { data: allUsers } = await supabase
            .from('profiles').select('*').in('role', ['admin', 'manager', 'technician'])
          if (allUsers?.length > 0) {
            await Promise.all(allUsers.map(u => notifyWorkOrderAssigned(workOrderData, u)))
          }
        } catch (err) { console.error('Notification error:', err) }
      }
    },
    onSuccess: async () => {
      // Save parts changes if editing a completed work order
      if (isEditing && formData.status === 'completed' && editableParts.length > 0) {
        const toDelete = editableParts.filter(p => p.isDeleted && p.usageId)
        const toUpdate = editableParts.filter(p => !p.isDeleted && p.usageId)
        const toInsert = editableParts.filter(p => !p.isDeleted && !p.usageId)

        if (toDelete.length > 0) {
          await supabase.from('parts_usage').delete().in('id', toDelete.map(p => p.usageId))
        }
        for (const p of toUpdate) {
          await supabase.from('parts_usage')
            .update({ quantity_used: p.quantity, unit_cost: p.unitCost, notes: p.notes })
            .eq('id', p.usageId)
        }
        if (toInsert.length > 0) {
          await supabase.from('parts_usage').insert(
            toInsert.map(p => ({
              part_id: p.partId,
              work_order_id: id,
              equipment_id: workOrder?.equipment_id || null,
              quantity_used: p.quantity,
              unit_cost: p.unitCost,
              used_by: user.id,
              notes: p.notes || 'Adăugat la editare WO'
            }))
          )
        }
        queryClient.invalidateQueries({ queryKey: ['inventory-parts'] })
        queryClient.invalidateQueries({ queryKey: ['work-order-parts-edit', id] })
      }

      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] })
      navigate('/work-orders')
    },
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleCompletionChange = (e) => {
    const { name, value } = e.target
    setCompletionData(prev => ({ ...prev, [name]: value }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Selectați un fișier imagine'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Imaginea este prea mare. Maxim 5MB.'); return }
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (formData.source_type === 'equipment' && !formData.equipment_id) {
      newErrors.equipment_id = 'Equipment is required'
    }

    if (formData.source_type === 'location' && !formData.location_id) {
      newErrors.location_id = 'Location is required'
    }

    if (!formData.type) {
      newErrors.type = 'Type is required'
    }

    if (!formData.priority) {
      newErrors.priority = 'Priority is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!validate()) {
      return
    }

    const dataToSave = {
      title: formData.title.trim(),
      type: formData.type,
      priority: formData.priority,
      status: formData.status,
    }

    // Add equipment_id OR location_id based on source_type
    if (formData.source_type === 'equipment') {
      dataToSave.equipment_id = formData.equipment_id
      dataToSave.location_id = null
    } else {
      dataToSave.location_id = formData.location_id
      dataToSave.equipment_id = null
    }

    // Add optional fields only if they have values
    if (formData.description.trim()) {
      dataToSave.description = formData.description.trim()
    }
    
    if (formData.assigned_to) {
      dataToSave.assigned_to = formData.assigned_to
    }
    
    if (formData.scheduled_date) {
      dataToSave.scheduled_date = formData.scheduled_date
    }
    
    if (formData.estimated_hours) {
      dataToSave.estimated_hours = parseFloat(formData.estimated_hours)
    }

    // If completed, include completion fields
    if (isEditing && formData.status === 'completed') {
      if (completionData.completed_by) dataToSave.completed_by = completionData.completed_by
      if (completionData.parts_replaced) dataToSave.parts_replaced = completionData.parts_replaced
      if (completionData.parts_cost) dataToSave.parts_cost = parseFloat(completionData.parts_cost)
      if (completionData.labor_cost) dataToSave.labor_cost = parseFloat(completionData.labor_cost)
      if (completionData.actual_hours) dataToSave.actual_hours = parseFloat(completionData.actual_hours)
      if (completionData.completion_notes) dataToSave.completion_notes = completionData.completion_notes
    }

    saveMutation.mutate({ dataToSave, imageFile, existingImageUrl: workOrder?.image_url })
  }

  if (isEditing && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <>
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/work-orders')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Work Orders
        </button>
        
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditing ? 'Edit Work Order' : 'Create Work Order'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEditing ? 'Update work order details' : 'Create a new maintenance work order'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-3xl">
        <div className="card space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="title"
                name="title"
                type="text"
                required
                value={formData.title}
                onChange={handleChange}
                className={`input pl-10 ${errors.title ? 'border-red-500' : ''}`}
                placeholder="Brief description of the issue"
              />
            </div>
            {errors.title && (
              <p className="text-sm text-red-600 mt-1">{errors.title}</p>
            )}
          </div>

          {/* Source Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Work Order For <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="source_type"
                  value="equipment"
                  checked={formData.source_type === 'equipment'}
                  onChange={handleChange}
                  className="mr-2"
                />
                <Wrench className="w-4 h-4 mr-1" />
                Equipment
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="source_type"
                  value="location"
                  checked={formData.source_type === 'location'}
                  onChange={handleChange}
                  className="mr-2"
                />
                <MapPin className="w-4 h-4 mr-1" />
                Location
              </label>
            </div>
          </div>

          {/* Equipment Selector (shown when source_type is equipment) */}
          {formData.source_type === 'equipment' && (
            <div>
              <label htmlFor="equipment_id" className="block text-sm font-medium text-gray-700 mb-1">
                Equipment <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Wrench className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  id="equipment_id"
                  name="equipment_id"
                  required
                  value={formData.equipment_id}
                  onChange={handleChange}
                  className={`input pl-10 ${errors.equipment_id ? 'border-red-500' : ''}`}
                >
                  <option value="">Select equipment...</option>
                  {equipment?.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} {eq.serial_number && `(SN: ${eq.serial_number})`}
                    </option>
                  ))}
                </select>
              </div>
              {errors.equipment_id && (
                <p className="text-sm text-red-600 mt-1">{errors.equipment_id}</p>
              )}
            </div>
          )}

          {/* Location Selector (shown when source_type is location) */}
          {formData.source_type === 'location' && (
            <div>
              <label htmlFor="location_id" className="block text-sm font-medium text-gray-700 mb-1">
                Location <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  id="location_id"
                  name="location_id"
                  required
                  value={formData.location_id}
                  onChange={handleChange}
                  className={`input pl-10 ${errors.location_id ? 'border-red-500' : ''}`}
                >
                  <option value="">Select location...</option>
                  {locations?.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.building && `- ${loc.building}`} {loc.floor && `(Floor ${loc.floor})`}
                    </option>
                  ))}
                </select>
              </div>
              {errors.location_id && (
                <p className="text-sm text-red-600 mt-1">{errors.location_id}</p>
              )}
            </div>
          )}

          {/* Type and Priority */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Type */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  id="type"
                  name="type"
                  required
                  value={formData.type}
                  onChange={handleChange}
                  className={`input pl-10 ${errors.type ? 'border-red-500' : ''}`}
                >
                  <option value="corrective">Corrective (Repair)</option>
                  <option value="preventive">Preventive (Maintenance)</option>
                  <option value="inspection">Inspection</option>
                  <option value="upgrade">Upgrade</option>
                </select>
              </div>
              {errors.type && (
                <p className="text-sm text-red-600 mt-1">{errors.type}</p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Priority <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <AlertTriangle className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  id="priority"
                  name="priority"
                  required
                  value={formData.priority}
                  onChange={handleChange}
                  className={`input pl-10 ${errors.priority ? 'border-red-500' : ''}`}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              {errors.priority && (
                <p className="text-sm text-red-600 mt-1">{errors.priority}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleChange}
              className="input"
              placeholder="Detailed description of the work to be done..."
            />
          </div>

          {/* Assigned To and Scheduled Date */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Assigned To */}
            <div>
              <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700 mb-1">
                Assign To
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  id="assigned_to"
                  name="assigned_to"
                  value={formData.assigned_to}
                  onChange={handleChange}
                  className="input pl-10"
                >
                  <option value="">Unassigned</option>
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scheduled Date */}
            <div>
              <label htmlFor="scheduled_date" className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="scheduled_date"
                  name="scheduled_date"
                  type="date"
                  value={formData.scheduled_date}
                  onChange={handleChange}
                  className="input pl-10"
                />
              </div>
            </div>
          </div>

          {/* Status and Estimated Hours */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Status */}
            {isEditing && (
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}

            {/* Estimated Hours */}
            <div>
              <label htmlFor="estimated_hours" className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Hours
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="estimated_hours"
                  name="estimated_hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.estimated_hours}
                  onChange={handleChange}
                  className="input pl-10"
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>

          {/* Completion Details - only shown when editing a completed work order */}
          {isEditing && formData.status === 'completed' && (
            <div className="border-t border-gray-200 pt-6 space-y-6">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Detalii Finalizare
              </h2>

              {/* Completed By */}
              <div>
                <label htmlFor="completed_by" className="block text-sm font-medium text-gray-700 mb-1">
                  Finalizat De
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="completed_by"
                    name="completed_by"
                    type="text"
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
                  Piese Înlocuite
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
              </div>

              {/* Costs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="parts_cost" className="block text-sm font-medium text-gray-700 mb-1">
                    Cost Piese (Lei)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                </div>
                <div>
                  <label htmlFor="labor_cost" className="block text-sm font-medium text-gray-700 mb-1">
                    Cost Manoperă (Lei)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                </div>
              </div>

              {/* Total */}
              {(completionData.parts_cost || completionData.labor_cost) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Cost Total:</span>
                  <span className="text-xl font-bold text-green-600">
                    {(parseFloat(completionData.parts_cost || 0) + parseFloat(completionData.labor_cost || 0)).toFixed(2)} Lei
                  </span>
                </div>
              )}

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
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fotografie Finalizare
                </label>
                {!imagePreview ? (
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 hover:border-blue-400 transition-colors bg-blue-50">
                      <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" id="camera-capture" />
                      <label htmlFor="camera-capture" className="cursor-pointer flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Camera className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">📷 Fă Poză cu Camera</p>
                          <p className="text-xs text-gray-600">Fotografiază lucrarea finalizată</p>
                        </div>
                      </label>
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400 transition-colors">
                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="gallery-upload" />
                      <label htmlFor="gallery-upload" className="cursor-pointer flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Upload className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">🖼️ Alege din Galerie</p>
                          <p className="text-xs text-gray-600">Selectează o poză existentă</p>
                        </div>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 text-center">PNG, JPG, GIF până la 5MB</p>
                  </div>
                ) : (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-64 object-cover rounded-lg border-2 border-gray-200" />
                    <button type="button" onClick={removeImage} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg">
                      <X className="w-4 h-4" />
                    </button>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-gray-600">{imageFile?.name || 'Imagine existentă'}</p>
                      <button type="button" onClick={removeImage} className="text-xs text-red-600 hover:text-red-700 font-medium">Schimbă poza</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Piese din Inventar Folosite */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-500" />
                  Piese din Inventar Folosite
                </label>

                {editableParts.filter(p => !p.isDeleted).length === 0 ? (
                  <p className="text-sm text-gray-400 italic mb-3">Nicio piesă înregistrată.</p>
                ) : (
                  <div className="space-y-2">
                    {editableParts.map((part, index) => {
                      if (part.isDeleted) return null
                      return (
                        <div key={part.usageId || index} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{part.name}</p>
                            <p className="text-xs text-gray-500">{part.unit} · Cost unitar: {part.unitCost} Lei</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <label className="text-xs text-gray-500">Cant.:</label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={part.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                setEditableParts(prev => prev.map((p, i) =>
                                  i === index ? { ...p, quantity: val } : p
                                ))
                              }}
                              className="w-20 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                            />
                            <span className="text-xs text-gray-500 w-12 text-right font-medium text-gray-700">
                              {(part.quantity * part.unitCost).toFixed(2)} L
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditableParts(prev => prev.map((p, i) =>
                                i === index ? { ...p, isDeleted: true } : p
                              ))}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                              title="Elimină piesa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {/* Total piese */}
                    {editableParts.filter(p => !p.isDeleted).length > 0 && (
                      <div className="flex justify-end pt-1">
                        <span className="text-sm font-semibold text-gray-700">
                          Total piese: {editableParts
                            .filter(p => !p.isDeleted)
                            .reduce((sum, p) => sum + p.quantity * p.unitCost, 0)
                            .toFixed(2)} Lei
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Buton adaugă piesă nouă */}
                <button
                  type="button"
                  onClick={() => setShowPartsModal(true)}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Adaugă Piesă din Inventar
                </button>
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
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/work-orders')}
              className="btn-secondary"
              disabled={saveMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary inline-flex items-center"
              disabled={saveMutation.isPending || uploadingImage}
            >
              {saveMutation.isPending || uploadingImage ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">{uploadingImage ? 'Se încarcă imaginea...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  {isEditing ? 'Update Work Order' : 'Create Work Order'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>

    {/* Parts Modal - outside form to prevent submit on close */}
    {showPartsModal && (
      <PartsUsageModal
        workOrderId={id}
        equipmentId={workOrder?.equipment_id || null}
        onClose={() => setShowPartsModal(false)}
        onSave={(newParts) => {
          setEditableParts(prev => [
            ...prev,
            ...newParts.map(p => ({
              usageId: null, // nou, fără ID în DB încă
              partId: p.partId,
              name: p.partName,
              unit: p.unitOfMeasure,
              stockAvailable: p.maxStock,
              quantity: p.quantity,
              unitCost: p.unitCost,
              notes: '',
              isDeleted: false,
            }))
          ])
          setShowPartsModal(false)
        }}
      />
    )}
  </>
  )
}
