import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
  Calendar
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function WorkOrderList() {
  const [searchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  // Set initial status filter from URL query parameter
  useEffect(() => {
    const statusParam = searchParams.get('status')
    if (statusParam && ['all', 'open', 'in_progress', 'on_hold', 'completed', 'cancelled'].includes(statusParam)) {
      setStatusFilter(statusParam)
    }
    
    const typeParam = searchParams.get('type')
    if (typeParam && ['all', 'corrective', 'preventive', 'inspection'].includes(typeParam)) {
      setTypeFilter(typeParam)
    }
  }, [searchParams])

  // Fetch work orders with equipment and location info (exclude preventive maintenance generated ones)
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
        .neq('type', 'preventive')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
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

  // Count by status
  const statusCounts = workOrders?.reduce((acc, wo) => {
    acc[wo.status] = (acc[wo.status] || 0) + 1
    return acc
  }, {}) || {}

  // Determine card color based on priority and status
  const getCardClass = (wo) => {
    // Completed - Verde
    if (wo.status === 'completed') {
      return 'card bg-green-50 border-green-200'
    }
    
    // Cancelled/On Hold - Gri
    if (wo.status === 'cancelled' || wo.status === 'on_hold') {
      return 'card bg-gray-50 border-gray-300'
    }
    
    // Active work orders (open/in_progress) - color by priority
    if (wo.status === 'open' || wo.status === 'in_progress') {
      switch (wo.priority) {
        case 'critical':
          return 'card bg-red-50 border-red-300 border-2'
        case 'high':
          return 'card bg-orange-50 border-orange-300 border-2'
        case 'medium':
          return 'card bg-yellow-50 border-yellow-300'
        case 'low':
          return 'card bg-blue-50 border-blue-300'
        default:
          return 'card'
      }
    }
    
    return 'card'
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <Clock className="w-6 h-6" />
      case 'in_progress':
        return <Wrench className="w-6 h-6" />
      case 'on_hold':
        return <XCircle className="w-6 h-6" />
      case 'completed':
        return <CheckCircle className="w-6 h-6" />
      case 'cancelled':
        return <XCircle className="w-6 h-6" />
      default:
        return <Clock className="w-6 h-6" />
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return 'badge-warning'
      case 'in_progress':
        return 'badge-info'
      case 'on_hold':
        return 'badge-secondary'
      case 'completed':
        return 'badge-success'
      case 'cancelled':
        return 'badge-danger'
      default:
        return 'badge-secondary'
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
        return 'badge-secondary'
    }
  }

  const getPriorityIcon = (priority) => {
    if (priority === 'critical' || priority === 'high') {
      return <AlertTriangle className="w-3 h-3" />
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-gray-600 mt-1">Manage maintenance requests and tasks</p>
        </div>
        <Link to="/work-orders/new" className="btn-primary inline-flex items-center">
          <Plus className="w-5 h-5 mr-2" />
          New Work Order
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* All Orders */}
        <div
          className={`cursor-pointer transition-all ${
            statusFilter === 'all'
              ? 'card bg-gray-100 border-gray-400 border-2'
              : 'card hover:bg-gray-50'
          }`}
        >
          <button
            onClick={() => setStatusFilter('all')}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">All Orders</p>
                <p className="text-2xl font-bold text-gray-900">{workOrders?.length || 0}</p>
              </div>
              <Filter className="w-8 h-8 text-gray-400 opacity-50" />
            </div>
          </button>
        </div>

        {/* Open */}
        <div
          className={`cursor-pointer transition-all ${
            statusFilter === 'open'
              ? 'card bg-blue-100 border-blue-400 border-2'
              : 'card hover:bg-blue-50'
          }`}
        >
          <button
            onClick={() => setStatusFilter('open')}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium mb-1">Open</p>
                <p className="text-2xl font-bold text-blue-900">{statusCounts.open || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-600 opacity-50" />
            </div>
          </button>
        </div>

        {/* In Progress */}
        <div
          className={`cursor-pointer transition-all ${
            statusFilter === 'in_progress'
              ? 'card bg-yellow-100 border-yellow-400 border-2'
              : 'card hover:bg-yellow-50'
          }`}
        >
          <button
            onClick={() => setStatusFilter('in_progress')}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-yellow-600 font-medium mb-1">In Progress</p>
                <p className="text-2xl font-bold text-yellow-900">{statusCounts.in_progress || 0}</p>
              </div>
              <Wrench className="w-8 h-8 text-yellow-600 opacity-50" />
            </div>
          </button>
        </div>

        {/* On Hold */}
        <div
          className={`cursor-pointer transition-all ${
            statusFilter === 'on_hold'
              ? 'card bg-gray-200 border-gray-400 border-2'
              : 'card hover:bg-gray-100'
          }`}
        >
          <button
            onClick={() => setStatusFilter('on_hold')}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">On Hold</p>
                <p className="text-2xl font-bold text-gray-900">{statusCounts.on_hold || 0}</p>
              </div>
              <XCircle className="w-8 h-8 text-gray-600 opacity-50" />
            </div>
          </button>
        </div>

        {/* Completed */}
        <div
          className={`cursor-pointer transition-all ${
            statusFilter === 'completed'
              ? 'card bg-green-100 border-green-400 border-2'
              : 'card hover:bg-green-50'
          }`}
        >
          <button
            onClick={() => setStatusFilter('completed')}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium mb-1">Completed</p>
                <p className="text-2xl font-bold text-green-900">{statusCounts.completed || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600 opacity-50" />
            </div>
          </button>
        </div>

        {/* Cancelled */}
        <div
          className={`cursor-pointer transition-all ${
            statusFilter === 'cancelled'
              ? 'card bg-red-100 border-red-400 border-2'
              : 'card hover:bg-red-50'
          }`}
        >
          <button
            onClick={() => setStatusFilter('cancelled')}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium mb-1">Cancelled</p>
                <p className="text-2xl font-bold text-red-900">{statusCounts.cancelled || 0}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600 opacity-50" />
            </div>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid md:grid-cols-2 gap-4">
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
        </div>
      </div>

      {/* Work Orders List */}
      {!filteredWorkOrders || filteredWorkOrders.length === 0 ? (
        <div className="card text-center py-12">
          <Wrench className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' 
              ? 'No work orders found' 
              : 'No work orders yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first work order to get started'}
          </p>
          {!searchTerm && statusFilter === 'all' && priorityFilter === 'all' && (
            <Link to="/work-orders/new" className="btn-primary inline-flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              New Work Order
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWorkOrders.map((wo) => (
            <Link
              key={wo.id}
              to={`/work-orders/${wo.id}`}
              className={`block ${getCardClass(wo)} hover:shadow-lg transition-all duration-200 hover:scale-[1.01]`}
            >
              <div className="flex items-start space-x-4">
                {/* Status Icon with colored background */}
                <div className={`flex-shrink-0 mt-1 p-2 rounded-lg ${
                  wo.status === 'completed' ? 'bg-green-200' :
                  wo.status === 'cancelled' || wo.status === 'on_hold' ? 'bg-gray-200' :
                  wo.priority === 'critical' ? 'bg-red-200' :
                  wo.priority === 'high' ? 'bg-orange-200' :
                  wo.priority === 'medium' ? 'bg-yellow-200' :
                  'bg-blue-200'
                }`}>
                  <div className={`${
                    wo.status === 'completed' ? 'text-green-700' :
                    wo.status === 'cancelled' || wo.status === 'on_hold' ? 'text-gray-600' :
                    wo.priority === 'critical' ? 'text-red-700' :
                    wo.priority === 'high' ? 'text-orange-700' :
                    wo.priority === 'medium' ? 'text-yellow-700' :
                    'text-blue-700'
                  }`}>
                    {getStatusIcon(wo.status)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title and Equipment/Location */}
                  <div className="mb-3">
                    <div className="flex items-start gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {wo.title}
                      </h3>
                      {/* Urgency Badge */}
                      {(wo.status === 'open' || wo.status === 'in_progress') && wo.priority === 'critical' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          URGENT
                        </span>
                      )}
                      {(wo.status === 'open' || wo.status === 'in_progress') && wo.priority === 'high' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          High Priority
                        </span>
                      )}
                    </div>
                    {wo.equipment && (
                      <p className="text-sm text-gray-600">
                        Equipment: <span className="font-medium">{wo.equipment.name}</span>
                        {wo.equipment.serial_number && ` (SN: ${wo.equipment.serial_number})`}
                      </p>
                    )}
                    {wo.location && (
                      <p className="text-sm text-gray-600">
                        Location: <span className="font-medium">{wo.location.name}</span>
                        {wo.location.building && ` - ${wo.location.building}`}
                        {wo.location.floor && ` (Floor ${wo.location.floor})`}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  {wo.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {wo.description}
                    </p>
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
                      <span className="badge badge-secondary capitalize">
                        {wo.type}
                      </span>
                    )}
                    {wo.assigned_to_user && (
                      <span className="text-sm text-gray-600">
                        Assigned to: <span className="font-medium">{wo.assigned_to_user.full_name}</span>
                      </span>
                    )}
                    <span className="text-sm text-gray-500 flex items-center ml-auto">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(wo.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
