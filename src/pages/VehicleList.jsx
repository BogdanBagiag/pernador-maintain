import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useVehicleAlerts } from '../hooks/useVehicleAlerts'
import { Plus, Search, Car, Calendar, Gauge, User, AlertTriangle, CheckCircle } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function VehicleList() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const { alertCount, insuranceAlerts, vignetteAlerts } = useVehicleAlerts()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Check permissions
  const canCreate = profile?.role === 'admin' || profile?.role === 'manager'

  // Fetch vehicles with assigned user info
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          assigned_user:assigned_to(full_name, email)
        `)
        .eq('is_active', true)
        .order('brand', { ascending: true })
      
      if (error) throw error
      return data
    },
  })

  // Filter vehicles based on search and status
  const filteredVehicles = vehicles?.filter((vehicle) => {
    const matchesSearch =
      vehicle.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.registration_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.vin?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Get status badge color
  const getStatusBadge = (status) => {
    const badges = {
      operational: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: CheckCircle,
        label: t('vehicles.operational')
      },
      in_service: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        icon: AlertTriangle,
        label: t('vehicles.inService')
      },
      broken: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        icon: AlertTriangle,
        label: t('vehicles.broken')
      },
      sold: {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        icon: CheckCircle,
        label: t('vehicles.sold')
      },
      retired: {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        icon: CheckCircle,
        label: t('vehicles.retired')
      }
    }
    return badges[status] || badges.operational
  }

  // Get fuel type label
  const getFuelTypeLabel = (fuelType) => {
    const labels = {
      benzina: t('vehicles.benzina'),
      motorina: t('vehicles.motorina'),
      electric: t('vehicles.electric'),
      hibrid: t('vehicles.hibrid'),
      gpl: t('vehicles.gpl')
    }
    return labels[fuelType] || fuelType
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('vehicles.title')}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {filteredVehicles?.length || 0} {t('vehicles.subtitle')}
            </p>
          </div>
          {canCreate && (
            <Link
              to="/vehicles/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Plus className="w-5 h-5 mr-2" />
              {t('vehicles.new')}
            </Link>
          )}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder={t('vehicles.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg"
            >
              <option value="all">{t('common.all')}</option>
              <option value="operational">{t('vehicles.operational')}</option>
              <option value="in_service">{t('vehicles.inService')}</option>
              <option value="broken">{t('vehicles.broken')}</option>
              <option value="sold">{t('vehicles.sold')}</option>
              <option value="retired">{t('vehicles.retired')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expiration Alerts Banner */}
      {alertCount > 0 && (
        <div className="mb-6 bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 rounded-lg p-4 shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-orange-800">
                Atenție! {alertCount} {alertCount === 1 ? 'alertă de expirare' : 'alerte de expirare'}
              </h3>
              <div className="mt-2 text-sm text-orange-700">
                <p>
                  {insuranceAlerts > 0 && (
                    <span>
                      {insuranceAlerts} {insuranceAlerts === 1 ? 'asigurare expiră' : 'asigurări expiră'} în următoarele 30 zile
                    </span>
                  )}
                  {insuranceAlerts > 0 && vignetteAlerts > 0 && <span> • </span>}
                  {vignetteAlerts > 0 && (
                    <span>
                      {vignetteAlerts} {vignetteAlerts === 1 ? 'rovinieta expiră' : 'roviniete expiră'} în următoarele 30 zile
                    </span>
                  )}
                </p>
              </div>
              <div className="mt-3">
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-orange-800 hover:text-orange-900 underline"
                >
                  Vezi detalii pe Dashboard →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Cards */}
      {filteredVehicles && filteredVehicles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map((vehicle) => {
            const statusBadge = getStatusBadge(vehicle.status)
            const StatusIcon = statusBadge.icon

            return (
              <Link
                key={vehicle.id}
                to={`/vehicles/${vehicle.id}`}
                className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Vehicle Image */}
                <div className="aspect-video bg-gray-100 relative">
                  {vehicle.image_url ? (
                    <img
                      src={vehicle.image_url}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Car className="w-16 h-16 text-gray-300" />
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                      <StatusIcon className="w-4 h-4 mr-1" />
                      {statusBadge.label}
                    </span>
                  </div>
                </div>

                {/* Vehicle Info */}
                <div className="p-5">
                  {/* Brand and Model */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {vehicle.brand} {vehicle.model}
                  </h3>
                  
                  {/* Registration Number */}
                  <p className="text-sm text-gray-500 mb-3 font-mono font-semibold">
                    {vehicle.registration_number}
                  </p>

                  {/* Details Grid */}
                  <div className="space-y-2">
                    {/* Year and Fuel */}
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                      <span>{vehicle.year}</span>
                      <span className="mx-2">•</span>
                      <span>{getFuelTypeLabel(vehicle.fuel_type)}</span>
                    </div>

                    {/* Mileage */}
                    {vehicle.current_mileage && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Gauge className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{vehicle.current_mileage?.toLocaleString()} km</span>
                      </div>
                    )}

                    {/* Assigned To */}
                    {vehicle.assigned_user && (
                      <div className="flex items-center text-sm text-gray-600">
                        <User className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="truncate">{vehicle.assigned_user.full_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Car className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">{t('vehicles.noVehicles')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('common.tryAdjustingFilters')}</p>
          {canCreate && searchTerm === '' && statusFilter === 'all' && (
            <div className="mt-6">
              <Link
                to="/vehicles/new"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                {t('vehicles.new')}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
