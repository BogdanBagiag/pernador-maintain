import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  Wrench, 
  MapPin, 
  ClipboardList, 
  CheckCircle, 
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Filter
} from 'lucide-react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Dashboard() {
  const [dateRange, setDateRange] = useState('all') // all, 7days, 30days, 90days, custom
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Calculate date filter
  const getDateFilter = () => {
    if (dateRange === 'all') return { start: null, end: null }
    
    if (dateRange === 'custom') {
      return {
        start: customStartDate || null,
        end: customEndDate || null
      }
    }
    
    const now = new Date()
    const days = {
      '7days': 7,
      '30days': 30,
      '90days': 90
    }[dateRange]
    
    const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000))
    return {
      start: startDate.toISOString(),
      end: null
    }
  }
  // Fetch all data
  const { data: equipment, isLoading: loadingEquipment } = useQuery({
    queryKey: ['dashboard-equipment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*, location:locations(id, name)')
      if (error) throw error
      return data
    },
  })

  const { data: workOrders, isLoading: loadingWorkOrders } = useQuery({
    queryKey: ['dashboard-work-orders', dateRange, customStartDate, customEndDate],
    queryFn: async () => {
      let query = supabase
        .from('work_orders')
        .select('*, equipment:equipment(id, name)')
        .order('created_at', { ascending: false })
      
      const { start, end } = getDateFilter()
      
      if (start) {
        query = query.gte('created_at', start)
      }
      
      if (end) {
        // Add one day to include the entire end date
        const endDate = new Date(end)
        endDate.setHours(23, 59, 59, 999)
        query = query.lte('created_at', endDate.toISOString())
      }
      
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })

  const { data: locations, isLoading: loadingLocations } = useQuery({
    queryKey: ['dashboard-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
      if (error) throw error
      return data
    },
  })

  // Fetch maintenance schedules for preventive maintenance tracking
  const { data: schedules, isLoading: loadingSchedules } = useQuery({
    queryKey: ['dashboard-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select(`
          *,
          equipment:equipment(id, name, location:locations(name))
        `)
        .eq('is_active', true)
        .order('next_due_date', { ascending: true })
      if (error) throw error
      return data
    },
  })

  if (loadingEquipment || loadingWorkOrders || loadingLocations || loadingSchedules) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Calculate statistics
  const totalEquipment = equipment?.length || 0
  const totalLocations = locations?.length || 0
  
  const statusCounts = workOrders?.reduce((acc, wo) => {
    acc[wo.status] = (acc[wo.status] || 0) + 1
    return acc
  }, {}) || {}

  const openCount = statusCounts.open || 0
  const inProgressCount = statusCounts.in_progress || 0
  const completedCount = statusCounts.completed || 0
  const totalWorkOrders = workOrders?.length || 0

  // Maintenance schedule statistics
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  
  const upcomingSchedules = schedules?.filter(s => {
    if (!s.next_due_date) return false
    const scheduleDate = new Date(s.next_due_date)
    return scheduleDate >= now && scheduleDate <= sevenDaysFromNow
  }) || []
  
  const overdueSchedules = schedules?.filter(s => {
    if (!s.next_due_date) return false
    const scheduleDate = new Date(s.next_due_date)
    return scheduleDate < now
  }) || []
  
  // Recent completed maintenance - last 5 completed
  const recentCompletedMaintenance = schedules
    ?.filter(s => s.last_completed_date)
    .sort((a, b) => new Date(b.last_completed_date) - new Date(a.last_completed_date))
    .slice(0, 5) || []

  // Equipment by status
  const equipmentByStatus = equipment?.reduce((acc, eq) => {
    acc[eq.status] = (acc[eq.status] || 0) + 1
    return acc
  }, {}) || {}

  // Equipment by location
  const equipmentByLocation = equipment?.reduce((acc, eq) => {
    const locationName = eq.location?.name || 'Unassigned'
    acc[locationName] = (acc[locationName] || 0) + 1
    return acc
  }, {}) || {}

  // Work orders by priority
  const workOrdersByPriority = workOrders?.reduce((acc, wo) => {
    acc[wo.priority] = (acc[wo.priority] || 0) + 1
    return acc
  }, {}) || {}

  // Recent completed work orders
  const recentCompleted = workOrders
    ?.filter(wo => wo.status === 'completed')
    .slice(0, 5) || []

  // Calculate total costs (parts + labor)
  const totalPartsCost = workOrders
    ?.filter(wo => wo.parts_cost)
    .reduce((sum, wo) => sum + parseFloat(wo.parts_cost), 0) || 0
  
  const totalLaborCost = workOrders
    ?.filter(wo => wo.labor_cost)
    .reduce((sum, wo) => sum + parseFloat(wo.labor_cost), 0) || 0
  
  const totalCost = totalPartsCost + totalLaborCost

  // Calculate average completion time
  const completedWithDates = workOrders?.filter(wo => wo.completed_date && wo.created_at) || []
  const avgCompletionTime = completedWithDates.length > 0
    ? completedWithDates.reduce((sum, wo) => {
        const created = new Date(wo.created_at)
        const completed = new Date(wo.completed_date)
        const hours = (completed - created) / (1000 * 60 * 60)
        return sum + hours
      }, 0) / completedWithDates.length
    : 0

  // Prepare chart data
  const equipmentStatusData = Object.entries(equipmentByStatus).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count
  }))

  const locationData = Object.entries(equipmentByLocation)
    .slice(0, 5)
    .map(([location, count]) => ({
      name: location.length > 15 ? location.substring(0, 15) + '...' : location,
      count
    }))

  const priorityData = Object.entries(workOrdersByPriority).map(([priority, count]) => ({
    name: priority.charAt(0).toUpperCase() + priority.slice(1),
    value: count
  }))

  const COLORS = {
    operational: '#10b981',
    maintenance: '#f59e0b',
    broken: '#ef4444',
    retired: '#6b7280',
    low: '#6b7280',
    medium: '#3b82f6',
    high: '#f59e0b',
    critical: '#ef4444'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Overview of your maintenance operations</p>
          </div>

          {/* Date Filter */}
          <div className="mt-4 lg:mt-0">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="input py-2 px-3"
              >
                <option value="all">All Time</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {dateRange === 'custom' && (
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Custom Period:</span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
                <div className="flex items-center space-x-2">
                  <label htmlFor="startDate" className="text-sm text-gray-700 font-medium">
                    From:
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    max={customEndDate || new Date().toISOString().split('T')[0]}
                    className="input py-2 px-3"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <label htmlFor="endDate" className="text-sm text-gray-700 font-medium">
                    To:
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    min={customStartDate}
                    max={new Date().toISOString().split('T')[0]}
                    className="input py-2 px-3"
                  />
                </div>

                {(customStartDate || customEndDate) && (
                  <button
                    onClick={() => {
                      setCustomStartDate('')
                      setCustomEndDate('')
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Period Indicator */}
        {dateRange !== 'all' && dateRange !== 'custom' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Showing data for: <span className="font-semibold ml-1">
                {dateRange === '7days' && 'Last 7 Days'}
                {dateRange === '30days' && 'Last 30 Days'}
                {dateRange === '90days' && 'Last 90 Days'}
              </span>
            </p>
          </div>
        )}

        {/* Custom Range Indicator */}
        {dateRange === 'custom' && (customStartDate || customEndDate) && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Showing data from: <span className="font-semibold ml-1">
                {customStartDate ? new Date(customStartDate).toLocaleDateString() : 'Beginning'} 
                {' to '}
                {customEndDate ? new Date(customEndDate).toLocaleDateString() : 'Today'}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Work Orders Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-6 h-6 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Ordine de Lucru</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
          <Link to="/work-orders?status=open" className="card hover:shadow-lg transition-shadow bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium mb-1">Deschise</p>
                <p className="text-3xl font-bold text-orange-900">{openCount}</p>
              </div>
              <ClipboardList className="w-10 h-10 text-orange-600 opacity-50" />
            </div>
          </Link>

          <Link to="/work-orders?status=completed" className="card hover:shadow-lg transition-shadow bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium mb-1">Finalizate</p>
                <p className="text-3xl font-bold text-green-900">{completedCount}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </Link>
        </div>
      </div>

      {/* Maintenance Schedule Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-6 h-6 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Mentenanță Preventivă</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
          <Link to="/schedules" className="card hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium mb-1">Următoarele 7 Zile</p>
                <p className="text-3xl font-bold text-blue-900">{upcomingSchedules.length}</p>
              </div>
              <Calendar className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </Link>

          <Link to="/schedules" className="card hover:shadow-lg transition-shadow bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium mb-1">Întârziate</p>
                <p className="text-3xl font-bold text-red-900">{overdueSchedules.length}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-600 opacity-50" />
            </div>
          </Link>
        </div>
      </div>

      {/* Equipment and Locations Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-6 h-6 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Echipamente și Locații</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
          <Link to="/equipment" className="card hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium mb-1">Total Echipamente</p>
                <p className="text-3xl font-bold text-blue-900">{totalEquipment}</p>
              </div>
              <Wrench className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </Link>

          <Link to="/locations" className="card hover:shadow-lg transition-shadow bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium mb-1">Total Locații</p>
                <p className="text-3xl font-bold text-purple-900">{totalLocations}</p>
              </div>
              <MapPin className="w-10 h-10 text-purple-600 opacity-50" />
            </div>
          </Link>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-gray-50">
          <div className="flex items-center mb-2">
            <Clock className="w-5 h-5 text-gray-600 mr-2" />
            <p className="text-sm text-gray-600 font-medium">Avg. Completion Time</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {avgCompletionTime > 0 ? `${avgCompletionTime.toFixed(1)}h` : 'N/A'}
          </p>
        </div>

        <div className="card bg-gray-50">
          <div className="flex items-center mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
            <p className="text-sm text-gray-600 font-medium">In Progress</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{inProgressCount}</p>
        </div>

        <div className="card bg-gray-50">
          <div className="flex items-center mb-2">
            <p className="text-sm text-gray-600 font-medium">Cost Total</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalCost.toFixed(2)} Lei</p>
          <div className="flex gap-4 mt-2 text-xs text-gray-600">
            <span>Piese: {totalPartsCost.toFixed(2)} Lei</span>
            <span>Manoperă: {totalLaborCost.toFixed(2)} Lei</span>
          </div>
        </div>

        <div className="card bg-gray-50">
          <div className="flex items-center mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
            <p className="text-sm text-gray-600 font-medium">Total Work Orders</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalWorkOrders}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-1 gap-6">
        {/* Equipment Status */}
        {equipmentStatusData.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Equipment Status</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={equipmentStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {equipmentStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase()] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Maintenance Schedule Details */}
      {recentCompletedMaintenance.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Mentenanță Finalizată Recent</h2>
            <Link to="/schedules" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              Vezi Toate
            </Link>
          </div>

          {/* Recent Completed List */}
          <div className="space-y-3">
            {recentCompletedMaintenance.map((schedule) => (
              <Link
                key={schedule.id}
                to={`/schedules`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">{schedule.equipment?.name || 'N/A'}</p>
                    <p className="text-sm text-gray-600">
                      {schedule.equipment?.location?.name || 'N/A'} • {schedule.title || schedule.description || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(schedule.last_completed_date).toLocaleDateString('ro-RO')}
                  </p>
                  <p className="text-xs text-gray-600">
                    Finalizat {schedule.times_completed || 1}x
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Completed Work Orders</h2>
          <Link to="/work-orders" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            View All
          </Link>
        </div>
        
        {recentCompleted.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No completed work orders yet</p>
        ) : (
          <div className="space-y-3">
            {recentCompleted.map((wo) => (
              <Link
                key={wo.id}
                to={`/work-orders/${wo.id}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">{wo.title}</p>
                    {wo.equipment && (
                      <p className="text-sm text-gray-600">{wo.equipment.name}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(wo.completed_date).toLocaleDateString()}
                  </p>
                  {(wo.parts_cost || wo.labor_cost) && (
                    <p className="text-sm font-medium text-green-600">
                      {(parseFloat(wo.parts_cost || 0) + parseFloat(wo.labor_cost || 0)).toFixed(2)} Lei
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
