import { useState } from 'react'
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
  Save
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function WorkOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const [showCompletionForm, setShowCompletionForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [newAssignedTo, setNewAssignedTo] = useState('')
  const [completionData, setCompletionData] = useState({
    completed_by: '',
    parts_replaced: '',
    parts_cost: '',
    labor_cost: '',
    actual_hours: '',
    completion_notes: ''
  })

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
          console.error('❌ Notification error:', err)
        }
      }
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ newStatus, completionDetails }) => {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] })
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      setShowCompletionForm(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      navigate('/work-orders')
    },
  })

  const handleDelete = () => {
    if (window.confirm('Sigur doriți să ștergeți această comandă de lucru? Această acțiune nu poate fi anulată.')) {
      deleteMutation.mutate()
    }
  }

  const handleCompletionSubmit = (e) => {
    e.preventDefault()
    updateStatusMutation.mutate({ 
      newStatus: 'completed', 
      completionDetails: completionData 
    })
  }

  const handleCompletionChange = (e) => {
    setCompletionData({
      ...completionData,
      [e.target.name]: e.target.value
    })
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
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/work-orders')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Work Orders
        </button>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
            <div className="flex-shrink-0">
              {getStatusIcon(workOrder.status)}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{workOrder.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
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
          <div className="flex gap-2 flex-shrink-0">
            {(profile?.role === 'admin' || profile?.role === 'manager') && (
              <button
                onClick={() => {
                  setNewAssignedTo(workOrder.assigned_to || '')
                  setShowReassignModal(true)
                }}
                className="btn-secondary inline-flex items-center justify-center whitespace-nowrap"
              >
                <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Reasignează
              </button>
            )}
            <Link
              to={`/work-orders/${id}/edit`}
              className="btn-primary inline-flex items-center justify-center whitespace-nowrap"
            >
              <Edit className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Edit
            </Link>
            {profile?.role === 'admin' && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isLoading}
                className="btn-secondary inline-flex items-center justify-center whitespace-nowrap text-red-600 hover:bg-red-50 hover:border-red-300"
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
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Description */}
          <div className="card">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap break-words">
              {workOrder.description || 'No description provided'}
            </p>
          </div>

          {/* Issue Image */}
          {workOrder.image_url && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Fotografie Problemă</h2>
              <img 
                src={workOrder.image_url} 
                alt="Issue photo" 
                className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(workOrder.image_url, '_blank')}
              />
              <p className="text-sm text-gray-500 mt-2">
                Click pe imagine pentru a vedea în dimensiune completă
              </p>
            </div>
          )}

          {/* Equipment Info */}
          {workOrder.equipment && (
            <div className="card">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Equipment</h2>
              <Link
                to={`/equipment/${workOrder.equipment.id}`}
                className="flex items-start space-x-3 sm:space-x-4 p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Wrench className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600 mt-1 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 break-words">{workOrder.equipment.name}</p>
                  {workOrder.equipment.serial_number && (
                    <p className="text-sm text-gray-600 break-all">SN: {workOrder.equipment.serial_number}</p>
                  )}
                  {workOrder.equipment.location && (
                    <p className="text-sm text-gray-600 flex items-center mt-1 flex-wrap">
                      <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
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
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Location</h2>
              <Link
                to={`/locations/${workOrder.location.id}`}
                className="flex items-start space-x-3 sm:space-x-4 p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <MapPin className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600 mt-1 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 break-words">{workOrder.location.name}</p>
                  {workOrder.location.building && (
                    <p className="text-sm text-gray-600">Building: {workOrder.location.building}</p>
                  )}
                  {workOrder.location.floor && (
                    <p className="text-sm text-gray-600">Floor: {workOrder.location.floor}</p>
                  )}
                  {workOrder.location.room && (
                    <p className="text-sm text-gray-600">Room: {workOrder.location.room}</p>
                  )}
                  {workOrder.location.address && (
                    <p className="text-sm text-gray-600 mt-1 break-words">{workOrder.location.address}</p>
                  )}
                </div>
              </Link>
            </div>
          )}

          {/* Comments Section */}
          <div className="card">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Activity</h2>
            {!comments || comments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No comments yet</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex space-x-3">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {comment.user?.full_name || 'Unknown User'}
                        </p>
                        <span className="text-sm text-gray-500">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-700 mt-1 break-words">{comment.comment}</p>
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
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
                Detalii Finalizare
              </h2>
              
              <div className="space-y-4">
                {workOrder.completed_by && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <User className="w-4 h-4 mr-1" />
                      Finalizat De
                    </label>
                    <p className="text-gray-900 font-medium">{workOrder.completed_by}</p>
                  </div>
                )}

                {workOrder.parts_replaced && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Wrench className="w-4 h-4 mr-1" />
                      Piese Înlocuite
                    </label>
                    <p className="text-gray-900 whitespace-pre-wrap">{workOrder.parts_replaced}</p>
                  </div>
                )}

                {(workOrder.parts_cost || workOrder.labor_cost) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workOrder.parts_cost > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                          <Wrench className="w-4 h-4 mr-1 flex-shrink-0" />
                          Cost Piese
                        </label>
                        <p className="text-xl font-bold text-gray-900">
                          {parseFloat(workOrder.parts_cost).toFixed(2)} Lei
                        </p>
                      </div>
                    )}

                    {workOrder.labor_cost > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                          <User className="w-4 h-4 mr-1 flex-shrink-0" />
                          Cost Manoperă
                        </label>
                        <p className="text-xl font-bold text-gray-900">
                          {parseFloat(workOrder.labor_cost).toFixed(2)} Lei
                        </p>
                      </div>
                    )}

                    {(workOrder.parts_cost > 0 || workOrder.labor_cost > 0) && (
                      <div className="bg-green-100 p-3 rounded-lg sm:col-span-2 lg:col-span-1">
                        <label className="block text-sm font-medium text-green-700 mb-1">
                          Cost Total
                        </label>
                        <p className="text-2xl font-bold text-green-600">
                          {(parseFloat(workOrder.parts_cost || 0) + parseFloat(workOrder.labor_cost || 0)).toFixed(2)} Lei
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {workOrder.actual_hours && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <Clock className="w-4 h-4 mr-1 flex-shrink-0" />
                        Timp Lucrat
                      </label>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900">
                        {workOrder.actual_hours}h
                      </p>
                    </div>
                  )}
                </div>

                {workOrder.completion_notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <FileText className="w-4 h-4 mr-1" />
                      Note
                    </label>
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <p className="text-gray-900 whitespace-pre-wrap">{workOrder.completion_notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          {/* Quick Actions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {workOrder.status === 'open' && (
                <button
                  onClick={() => updateStatusMutation.mutate({ newStatus: 'in_progress' })}
                  className="btn-primary w-full"
                  disabled={updateStatusMutation.isLoading}
                >
                  Începe Lucrul
                </button>
              )}
              {workOrder.status === 'in_progress' && (
                <>
                  <button
                    onClick={() => setShowCompletionForm(true)}
                    className="btn-primary w-full bg-green-600 hover:bg-green-700"
                    disabled={updateStatusMutation.isLoading}
                  >
                    <CheckCircle className="w-4 h-4 mr-2 inline" />
                    Marchează Complet
                  </button>
                  <button
                    onClick={() => updateStatusMutation.mutate({ newStatus: 'on_hold' })}
                    className="btn-secondary w-full"
                    disabled={updateStatusMutation.isLoading}
                  >
                    Pune în Așteptare
                  </button>
                </>
              )}
              {workOrder.status === 'on_hold' && (
                <button
                  onClick={() => updateStatusMutation.mutate({ newStatus: 'in_progress' })}
                  className="btn-primary w-full"
                  disabled={updateStatusMutation.isLoading}
                >
                  Reia Lucrul
                </button>
              )}
              {workOrder.status !== 'cancelled' && workOrder.status !== 'completed' && (
                <button
                  onClick={() => updateStatusMutation.mutate({ newStatus: 'cancelled' })}
                  className="btn-secondary w-full text-red-600 hover:bg-red-50"
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
                      <p className="text-xs text-gray-500 mt-1">
                        Listează toate piesele care au fost înlocuite sau folosite
                      </p>
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
                        disabled={updateStatusMutation.isLoading}
                      >
                        Anulează
                      </button>
                      <button
                        type="submit"
                        className="btn-primary inline-flex items-center justify-center bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                        disabled={updateStatusMutation.isLoading}
                      >
                        {updateStatusMutation.isLoading ? (
                          <>
                            <LoadingSpinner size="sm" />
                            <span className="ml-2">Finalizare...</span>
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
                </div>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Detalii</h3>
            <dl className="space-y-3">
              {workOrder.assigned_to_user && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    Asignat Către
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {workOrder.assigned_to_user.full_name}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Creat
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(workOrder.created_at).toLocaleString()}
                </dd>
              </div>

              {workOrder.created_by_user ? (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Creat De</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {workOrder.created_by_user.full_name}
                  </dd>
                </div>
              ) : (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Creat De</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      Raport Public
                    </span>
                  </dd>
                </div>
              )}

              {workOrder.scheduled_date && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Programat
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(workOrder.scheduled_date).toLocaleDateString()}
                  </dd>
                </div>
              )}

              {workOrder.completed_date && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Finalizat
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(workOrder.completed_date).toLocaleDateString()}
                  </dd>
                </div>
              )}

              {workOrder.estimated_hours && (
                <div>
                  <dt className="text-sm font-medium text-gray-500 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    Ore Estimate
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {workOrder.estimated_hours}h
                  </dd>
                </div>
              )}

              {workOrder.actual_hours && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Ore Lucrate</dt>
                  <dd className="mt-1 text-sm text-gray-900">
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
    </div>
  )
}
