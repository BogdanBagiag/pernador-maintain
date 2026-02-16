import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { AlertTriangle, Clock, CheckCircle, XCircle, Pause, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function WorkOrdersStatusDashboard() {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(true)

  const { data: workOrders, isLoading } = useQuery({
    queryKey: ['work-orders-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          id,
          title,
          status,
          priority,
          type,
          due_date,
          equipment:equipment(id, name),
          assigned_to_user:profiles!work_orders_assigned_to_fkey(id, full_name)
        `)
        .neq('type', 'preventive')
        .order('priority', { ascending: false })
      
      if (error) throw error
      return data
    },
    refetchInterval: 60000,
  })

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6 mb-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (!workOrders || workOrders.length === 0) return null

  const statusGroups = {
    open: workOrders.filter(wo => wo.status === 'open'),
    in_progress: workOrders.filter(wo => wo.status === 'in_progress'),
    on_hold: workOrders.filter(wo => wo.status === 'on_hold'),
    completed: workOrders.filter(wo => wo.status === 'completed'),
    cancelled: workOrders.filter(wo => wo.status === 'cancelled'),
  }

  const criticalOpen = statusGroups.open.filter(wo => wo.priority === 'critical')
  const highOpen = statusGroups.open.filter(wo => wo.priority === 'high')
  const overdue = workOrders.filter(wo => 
    wo.due_date && 
    new Date(wo.due_date) < new Date() && 
    wo.status !== 'completed' && 
    wo.status !== 'cancelled'
  )

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <Clock className="w-4 h-4" />
      case 'in_progress': return <AlertTriangle className="w-4 h-4" />
      case 'on_hold': return <Pause className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  return (
    <div className="bg-white shadow rounded-lg mb-6">
      {/* Header */}
      <div 
        className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Raport Status Work Orders</h2>
            <p className="text-sm text-gray-500 mt-1">
              {overdue.length > 0 && (
                <span className="text-red-600 font-medium">
                  {overdue.length} overdue
                </span>
              )}
              {overdue.length > 0 && criticalOpen.length > 0 && ' • '}
              {criticalOpen.length > 0 && (
                <span className="text-red-600 font-medium">
                  {criticalOpen.length} critical
                </span>
              )}
              {(overdue.length > 0 || criticalOpen.length > 0) && statusGroups.in_progress.length > 0 && ' • '}
              {statusGroups.in_progress.length > 0 && (
                <span className="text-blue-600 font-medium">
                  {statusGroups.in_progress.length} în lucru
                </span>
              )}
              {overdue.length === 0 && criticalOpen.length === 0 && statusGroups.in_progress.length === 0 && (
                <span className="text-green-600 font-medium">Tot sub control</span>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-red-600">{criticalOpen.length}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-5 h-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-600">{statusGroups.open.length}</span>
              </div>
              <div className="flex items-center space-x-1">
                <AlertTriangle className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">{statusGroups.in_progress.length}</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-600">{statusGroups.completed.length}</span>
              </div>
            </div>
            {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-6">
          {/* Overdue */}
          {overdue.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-red-900 mb-3 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Overdue ({overdue.length})
              </h3>
              <div className="space-y-2">
                {overdue.map((wo) => (
                  <Link
                    key={wo.id}
                    to={`/work-orders/${wo.id}`}
                    className="block border border-red-200 rounded-lg p-4 hover:border-red-300 hover:bg-red-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">{wo.title}</h4>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(wo.priority)}`}>
                            {wo.priority}
                          </span>
                        </div>
                        {wo.equipment && (
                          <p className="text-sm text-gray-500 mt-1">{wo.equipment.name}</p>
                        )}
                        <p className="text-xs text-red-600 mt-1">
                          Due: {new Date(wo.due_date).toLocaleDateString('ro-RO')}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Critical Open */}
          {criticalOpen.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-red-900 mb-3 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Critical Open ({criticalOpen.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {criticalOpen.map((wo) => (
                  <Link
                    key={wo.id}
                    to={`/work-orders/${wo.id}`}
                    className="border border-red-200 rounded-lg p-3 hover:border-red-300 hover:bg-red-50 transition-colors"
                  >
                    <h4 className="font-medium text-gray-900 text-sm">{wo.title}</h4>
                    {wo.equipment && (
                      <p className="text-xs text-gray-500 mt-1">{wo.equipment.name}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* In Progress */}
          {statusGroups.in_progress.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                În Lucru ({statusGroups.in_progress.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {statusGroups.in_progress.map((wo) => (
                  <Link
                    key={wo.id}
                    to={`/work-orders/${wo.id}`}
                    className="border border-blue-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <h4 className="font-medium text-gray-900 text-sm">{wo.title}</h4>
                    {wo.equipment && (
                      <p className="text-xs text-gray-500 mt-1">{wo.equipment.name}</p>
                    )}
                    {wo.assigned_to_user && (
                      <p className="text-xs text-blue-600 mt-1">{wo.assigned_to_user.full_name}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Open */}
          {statusGroups.open.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-orange-900 mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Open ({statusGroups.open.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {statusGroups.open.map((wo) => (
                  <Link
                    key={wo.id}
                    to={`/work-orders/${wo.id}`}
                    className="border border-orange-200 rounded-lg p-3 hover:border-orange-300 hover:bg-orange-50 transition-colors"
                  >
                    <h4 className="font-medium text-gray-900 text-xs">{wo.title}</h4>
                    {wo.equipment && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{wo.equipment.name}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* On Hold */}
          {statusGroups.on_hold.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <Pause className="w-4 h-4 mr-2" />
                On Hold ({statusGroups.on_hold.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {statusGroups.on_hold.map((wo) => (
                  <Link
                    key={wo.id}
                    to={`/work-orders/${wo.id}`}
                    className="border border-gray-300 rounded-lg p-3 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    <h4 className="font-medium text-gray-900 text-xs">{wo.title}</h4>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
