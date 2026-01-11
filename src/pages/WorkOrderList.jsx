import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle, 
  Clock,
  CheckCircle,
  XCircle,
  Wrench,
  Calendar,
  Edit,
  Trash2,
  Play,
  Pause
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import WorkOrderCompletionModal from '../components/WorkOrderCompletionModal'

export default function WorkOrderList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('open') // Default: Open tab
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('corrective') // Default: doar work orders normale
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [viewingImage, setViewingImage] = useState(null)

  // Set initial status filter from URL query parameter
  useEffect(() => {
    const statusParam = searchParams.get('status')
    if (statusParam && ['all', 'open', 'in_progress', 'on_hold', 'completed', 'cancelled'].includes(statusParam)) {
      setStatusFilter(statusParam)
    }
  }, [searchParams])

  // Fetch work orders with equipment and location info
  const { data: workOrders, isLoading } = useQuery({
    queryKey: ['work-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          equipment:equipment(id, name, serial_number),
          location:locations(id, name, building, floor, room),
          assigned_to_user:profiles!work_orders_assigned_to_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
  })

  // Start work mutation (open/on_hold → in_progress)
  const startWorkMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: 'in_progress' })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['work-orders'])
      // Schimbă automat tab-ul la "In Progress" după start
      setStatusFilter('in_progress')
    },
  })

  // Cancel work order mutation (schimbă status la cancelled în loc să șteargă din DB)
  const cancelMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: 'cancelled' })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['work-orders'])
      // Schimbă automat tab-ul la "Cancelled" pentru a vedea work order-ul anulat
      setStatusFilter('cancelled')
    },
  })

  // Restore work order mutation (cancelled → open)
  const restoreMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: 'open' })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['work-orders'])
      // Schimbă automat tab-ul la "Open" pentru a vedea work order-ul restaurat
      setStatusFilter('open')
    },
  })

  // Filter work orders
  const filteredWorkOrders = workOrders?.filter((wo) => {
    const matchesSearch = 
      wo.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.equipment?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.location?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.location?.building?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || wo.priority === priorityFilter
    const matchesType = typeFilter === 'all' || wo.type === typeFilter

    return matchesSearch && matchesStatus && matchesPriority && matchesType
  })

  // Count by status - only for work orders matching the type filter
  const statusCounts = workOrders?.reduce((acc, wo) => {
    // Only count work orders that match the type filter
    if (typeFilter === 'all' || wo.type === typeFilter) {
      acc[wo.status] = (acc[wo.status] || 0) + 1
    }
    return acc
  }, {}) || {}

  // Calculate total count for the type filter
  const totalCount = workOrders?.filter(wo => typeFilter === 'all' || wo.type === typeFilter).length || 0

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <Clock className="w-5 h-5 text-blue-600" />
      case 'in_progress':
        return <Wrench className="w-5 h-5 text-yellow-600" />
      case 'on_hold':
        return <XCircle className="w-5 h-5 text-gray-600" />
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />
      default:
        return <Clock className="w-5 h-5 text-gray-600" />
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

  const getPriorityIcon = (priority) => {
    if (priority === 'critical' || priority === 'high') {
      return <AlertTriangle className="w-4 h-4" />
    }
    return null
  }

  const getTypeBadge = (type) => {
    switch (type) {
      case 'corrective':
        return 'badge-danger' // Roșu - probleme/erori
      case 'preventive':
        return 'badge-success' // Verde - mentenanță preventivă
      case 'inspection':
        return 'badge-info' // Albastru - inspecții
      default:
        return 'badge-secondary'
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'corrective':
        return <AlertTriangle className="w-4 h-4" />
      case 'preventive':
        return <Calendar className="w-4 h-4" />
      case 'inspection':
        return <Search className="w-4 h-4" />
      default:
        return null
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'corrective':
        return 'Raportare'
      case 'preventive':
        return 'Mentenanță'
      case 'inspection':
        return 'Inspecție'
      default:
        return type
    }
  }

  // Extract image URL from description or image_url field
  const extractImageUrl = (wo) => {
    // First check if there's an image_url field directly
    if (wo.image_url) {
      return wo.image_url
    }
    
    // Then check description for "Poza: URL" pattern
    if (wo.description) {
      const match = wo.description.match(/Poza:\s*(https?:\/\/[^\s]+)/i)
      if (match && match[1]) {
        return match[1]
      }
    }
    
    return null
  }

  // Get description without the image URL
  const getDescriptionWithoutImage = (description) => {
    if (!description) return ''
    
    // Remove the "Poza: URL" part from description
    return description.replace(/\n\nPoza:\s*https?:\/\/[^\s]+/i, '').trim()
  }

  // Get card color classes based on priority and status
  const getCardClasses = (wo) => {
    // Completed and cancelled work orders - neutral gray
    if (wo.status === 'completed') {
      return 'card bg-green-50 border-green-200'
    }
    if (wo.status === 'cancelled') {
      return 'card bg-gray-50 border-gray-300'
    }
    
    // Color based on priority for active work orders
    switch (wo.priority) {
      case 'critical':
        return 'card bg-red-50 border-red-300 border-2'
      case 'high':
        return 'card bg-orange-50 border-orange-300 border-2'
      case 'medium':
        return 'card bg-blue-50 border-blue-200'
      case 'low':
        return 'card bg-gray-50 border-gray-200'
      default:
        return 'card'
    }
  }

  // Get icon background color
  const getIconBgColor = (wo) => {
    if (wo.status === 'completed') return 'bg-green-200'
    if (wo.status === 'cancelled') return 'bg-gray-200'
    
    switch (wo.priority) {
      case 'critical':
        return 'bg-red-200'
      case 'high':
        return 'bg-orange-200'
      case 'medium':
        return 'bg-blue-200'
      case 'low':
        return 'bg-gray-200'
      default:
        return 'bg-gray-200'
    }
  }

  // Get icon text color
  const getIconTextColor = (wo) => {
    if (wo.status === 'completed') return 'text-green-700'
    if (wo.status === 'cancelled') return 'text-gray-600'
    
    switch (wo.priority) {
      case 'critical':
        return 'text-red-700'
      case 'high':
        return 'text-orange-700'
      case 'medium':
        return 'text-blue-700'
      case 'low':
        return 'text-gray-600'
      default:
        return 'text-gray-600'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-gray-600 mt-1">
            Manage maintenance requests and tasks
          </p>
        </div>
        <Link
          to="/work-orders/new"
          className="btn-primary mt-4 sm:mt-0 inline-flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Work Order
        </Link>
      </div>

      {/* Interactive Filter Cards */}
      <div className="overflow-x-auto pb-2 mb-6">
        <div className="flex gap-3 min-w-max">
          {/* All */}
          <button
            onClick={() => setStatusFilter('all')}
            className={`card p-4 min-w-[180px] transition-all cursor-pointer ${
              statusFilter === 'all' 
                ? 'bg-gray-100 border-gray-400 border-2 ring-2 ring-gray-300' 
                : 'bg-gray-50 border-gray-200 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">All Orders</p>
                <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
              </div>
              <Filter className="w-8 h-8 text-gray-600 opacity-50" />
            </div>
          </button>

          {/* Open */}
          <button
            onClick={() => setStatusFilter('open')}
            className={`card p-4 min-w-[180px] transition-all cursor-pointer ${
              statusFilter === 'open' 
                ? 'bg-blue-100 border-blue-400 border-2 ring-2 ring-blue-300' 
                : 'bg-blue-50 border-blue-200 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Open</p>
                <p className="text-2xl font-bold text-blue-900">{statusCounts.open || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-600 opacity-50" />
            </div>
          </button>

          {/* In Progress */}
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`card p-4 min-w-[180px] transition-all cursor-pointer ${
              statusFilter === 'in_progress' 
                ? 'bg-yellow-100 border-yellow-400 border-2 ring-2 ring-yellow-300' 
                : 'bg-yellow-50 border-yellow-200 hover:border-yellow-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-yellow-600 font-medium">In Progress</p>
                <p className="text-2xl font-bold text-yellow-900">{statusCounts.in_progress || 0}</p>
              </div>
              <Wrench className="w-8 h-8 text-yellow-600 opacity-50" />
            </div>
          </button>

          {/* On Hold */}
          <button
            onClick={() => setStatusFilter('on_hold')}
            className={`card p-4 min-w-[180px] transition-all cursor-pointer ${
              statusFilter === 'on_hold' 
                ? 'bg-gray-100 border-gray-400 border-2 ring-2 ring-gray-300' 
                : 'bg-gray-50 border-gray-200 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium">On Hold</p>
                <p className="text-2xl font-bold text-gray-900">{statusCounts.on_hold || 0}</p>
              </div>
              <XCircle className="w-8 h-8 text-gray-600 opacity-50" />
            </div>
          </button>

          {/* Completed */}
          <button
            onClick={() => setStatusFilter('completed')}
            className={`card p-4 min-w-[180px] transition-all cursor-pointer ${
              statusFilter === 'completed' 
                ? 'bg-green-100 border-green-400 border-2 ring-2 ring-green-300' 
                : 'bg-green-50 border-green-200 hover:border-green-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">Completed</p>
                <p className="text-2xl font-bold text-green-900">{statusCounts.completed || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600 opacity-50" />
            </div>
          </button>

          {/* Cancelled */}
          <button
            onClick={() => setStatusFilter('cancelled')}
            className={`card p-4 min-w-[180px] transition-all cursor-pointer ${
              statusFilter === 'cancelled' 
                ? 'bg-red-100 border-red-400 border-2 ring-2 ring-red-300' 
                : 'bg-red-50 border-red-200 hover:border-red-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium">Cancelled</p>
                <p className="text-2xl font-bold text-red-900">{statusCounts.cancelled || 0}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600 opacity-50" />
            </div>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search work orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Priority Filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <AlertTriangle className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="input pl-10"
            >
              <option value="all">All Priority</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input pl-10"
            >
              <option value="corrective">Doar Raportări</option>
              <option value="preventive">Doar Mentenanță Preventivă</option>
              <option value="inspection">Doar Inspecții</option>
              <option value="all">Toate Tipurile</option>
            </select>
          </div>
        </div>
      </div>

      {/* Work Orders List */}
      {!filteredWorkOrders || filteredWorkOrders.length === 0 ? (
        <div className="card text-center py-12">
          <Wrench className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'corrective'
              ? 'Nu s-au găsit work orders' 
              : 'Niciun work order încă'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'corrective'
              ? 'Încearcă să ajustezi filtrele'
              : 'Creează primul work order pentru a începe'}
          </p>
          {!searchTerm && statusFilter === 'open' && priorityFilter === 'all' && typeFilter === 'corrective' && (
            <Link to="/work-orders/new" className="btn-primary inline-flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              Work Order Nou
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWorkOrders.map((wo) => (
            <div
              key={wo.id}
              className={getCardClasses(wo)}
            >
              {/* Flex column pe mobil, row pe desktop */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                {/* Content - flex-1 pentru a ocupa spațiul disponibil */}
                <div className="flex-1">
                  <div className="flex items-start space-x-4">
                    {/* Icon colorat cu background */}
                    <div className={`p-2 rounded-lg ${getIconBgColor(wo)}`}>
                      <Wrench className={`w-6 h-6 ${getIconTextColor(wo)}`} />
                    </div>

                    <div className="flex-1">
                      {/* Title cu link */}
                      <Link
                        to={`/work-orders/${wo.id}`}
                        className="text-lg font-semibold text-gray-900 hover:text-primary-600 mb-2 inline-block"
                      >
                        {wo.title}
                      </Link>

                      {/* Equipment */}
                      {wo.equipment && (
                        <p className="text-sm text-gray-600 mb-1">
                          Equipment: <span className="font-medium">{wo.equipment.name}</span>
                          {wo.equipment.serial_number && ` (SN: ${wo.equipment.serial_number})`}
                        </p>
                      )}

                      {/* Location */}
                      {wo.location && (
                        <p className="text-sm text-gray-600 mb-2">
                          Location: <span className="font-medium">{wo.location.name}</span>
                          {wo.location.building && ` - ${wo.location.building}`}
                          {wo.location.floor && ` (Floor ${wo.location.floor})`}
                        </p>
                      )}

                      {/* Description */}
                      {wo.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {getDescriptionWithoutImage(wo.description)}
                        </p>
                      )}

                      {/* Image Thumbnail - dacă există imagine atașată */}
                      {extractImageUrl(wo) && (
                        <div className="mb-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setViewingImage(extractImageUrl(wo))
                              setImageViewerOpen(true)
                            }}
                            className="relative group"
                          >
                            <img
                              src={extractImageUrl(wo)}
                              alt="Issue photo"
                              className="h-24 w-24 object-cover rounded-lg border-2 border-gray-200 hover:border-primary-500 transition-all"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition-all flex items-center justify-center">
                              <Search className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                          <p className="text-xs text-gray-500 mt-1">Click pentru a vizualiza</p>
                        </div>
                      )}

                      {/* Badges and Meta */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`badge ${getStatusBadge(wo.status)} capitalize`}>
                          {wo.status.replace('_', ' ')}
                        </span>
                        <span className={`badge ${getPriorityBadge(wo.priority)} capitalize inline-flex items-center`}>
                          {getPriorityIcon(wo.priority)}
                          <span className={getPriorityIcon(wo.priority) ? 'ml-1' : ''}>
                            {wo.priority}
                          </span>
                        </span>
                        {wo.type && (
                          <span className={`badge ${getTypeBadge(wo.type)} capitalize inline-flex items-center`}>
                            {getTypeIcon(wo.type)}
                            <span className={getTypeIcon(wo.type) ? 'ml-1' : ''}>
                              {getTypeLabel(wo.type)}
                            </span>
                          </span>
                        )}
                        {wo.assigned_to_user && (
                          <span className="text-sm text-gray-600">
                            Assigned: <span className="font-medium">{wo.assigned_to_user.full_name}</span>
                          </span>
                        )}
                        <span className="text-sm text-gray-500 flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(wo.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons - row pe mobil (jos), col pe desktop (lateral) */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-end gap-2 pt-4 md:pt-0 mt-4 md:mt-0 border-t md:border-t-0 border-gray-200 md:ml-4">
                  {/* Start Work Button - pentru open și on_hold */}
                  {(wo.status === 'open' || wo.status === 'on_hold') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        startWorkMutation.mutate(wo.id)
                      }}
                      disabled={startWorkMutation.isLoading}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Start Work"
                    >
                      <Play className="w-5 h-5" />
                    </button>
                  )}

                  {/* Complete Work Order Button - doar pentru in_progress */}
                  {wo.status === 'in_progress' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedWorkOrder(wo)
                        setShowCompletionModal(true)
                      }}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Complete Work Order"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  )}

                  {/* Restore Button - doar pentru cancelled */}
                  {wo.status === 'cancelled' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm('Restaurezi acest work order? Va fi mutat înapoi în tab-ul "Open".')) {
                          restoreMutation.mutate(wo.id)
                        }
                      }}
                      disabled={restoreMutation.isLoading}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Restore Work Order"
                    >
                      <Play className="w-5 h-5 rotate-180" />
                    </button>
                  )}

                  {/* Edit Button - doar pentru work orders nefinalizate */}
                  {wo.status !== 'completed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/work-orders/${wo.id}/edit`)
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                  )}

                  {/* Cancel Button - doar pentru work orders nefinalizate și neanulate */}
                  {wo.status !== 'completed' && wo.status !== 'cancelled' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm('Anulezi acest work order? Îl poți găsi mai târziu în tab-ul "Cancelled".')) {
                          cancelMutation.mutate(wo.id)
                        }
                      }}
                      disabled={cancelMutation.isLoading}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Cancel Work Order"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completion Modal */}
      {showCompletionModal && selectedWorkOrder && (
        <WorkOrderCompletionModal
          workOrder={selectedWorkOrder}
          onClose={() => {
            setShowCompletionModal(false)
            setSelectedWorkOrder(null)
          }}
        />
      )}

      {/* Image Viewer Modal */}
      {imageViewerOpen && viewingImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setImageViewerOpen(false)}
        >
          <button
            onClick={() => setImageViewerOpen(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
          >
            <XCircle className="w-8 h-8" />
          </button>
          <div className="max-w-5xl max-h-full">
            <img
              src={viewingImage}
              alt="Work order issue"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white text-center mt-4 text-sm">
              Click oriunde pentru a închide
            </p>
          </div>
        </div>
      )}
    </div>
  )
}