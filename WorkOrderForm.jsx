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
  MapPin
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

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
    }
  }, [workOrder])

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      let workOrderId = id
      let wasAssigned = false
      let assignedUserId = null
      let workOrderData = null
      
      if (isEditing) {
        // Check if assigned_to changed
        const oldAssignedTo = workOrder?.assigned_to
        const newAssignedTo = data.assigned_to
        wasAssigned = newAssignedTo && newAssignedTo !== oldAssignedTo
        assignedUserId = newAssignedTo
        
        const { error } = await supabase
          .from('work_orders')
          .update(data)
          .eq('id', id)
        if (error) throw error
        
        workOrderData = { ...workOrder, ...data }
      } else {
        const { data: newWO, error } = await supabase
          .from('work_orders')
          .insert({ ...data, created_by: user.id })
          .select()
          .single()
        if (error) throw error
        
        workOrderId = newWO.id
        wasAssigned = !!data.assigned_to
        assignedUserId = data.assigned_to
        workOrderData = newWO
      }
      
      // Send push notification
      if (wasAssigned && assignedUserId) {
        // Specific assignment - notify only assigned user
        try {
          const { data: assignedUser } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', assignedUserId)
            .single()
          
          if (assignedUser) {
            await notifyWorkOrderAssigned(workOrderData, assignedUser)
          }
        } catch (err) {
          console.error('Notification error:', err)
        }
      } else if (!isEditing && !assignedUserId) {
        // New work order without assignment - notify all admins & technicians
        try {
          const { data: users } = await supabase
            .from('profiles')
            .select('*')
            .in('role', ['admin', 'technician'])
          
          if (users && users.length > 0) {
            // Notify all
            await Promise.all(
              users.map(u => notifyWorkOrderAssigned(workOrderData, u))
            )
          }
        } catch (err) {
          console.error('Notification error:', err)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] })
      navigate('/work-orders')
    },
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
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

    saveMutation.mutate(dataToSave)
  }

  if (isEditing && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
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

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/work-orders')}
              className="btn-secondary"
              disabled={saveMutation.isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary inline-flex items-center"
              disabled={saveMutation.isLoading}
            >
              {saveMutation.isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Saving...</span>
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
  )
}
