import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  FileText, 
  Calendar, 
  DollarSign, 
  Clock, 
  Wrench,
  Filter,
  Download,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Search,
  Eye,
  User,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Reports() {
  const [dateFilter, setDateFilter] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [technicianFilter, setTechnicianFilter] = useState('all')
  const [equipmentFilter, setEquipmentFilter] = useState('all')
  const [minCost, setMinCost] = useState('')
  const [maxCost, setMaxCost] = useState('')
  const [expandedReports, setExpandedReports] = useState({}) // Track which reports are expanded

  // Fetch completed work orders with reports
  const { data: completedWorkOrders, isLoading } = useQuery({
    queryKey: ['completed-work-orders-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          equipment:equipment(id, name, serial_number),
          assigned_to_user:profiles!work_orders_assigned_to_fkey(id, full_name)
        `)
        .eq('status', 'completed')
        .not('completed_date', 'is', null)
        .order('completed_date', { ascending: false })
      
      if (error) throw error
      return data
    },
  })

  // Toggle report expansion
  const toggleReport = (reportId) => {
    setExpandedReports(prev => ({
      ...prev,
      [reportId]: !prev[reportId]
    }))
  }

  // Expand/Collapse all
  const expandAll = () => {
    const allExpanded = {}
    filteredWorkOrders.forEach(wo => {
      allExpanded[wo.id] = true
    })
    setExpandedReports(allExpanded)
  }

  const collapseAll = () => {
    setExpandedReports({})
  }

  // Get unique technicians for filter
  const technicians = completedWorkOrders
    ? [...new Set(completedWorkOrders
        .map(wo => wo.completed_by)
        .filter(Boolean))]
    : []

  // Get unique equipment for filter
  const equipmentList = completedWorkOrders
    ? [...new Map(completedWorkOrders
        .filter(wo => wo.equipment)
        .map(wo => [wo.equipment.id, wo.equipment])
      ).values()]
    : []

  // Filter work orders
  const getFilteredWorkOrders = () => {
    if (!completedWorkOrders) return []

    let filtered = completedWorkOrders

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(wo =>
        wo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wo.equipment?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wo.completed_by?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Date filter
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    if (dateFilter === 'today') {
      filtered = filtered.filter(wo => {
        const completedDate = new Date(wo.completed_date)
        return completedDate >= today
      })
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      filtered = filtered.filter(wo => {
        const completedDate = new Date(wo.completed_date)
        return completedDate >= weekAgo
      })
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(today)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      filtered = filtered.filter(wo => {
        const completedDate = new Date(wo.completed_date)
        return completedDate >= monthAgo
      })
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
      const startDate = new Date(customStartDate)
      const endDate = new Date(customEndDate)
      endDate.setHours(23, 59, 59)
      filtered = filtered.filter(wo => {
        const completedDate = new Date(wo.completed_date)
        return completedDate >= startDate && completedDate <= endDate
      })
    }

    // Technician filter
    if (technicianFilter !== 'all') {
      filtered = filtered.filter(wo => wo.completed_by === technicianFilter)
    }

    // Equipment filter
    if (equipmentFilter !== 'all') {
      filtered = filtered.filter(wo => wo.equipment?.id === equipmentFilter)
    }

    // Cost filter
    if (minCost || maxCost) {
      filtered = filtered.filter(wo => {
        const totalCost = (parseFloat(wo.parts_cost) || 0) + (parseFloat(wo.labor_cost) || 0)
        const min = minCost ? parseFloat(minCost) : 0
        const max = maxCost ? parseFloat(maxCost) : Infinity
        return totalCost >= min && totalCost <= max
      })
    }

    return filtered
  }

  const filteredWorkOrders = getFilteredWorkOrders()

  // Calculate statistics
  const calculateStats = () => {
    if (!filteredWorkOrders.length) {
      return {
        totalReports: 0,
        totalCost: 0,
        totalHours: 0,
        avgCost: 0,
        avgHours: 0
      }
    }

    const totalCost = filteredWorkOrders.reduce((sum, wo) => 
      sum + (parseFloat(wo.parts_cost) || 0) + (parseFloat(wo.labor_cost) || 0), 0
    )

    const totalHours = filteredWorkOrders.reduce((sum, wo) => 
      sum + (parseFloat(wo.actual_hours) || 0), 0
    )

    return {
      totalReports: filteredWorkOrders.length,
      totalCost,
      totalHours,
      avgCost: totalCost / filteredWorkOrders.length,
      avgHours: totalHours / filteredWorkOrders.length
    }
  }

  const stats = calculateStats()

  // Calculate resolution time
  const calculateResolutionTime = (createdAt, completedDate) => {
    if (!createdAt || !completedDate) return null
    
    const start = new Date(createdAt)
    const end = new Date(completedDate)
    const diffMs = end - start
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) {
      return `${days}z ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Rapoarte Finalizare</h1>
        <p className="text-gray-600 mt-2">Rapoarte detaliate pentru work orders completate</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Rapoarte</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">{stats.totalReports}</p>
            </div>
            <FileText className="w-12 h-12 text-blue-400" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Cost Total</p>
              <p className="text-2xl font-bold text-green-900 mt-1">
                {stats.totalCost.toFixed(2)} RON
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-green-400" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">Ore Totale</p>
              <p className="text-3xl font-bold text-purple-900 mt-1">
                {stats.totalHours.toFixed(1)}h
              </p>
            </div>
            <Clock className="w-12 h-12 text-purple-400" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 font-medium">Cost Mediu</p>
              <p className="text-2xl font-bold text-orange-900 mt-1">
                {stats.avgCost.toFixed(2)} RON
              </p>
            </div>
            <TrendingUp className="w-12 h-12 text-orange-400" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-600 font-medium">Ore Medii</p>
              <p className="text-3xl font-bold text-indigo-900 mt-1">
                {stats.avgHours.toFixed(1)}h
              </p>
            </div>
            <Clock className="w-12 h-12 text-indigo-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-center mb-4">
          <Filter className="w-5 h-5 text-gray-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Filtre</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cauta
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Titlu, echipament, tehnician..."
                className="input pl-10 w-full"
              />
            </div>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Perioada
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input w-full"
            >
              <option value="all">Toate</option>
              <option value="today">Astazi</option>
              <option value="week">Ultima saptamana</option>
              <option value="month">Ultima luna</option>
              <option value="custom">Perioada personalizata</option>
            </select>
          </div>

          {/* Technician Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tehnician
            </label>
            <select
              value={technicianFilter}
              onChange={(e) => setTechnicianFilter(e.target.value)}
              className="input w-full"
            >
              <option value="all">Toti tehnicienii</option>
              {technicians.map((tech, idx) => (
                <option key={idx} value={tech}>{tech}</option>
              ))}
            </select>
          </div>

          {/* Equipment Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Echipament
            </label>
            <select
              value={equipmentFilter}
              onChange={(e) => setEquipmentFilter(e.target.value)}
              className="input w-full"
            >
              <option value="all">Toate echipamentele</option>
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.name}</option>
              ))}
            </select>
          </div>

          {/* Min Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cost Minim (RON)
            </label>
            <input
              type="number"
              value={minCost}
              onChange={(e) => setMinCost(e.target.value)}
              placeholder="0"
              className="input w-full"
              min="0"
              step="0.01"
            />
          </div>

          {/* Max Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cost Maxim (RON)
            </label>
            <input
              type="number"
              value={maxCost}
              onChange={(e) => setMaxCost(e.target.value)}
              placeholder="999999"
              className="input w-full"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        {/* Custom Date Range */}
        {dateFilter === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                De la data
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pana la data
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>
        )}

        {/* Clear Filters Button */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => {
              setSearchQuery('')
              setDateFilter('all')
              setCustomStartDate('')
              setCustomEndDate('')
              setTechnicianFilter('all')
              setEquipmentFilter('all')
              setMinCost('')
              setMaxCost('')
            }}
            className="btn-secondary"
          >
            Reseteaza Filtre
          </button>
        </div>
      </div>

      {/* Reports List as Expandable Cards */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Rapoarte ({filteredWorkOrders.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={expandAll}
              className="btn-secondary text-sm inline-flex items-center flex-1 sm:flex-initial justify-center"
            >
              <ChevronDown className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Expandeaza Toate</span>
              <span className="sm:hidden">Expand</span>
            </button>
            <button
              onClick={collapseAll}
              className="btn-secondary text-sm inline-flex items-center flex-1 sm:flex-initial justify-center"
            >
              <ChevronUp className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Collapseaza Toate</span>
              <span className="sm:hidden">Collapse</span>
            </button>
            <button
              onClick={() => window.print()}
              className="btn-secondary inline-flex items-center flex-1 sm:flex-initial justify-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Print
            </button>
          </div>
        </div>

        {filteredWorkOrders.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">Niciun raport gasit</p>
            <p className="text-gray-400 text-sm">Incearca sa ajustezi filtrele</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredWorkOrders.map((wo) => {
              const totalCost = (parseFloat(wo.parts_cost) || 0) + (parseFloat(wo.labor_cost) || 0)
              const hasCompleteReport = wo.completed_by || wo.parts_replaced || totalCost > 0 || wo.completion_notes
              const isExpanded = expandedReports[wo.id]

              return (
                <div key={wo.id} className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors">
                  {/* Card Header - Always Visible */}
                  <div 
                    className="bg-gray-50 p-3 sm:p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleReport(wo.id)}
                  >
                    <div className="flex flex-col gap-3">
                      {/* Top Row - Chevron + Title */}
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 break-words">{wo.title}</h3>
                        </div>
                      </div>
                      
                      {/* Info Grid - Equipment, Technician, Date, Hours */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 text-xs sm:text-sm pl-6 sm:pl-8">
                        {/* Equipment */}
                        {wo.equipment && (
                          <div className="flex items-center text-gray-600">
                            <Wrench className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                            <span className="truncate">{wo.equipment.name}</span>
                          </div>
                        )}
                        {/* Technician */}
                        {wo.completed_by && (
                          <div className="flex items-center text-gray-600">
                            <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                            <span className="truncate">{wo.completed_by}</span>
                          </div>
                        )}
                        {/* Date */}
                        <div className="flex items-center text-gray-600">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                          <span>{new Date(wo.completed_date).toLocaleDateString('ro-RO')}</span>
                        </div>
                        {/* Hours */}
                        {wo.actual_hours && (
                          <div className="flex items-center text-gray-600">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                            <span>{wo.actual_hours}h</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Badges Row - Cost & Complete */}
                      {(totalCost > 0 || hasCompleteReport) && (
                        <div className="flex flex-wrap items-center gap-2 pl-6 sm:pl-8 pt-2 border-t border-gray-200">
                          {totalCost > 0 && (
                            <div className="bg-green-100 text-green-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold">
                              {totalCost.toFixed(2)} RON
                            </div>
                          )}
                          {hasCompleteReport && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Complet
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Body - Expandable Details */}
                  {isExpanded && (
                    <div className="bg-white p-3 sm:p-4 md:p-6 border-t border-gray-200">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                        {/* Left Column */}
                        <div className="space-y-3 md:space-y-4">
                          {/* Time Tracking */}
                          <div>
                            <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 flex items-center">
                              <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              Tracking Timp
                            </h4>
                            <div className="bg-gray-50 p-2 sm:p-3 rounded-lg space-y-2">
                              {/* Data Sesizare */}
                              <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm gap-1">
                                <span className="text-gray-600 font-medium sm:font-normal">Data Sesizare:</span>
                                <span className="font-medium text-gray-900">
                                  {new Date(wo.created_at).toLocaleString('ro-RO', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              {/* Data Finalizare */}
                              <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm gap-1">
                                <span className="text-gray-600 font-medium sm:font-normal">Data Finalizare:</span>
                                <span className="font-medium text-gray-900">
                                  {new Date(wo.completed_date).toLocaleString('ro-RO', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              {/* Durata Totala Rezolvare */}
                              {calculateResolutionTime(wo.created_at, wo.completed_date) && (
                                <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm pt-2 border-t border-gray-200 gap-1">
                                  <span className="text-gray-600 font-medium">Durata Totala Rezolvare:</span>
                                  <span className="font-bold text-primary-600">
                                    {calculateResolutionTime(wo.created_at, wo.completed_date)}
                                  </span>
                                </div>
                              )}
                              {wo.actual_hours && (
                                <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm pt-2 border-t border-gray-200 gap-1">
                                  <span className="text-gray-600 font-medium sm:font-normal">Ore Lucrate:</span>
                                  <span className="font-semibold text-gray-900">{wo.actual_hours}h</span>
                                </div>
                              )}
                              {wo.estimated_hours && (
                                <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm gap-1">
                                  <span className="text-gray-600 font-medium sm:font-normal">Ore Estimate:</span>
                                  <span className="text-gray-900">{wo.estimated_hours}h</span>
                                </div>
                              )}
                              {wo.actual_hours && wo.estimated_hours && (
                                <div className="pt-2 border-t border-gray-200">
                                  {wo.actual_hours > wo.estimated_hours ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      +{(wo.actual_hours - wo.estimated_hours).toFixed(1)}h peste estimare
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      In limita estimarii
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Parts Replaced */}
                          {wo.parts_replaced && (
                            <div>
                              <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Piese Inlocuite</h4>
                              <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                                <p className="text-xs sm:text-sm text-gray-900 whitespace-pre-wrap break-words">{wo.parts_replaced}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Right Column */}
                        <div className="space-y-3 md:space-y-4">
                          {/* Costs Breakdown */}
                          {(wo.parts_cost != null || wo.labor_cost != null) && (
                            <div>
                              <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                Costuri
                              </h4>
                              <div className="space-y-2">
                                {wo.parts_cost != null && (
                                  <div className="bg-blue-50 p-2 sm:p-3 rounded-lg flex justify-between items-center">
                                    <span className="text-xs sm:text-sm text-blue-700">Cost Piese</span>
                                    <span className="text-base sm:text-lg font-bold text-blue-900">
                                      {parseFloat(wo.parts_cost).toFixed(2)} RON
                                    </span>
                                  </div>
                                )}
                                {wo.labor_cost != null && (
                                  <div className="bg-purple-50 p-2 sm:p-3 rounded-lg flex justify-between items-center">
                                    <span className="text-xs sm:text-sm text-purple-700">Cost Manopera</span>
                                    <span className="text-base sm:text-lg font-bold text-purple-900">
                                      {parseFloat(wo.labor_cost).toFixed(2)} RON
                                    </span>
                                  </div>
                                )}
                                {(wo.parts_cost != null || wo.labor_cost != null) && (
                                  <div className="bg-green-50 p-2 sm:p-3 rounded-lg flex justify-between items-center border-2 border-green-200">
                                    <span className="text-xs sm:text-sm font-semibold text-green-700">Cost Total</span>
                                    <span className="text-lg sm:text-xl font-bold text-green-900">
                                      {totalCost.toFixed(2)} RON
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Completion Notes */}
                          {wo.completion_notes && (
                            <div>
                              <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                Note Tehnician
                              </h4>
                              <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                                <p className="text-xs sm:text-sm text-gray-900 whitespace-pre-wrap break-words">{wo.completion_notes}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-gray-200 flex justify-center sm:justify-end">
                        <Link
                          to={`/work-orders/${wo.id}`}
                          className="inline-flex items-center text-xs sm:text-sm text-primary-600 hover:text-primary-900 font-medium"
                        >
                          Vezi Work Order Complet
                          <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
