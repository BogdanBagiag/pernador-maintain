import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Plus, Search, Filter, Car } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import VehiclesStatusDashboard from '../components/VehiclesStatusDashboard'

export default function VehiclesList() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')

  const canCreate = profile?.role === 'admin' || profile?.role === 'manager'

  // Fetch vehicles
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          assigned_user:assigned_to(id, full_name, email)
        `)
        .order('brand', { ascending: true })
      
      if (error) throw error
      return data
    },
  })

  const getStatusBadge = (status) => {
    const badges = {
      operational: { bg: 'bg-green-100', text: 'text-green-800', label: 'Operațional' },
      in_service: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'În Service' },
      out_of_order: { bg: 'bg-red-100', text: 'text-red-800', label: 'Defect' },
      sold: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Vândut' },
      retired: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Retras' },
    }
    return badges[status] || badges.operational
  }

  const getVehicleTypeBadge = (type) => {
    return type === 'autovehicul' 
      ? { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Autovehicul' }
      : { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Remorcă' }
  }

  // Filter vehicles
  const filteredVehicles = vehicles?.filter(vehicle => {
    const matchesSearch = 
      vehicle.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.registration_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.vin?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || vehicle.status === filterStatus
    const matchesType = filterType === 'all' || vehicle.vehicle_type === filterType

    return matchesSearch && matchesStatus && matchesType
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vehicule</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gestionează flota de vehicule
            </p>
          </div>
          {canCreate && (
            <Link
              to="/vehicles/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Adaugă Vehicul
            </Link>
          )}
        </div>
      </div>

      {/* Status Dashboard - RAPORT COMPLET */}
      <VehiclesStatusDashboard />

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Caută vehicul..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="all">Toate statusurile</option>
              <option value="operational">Operațional</option>
              <option value="in_service">În Service</option>
              <option value="out_of_order">Defect</option>
              <option value="sold">Vândut</option>
              <option value="retired">Retras</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Car className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="all">Toate tipurile</option>
              <option value="autovehicul">Autovehicule</option>
              <option value="remorca">Remorci</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vehicles Grid */}
      {filteredVehicles && filteredVehicles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map((vehicle) => {
            const statusBadge = getStatusBadge(vehicle.status)
            const typeBadge = getVehicleTypeBadge(vehicle.vehicle_type)
            
            return (
              <Link
                key={vehicle.id}
                to={`/vehicles/${vehicle.id}`}
                className="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Vehicle Image */}
                <div className="h-48 bg-gray-200 relative">
                  {vehicle.image_url ? (
                    <img
                      src={vehicle.image_url}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Car className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  {/* Status Badge Overlay */}
                  <div className="absolute top-2 right-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                      {statusBadge.label}
                    </span>
                  </div>
                  {/* Type Badge Overlay */}
                  <div className="absolute top-2 left-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeBadge.bg} ${typeBadge.text}`}>
                      {typeBadge.label}
                    </span>
                  </div>
                </div>

                {/* Vehicle Info */}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {vehicle.brand} {vehicle.model}
                  </h3>
                  <p className="text-sm text-gray-500 font-mono mt-1">
                    {vehicle.registration_number}
                  </p>
                  
                  {vehicle.year && (
                    <p className="text-sm text-gray-600 mt-2">
                      An fabricație: {vehicle.year}
                    </p>
                  )}
                  
                  {vehicle.current_mileage && (
                    <p className="text-sm text-gray-600">
                      Kilometraj: {vehicle.current_mileage.toLocaleString()} km
                    </p>
                  )}

                  {vehicle.assigned_user && (
                    <p className="text-sm text-gray-600 mt-2">
                      Asignat: {vehicle.assigned_user.full_name || vehicle.assigned_user.email}
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <Car className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {searchTerm || filterStatus !== 'all' || filterType !== 'all' 
              ? 'Nu s-au găsit vehicule'
              : 'Niciun vehicul'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filterStatus !== 'all' || filterType !== 'all'
              ? 'Încearcă să modifici filtrele de căutare.'
              : 'Începe prin a adăuga primul vehicul.'}
          </p>
          {canCreate && !searchTerm && filterStatus === 'all' && filterType === 'all' && (
            <div className="mt-6">
              <Link
                to="/vehicles/new"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Adaugă Vehicul
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
