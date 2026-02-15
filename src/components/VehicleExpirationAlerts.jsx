import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { Link } from 'react-router-dom'
import { AlertTriangle, Shield, Ticket, Car, Calendar, ChevronRight } from 'lucide-react'

export default function VehicleExpirationAlerts() {
  const { t } = useLanguage()

  // Fetch vehicles with expiring insurance and vignettes
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['vehicle-expiration-alerts'],
    queryFn: async () => {
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      const thirtyDaysISO = thirtyDaysFromNow.toISOString().split('T')[0]

      const today = new Date().toISOString().split('T')[0]

      // Fetch expiring insurance (active only, expiring in next 30 days)
      const { data: insuranceData, error: insuranceError } = await supabase
        .from('vehicle_insurance')
        .select(`
          id,
          insurance_type,
          insurance_company,
          end_date,
          vehicle:vehicles!vehicle_insurance_vehicle_id_fkey(
            id,
            brand,
            model,
            registration_number
          )
        `)
        .eq('is_active', true)
        .gte('end_date', today)
        .lte('end_date', thirtyDaysISO)
        .order('end_date', { ascending: true })

      if (insuranceError) throw insuranceError

      // Fetch expiring vignettes (active only, expiring in next 30 days)
      const { data: vignetteData, error: vignetteError } = await supabase
        .from('vehicle_vignettes')
        .select(`
          id,
          vignette_type,
          end_date,
          vehicle:vehicles!vehicle_vignettes_vehicle_id_fkey(
            id,
            brand,
            model,
            registration_number
          )
        `)
        .eq('is_active', true)
        .gte('end_date', today)
        .lte('end_date', thirtyDaysISO)
        .order('end_date', { ascending: true })

      if (vignetteError) throw vignetteError

      return {
        insurance: insuranceData || [],
        vignettes: vignetteData || []
      }
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  })

  // Calculate days until expiry
  const getDaysUntilExpiry = (endDate) => {
    const days = Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))
    return days
  }

  // Get urgency level
  const getUrgencyLevel = (days) => {
    if (days <= 7) return 'critical' // Red
    if (days <= 14) return 'high'     // Orange
    return 'medium'                    // Yellow
  }

  // Get urgency badge
  const getUrgencyBadge = (days) => {
    const level = getUrgencyLevel(days)
    const badges = {
      critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
      high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' }
    }
    return badges[level]
  }

  const totalAlerts = (alerts?.insurance?.length || 0) + (alerts?.vignettes?.length || 0)

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-100 rounded"></div>
            <div className="h-16 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (totalAlerts === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-gray-400" />
            Alerte Expirări Mașini
          </h2>
        </div>
        <div className="text-center py-8 text-gray-500">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="w-8 h-8 text-green-600" />
          </div>
          <p className="font-medium text-gray-900">Totul este în regulă!</p>
          <p className="text-sm mt-1">Nu există asigurări sau roviniete care expiră în următoarele 30 zile.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
            Alerte Expirări Mașini
          </h2>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            {totalAlerts} {totalAlerts === 1 ? 'alertă' : 'alerte'}
          </span>
        </div>
      </div>

      {/* Alerts List */}
      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {/* Insurance Alerts */}
        {alerts.insurance.map((item) => {
          const days = getDaysUntilExpiry(item.end_date)
          const urgency = getUrgencyBadge(days)

          return (
            <Link
              key={`insurance-${item.id}`}
              to={`/vehicles/${item.vehicle.id}`}
              className="block p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className={`p-2 rounded-lg ${urgency.bg}`}>
                    <Shield className={`w-5 h-5 ${urgency.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.vehicle.brand} {item.vehicle.model}
                      </p>
                      <span className="text-xs text-gray-500 font-mono">
                        {item.vehicle.registration_number}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="text-gray-600">
                        {item.insurance_type.toUpperCase()} - {item.insurance_company}
                      </span>
                    </div>
                    <div className="flex items-center mt-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3 mr-1" />
                      Expiră: {new Date(item.end_date).toLocaleDateString('ro-RO')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 ml-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${urgency.bg} ${urgency.text} ${urgency.border} border`}>
                    {days} {days === 1 ? 'zi' : 'zile'}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </Link>
          )
        })}

        {/* Vignette Alerts */}
        {alerts.vignettes.map((item) => {
          const days = getDaysUntilExpiry(item.end_date)
          const urgency = getUrgencyBadge(days)

          return (
            <Link
              key={`vignette-${item.id}`}
              to={`/vehicles/${item.vehicle.id}`}
              className="block p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className={`p-2 rounded-lg ${urgency.bg}`}>
                    <Ticket className={`w-5 h-5 ${urgency.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.vehicle.brand} {item.vehicle.model}
                      </p>
                      <span className="text-xs text-gray-500 font-mono">
                        {item.vehicle.registration_number}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="text-gray-600">
                        Rovinieta {t(`vehicles.${item.vignette_type}`)}
                      </span>
                    </div>
                    <div className="flex items-center mt-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3 mr-1" />
                      Expiră: {new Date(item.end_date).toLocaleDateString('ro-RO')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 ml-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${urgency.bg} ${urgency.text} ${urgency.border} border`}>
                    {days} {days === 1 ? 'zi' : 'zile'}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <Link
          to="/vehicles"
          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center"
        >
          <Car className="w-4 h-4 mr-2" />
          Vezi toate mașinile
        </Link>
      </div>
    </div>
  )
}
