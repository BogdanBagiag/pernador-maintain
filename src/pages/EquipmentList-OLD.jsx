import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Plus, Search, Wrench, MapPin, Calendar } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function EquipmentList() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Fetch equipment from Supabase
  const { data: equipment, isLoading, error } = useQuery({
    queryKey: ['equipment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select(`
          *,
          location:locations(id, name, building)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
  })

  // Filter equipment based on search and status
  const filteredEquipment = equipment?.filter((item) => {
    const matchesSearch = 
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'operational':
        return 'badge-success'
      case 'maintenance':
        return 'badge-warning'
      case 'broken':
        return 'badge-danger'
      case 'retired':
        return 'badge-info'
      default:
        return 'badge-info'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card bg-red-50 border border-red-200">
        <p className="text-red-600">Error loading equipment: {error.message}</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipment</h1>
          <p className="text-gray-600 mt-1">
            Manage your equipment and assets
          </p>
        </div>
        <Link
          to="/equipment/new"
          className="btn-primary mt-4 sm:mt-0 inline-flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Equipment
        </Link>
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
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="all">All Status</option>
              <option value="operational">Operational</option>
              <option value="maintenance">Under Maintenance</option>
              <option value="broken">Broken</option>
              <option value="retired">Retired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Equipment Grid */}
      {!filteredEquipment || filteredEquipment.length === 0 ? (
        <div className="card text-center py-12">
          <Wrench className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || statusFilter !== 'all' 
              ? 'No equipment found' 
              : 'No equipment yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Get started by adding your first equipment'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Link to="/equipment/new" className="btn-primary inline-flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              Add Equipment
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Results count */}
          <div className="mb-4 text-sm text-gray-600">
            Showing {filteredEquipment.length} of {equipment.length} equipment
          </div>

          {/* Equipment Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEquipment.map((item) => (
              <Link
                key={item.id}
                to={`/equipment/${item.id}`}
                className="card hover:shadow-lg transition-shadow cursor-pointer"
              >
                {/* Image placeholder */}
                <div className="w-full h-48 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Wrench className="w-16 h-16 text-gray-400" />
                  )}
                </div>

                {/* Equipment info */}
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 flex-1">
                      {item.name}
                    </h3>
                    <span className={`badge ${getStatusColor(item.status)} ml-2 capitalize`}>
                      {item.status}
                    </span>
                  </div>

                  {item.serial_number && (
                    <p className="text-sm text-gray-600 mb-2">
                      SN: {item.serial_number}
                    </p>
                  )}

                  {item.location && (
                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <MapPin className="w-4 h-4 mr-1" />
                      {item.location.name}
                      {item.location.building && ` - ${item.location.building}`}
                    </div>
                  )}

                  {item.manufacturer && (
                    <p className="text-sm text-gray-600">
                      {item.manufacturer}
                      {item.model && ` - ${item.model}`}
                    </p>
                  )}

                  {item.purchase_date && (
                    <div className="flex items-center text-xs text-gray-500 mt-3">
                      <Calendar className="w-3 h-3 mr-1" />
                      Purchased: {new Date(item.purchase_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
