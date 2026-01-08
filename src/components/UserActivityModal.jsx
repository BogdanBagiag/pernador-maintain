import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { 
  X, 
  ClipboardList, 
  AlertCircle, 
  Calendar,
  User,
  Mail,
  Shield,
  Clock,
  CheckCircle,
  FileText
} from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'

export default function UserActivityModal({ userData, onClose }) {
  const [activeTab, setActiveTab] = useState('overview') // overview, work-orders, reports

  // Fetch user's work orders (created by them)
  const { data: createdWorkOrders } = useQuery({
    queryKey: ['user-work-orders-created', userData.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          equipment:equipment(name),
          location:locations(name),
          assigned_user:profiles!work_orders_assigned_to_fkey(full_name)
        `)
        .eq('created_by', userData.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data
    }
  })

  // Fetch work orders assigned to them
  const { data: assignedWorkOrders } = useQuery({
    queryKey: ['user-work-orders-assigned', userData.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          equipment:equipment(name),
          location:locations(name),
          creator:profiles!work_orders_created_by_fkey(full_name)
        `)
        .eq('assigned_to', userData.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data
    }
  })

  // Fetch user's reported issues (if they used public forms)
  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['user-reports', userData.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          equipment:equipment(name),
          location:locations(name)
        `)
        .eq('reporter_email', userData.email)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data
    }
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600'
      case 'high': return 'text-orange-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  const stats = {
    totalCreated: createdWorkOrders?.length || 0,
    totalAssigned: assignedWorkOrders?.length || 0,
    totalReports: reports?.length || 0,
    completedAssigned: assignedWorkOrders?.filter(wo => wo.status === 'completed').length || 0
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Activitate Utilizator</h3>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>{userData.full_name || 'Unnamed'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  <span>{userData.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  <span className="capitalize">{userData.role}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 border-b -mb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('created')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'created'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              WO Create ({stats.totalCreated})
            </button>
            <button
              onClick={() => setActiveTab('assigned')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'assigned'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              WO Asignate ({stats.totalAssigned})
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'reports'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Rapoarte ({stats.totalReports})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card bg-blue-50 border-blue-200">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-900">{stats.totalCreated}</p>
                    <p className="text-sm text-blue-600 mt-1">WO Create</p>
                  </div>
                </div>
                <div className="card bg-green-50 border-green-200">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-900">{stats.totalAssigned}</p>
                    <p className="text-sm text-green-600 mt-1">WO Asignate</p>
                  </div>
                </div>
                <div className="card bg-purple-50 border-purple-200">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-purple-900">{stats.completedAssigned}</p>
                    <p className="text-sm text-purple-600 mt-1">Finalizate</p>
                  </div>
                </div>
                <div className="card bg-orange-50 border-orange-200">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-orange-900">{stats.totalReports}</p>
                    <p className="text-sm text-orange-600 mt-1">Rapoarte</p>
                  </div>
                </div>
              </div>

              {/* User Info */}
              <div className="card">
                <h4 className="font-semibold text-gray-900 mb-3">Informații Cont</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium">{userData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nume Complet:</span>
                    <span className="font-medium">{userData.full_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rol:</span>
                    <span className="font-medium capitalize">{userData.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Creat:</span>
                    <span className="font-medium">
                      {new Date(userData.created_at).toLocaleDateString('ro-RO')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium ${userData.is_active ? 'text-green-600' : 'text-red-600'}`}>
                      {userData.is_active ? 'Activ' : 'Inactiv'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Created Work Orders Tab */}
          {activeTab === 'created' && (
            <div className="space-y-3">
              {!createdWorkOrders || createdWorkOrders.length === 0 ? (
                <p className="text-center text-gray-600 py-8">Niciun work order creat</p>
              ) : (
                createdWorkOrders.map((wo) => (
                  <div key={wo.id} className="card hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(wo.status)}`}>
                            {wo.status}
                          </span>
                          <span className={`text-xs font-medium ${getPriorityColor(wo.priority)}`}>
                            {wo.priority}
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1">{wo.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{wo.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{wo.equipment?.name || 'N/A'}</span>
                          <span>{wo.location?.name || 'N/A'}</span>
                          {wo.assigned_user && <span>→ {wo.assigned_user.full_name}</span>}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {new Date(wo.created_at).toLocaleDateString('ro-RO')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Assigned Work Orders Tab */}
          {activeTab === 'assigned' && (
            <div className="space-y-3">
              {!assignedWorkOrders || assignedWorkOrders.length === 0 ? (
                <p className="text-center text-gray-600 py-8">Niciun work order asignat</p>
              ) : (
                assignedWorkOrders.map((wo) => (
                  <div key={wo.id} className="card hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(wo.status)}`}>
                            {wo.status}
                          </span>
                          <span className={`text-xs font-medium ${getPriorityColor(wo.priority)}`}>
                            {wo.priority}
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1">{wo.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{wo.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{wo.equipment?.name || 'N/A'}</span>
                          <span>{wo.location?.name || 'N/A'}</span>
                          {wo.creator && <span>De la: {wo.creator.full_name}</span>}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {new Date(wo.created_at).toLocaleDateString('ro-RO')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-3">
              {reportsLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : !reports || reports.length === 0 ? (
                <p className="text-center text-gray-600 py-8">Niciun raport public</p>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="card hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-xs text-gray-500">Raport Public</span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(report.status)}`}>
                            {report.status}
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-1">{report.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{report.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{report.equipment?.name || 'N/A'}</span>
                          <span>{report.location?.name || 'N/A'}</span>
                          <span>Email: {report.reporter_email}</span>
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {new Date(report.created_at).toLocaleDateString('ro-RO')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">
              Închide
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
