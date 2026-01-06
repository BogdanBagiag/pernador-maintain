import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Plus, Search, Download, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import EquipmentImportModal from '../components/EquipmentImportModal'

export default function EquipmentList() {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [showImportModal, setShowImportModal] = useState(false)
  const [filterTab, setFilterTab] = useState('all') // all, missing_serial, missing_manufacturer, missing_model, missing_location

  const { data: equipment, isLoading, refetch } = useQuery({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select(`
          *,
          location:locations(id, name)
        `)
        .order('name')
      
      if (error) throw error
      return data
    },
  })

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortedData = () => {
    if (!equipment) return []
    
    let filtered = equipment.filter(eq =>
      eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.model?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Apply filter tabs
    if (filterTab === 'missing_serial') {
      filtered = filtered.filter(eq => !eq.serial_number || eq.serial_number.trim() === '')
    } else if (filterTab === 'missing_manufacturer') {
      filtered = filtered.filter(eq => !eq.manufacturer || eq.manufacturer.trim() === '')
    } else if (filterTab === 'missing_model') {
      filtered = filtered.filter(eq => !eq.model || eq.model.trim() === '')
    } else if (filterTab === 'missing_location') {
      filtered = filtered.filter(eq => !eq.location_id)
    }

    return filtered.sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]

      if (sortField === 'location') {
        aVal = a.location?.name || ''
        bVal = b.location?.name || ''
      }

      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      const comparison = aVal.toString().localeCompare(bVal.toString(), undefined, { numeric: true })
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'operational': return 'bg-green-100 text-green-800 border-green-200'
      case 'maintenance': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'retired': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const sortedEquipment = getSortedData()

  // Calculate statistics for filter tabs
  const stats = {
    total: equipment?.length || 0,
    missingSerial: equipment?.filter(eq => !eq.serial_number || eq.serial_number.trim() === '').length || 0,
    missingManufacturer: equipment?.filter(eq => !eq.manufacturer || eq.manufacturer.trim() === '').length || 0,
    missingModel: equipment?.filter(eq => !eq.model || eq.model.trim() === '').length || 0,
    missingLocation: equipment?.filter(eq => !eq.location_id).length || 0,
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipment</h1>
          <p className="text-gray-600 mt-1">{sortedEquipment.length} total equipment</p>
        </div>
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary inline-flex items-center"
          >
            <Download className="w-5 h-5 mr-2" />
            Import Excel
          </button>
          <Link to="/equipment/new" className="btn-primary inline-flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Add Equipment
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {/* All */}
        <button
          onClick={() => setFilterTab('all')}
          className={`p-4 rounded-lg border-2 transition-all ${
            filterTab === 'all'
              ? 'border-blue-400 bg-blue-100 ring-2 ring-blue-300'
              : 'border-blue-200 bg-blue-50 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-2xl font-bold ${filterTab === 'all' ? 'text-blue-900' : 'text-blue-700'}`}>
              {stats.total}
            </span>
          </div>
          <p className={`text-sm font-medium ${filterTab === 'all' ? 'text-blue-800' : 'text-blue-600'}`}>
            Toate
          </p>
        </button>

        {/* Missing Serial */}
        <button
          onClick={() => setFilterTab('missing_serial')}
          className={`p-4 rounded-lg border-2 transition-all ${
            filterTab === 'missing_serial'
              ? 'border-red-400 bg-red-100 ring-2 ring-red-300'
              : 'border-red-200 bg-red-50 hover:border-red-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-2xl font-bold ${filterTab === 'missing_serial' ? 'text-red-900' : 'text-red-700'}`}>
              {stats.missingSerial}
            </span>
            <AlertTriangle className={`w-6 h-6 ${filterTab === 'missing_serial' ? 'text-red-700' : 'text-red-400'} opacity-50`} />
          </div>
          <p className={`text-sm font-medium ${filterTab === 'missing_serial' ? 'text-red-800' : 'text-red-600'}`}>
            Fără Serie
          </p>
        </button>

        {/* Missing Manufacturer */}
        <button
          onClick={() => setFilterTab('missing_manufacturer')}
          className={`p-4 rounded-lg border-2 transition-all ${
            filterTab === 'missing_manufacturer'
              ? 'border-orange-400 bg-orange-100 ring-2 ring-orange-300'
              : 'border-orange-200 bg-orange-50 hover:border-orange-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-2xl font-bold ${filterTab === 'missing_manufacturer' ? 'text-orange-900' : 'text-orange-700'}`}>
              {stats.missingManufacturer}
            </span>
            <AlertTriangle className={`w-6 h-6 ${filterTab === 'missing_manufacturer' ? 'text-orange-700' : 'text-orange-400'} opacity-50`} />
          </div>
          <p className={`text-sm font-medium ${filterTab === 'missing_manufacturer' ? 'text-orange-800' : 'text-orange-600'}`}>
            Fără Marcă
          </p>
        </button>

        {/* Missing Model */}
        <button
          onClick={() => setFilterTab('missing_model')}
          className={`p-4 rounded-lg border-2 transition-all ${
            filterTab === 'missing_model'
              ? 'border-yellow-400 bg-yellow-100 ring-2 ring-yellow-300'
              : 'border-yellow-200 bg-yellow-50 hover:border-yellow-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-2xl font-bold ${filterTab === 'missing_model' ? 'text-yellow-900' : 'text-yellow-700'}`}>
              {stats.missingModel}
            </span>
            <AlertTriangle className={`w-6 h-6 ${filterTab === 'missing_model' ? 'text-yellow-700' : 'text-yellow-400'} opacity-50`} />
          </div>
          <p className={`text-sm font-medium ${filterTab === 'missing_model' ? 'text-yellow-800' : 'text-yellow-600'}`}>
            Fără Model
          </p>
        </button>

        {/* Missing Location */}
        <button
          onClick={() => setFilterTab('missing_location')}
          className={`p-4 rounded-lg border-2 transition-all ${
            filterTab === 'missing_location'
              ? 'border-purple-400 bg-purple-100 ring-2 ring-purple-300'
              : 'border-purple-200 bg-purple-50 hover:border-purple-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-2xl font-bold ${filterTab === 'missing_location' ? 'text-purple-900' : 'text-purple-700'}`}>
              {stats.missingLocation}
            </span>
            <AlertTriangle className={`w-6 h-6 ${filterTab === 'missing_location' ? 'text-purple-700' : 'text-purple-400'} opacity-50`} />
          </div>
          <p className={`text-sm font-medium ${filterTab === 'missing_location' ? 'text-purple-800' : 'text-purple-600'}`}>
            Fără Locație
          </p>
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search equipment by name, serial number, or model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
      </div>

      {/* Table */}
      {sortedEquipment.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">No equipment found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort('inventory_number')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Nr. Inventar
                      <SortIcon field="inventory_number" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Name
                      <SortIcon field="name" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('manufacturer')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Brand
                      <SortIcon field="manufacturer" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('model')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Model
                      <SortIcon field="model" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('serial_number')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Serial Number
                      <SortIcon field="serial_number" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('location')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Location
                      <SortIcon field="location" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Status
                      <SortIcon field="status" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedEquipment.map((eq) => (
                  <tr key={eq.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {eq.inventory_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/equipment/${eq.id}`}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        {eq.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {eq.manufacturer || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {eq.model || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {eq.serial_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {eq.location?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(eq.status)}`}>
                        {eq.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/equipment/${eq.id}`}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <EquipmentImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  )
}
