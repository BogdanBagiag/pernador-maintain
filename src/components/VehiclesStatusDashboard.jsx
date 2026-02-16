import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { AlertTriangle, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function VehiclesStatusDashboard() {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(true)

  // Fetch vehicles with all related data
  const { data: vehiclesData, isLoading } = useQuery({
    queryKey: ['vehicles-status-dashboard'],
    queryFn: async () => {
      // Fetch vehicles - exclude vehiculele retrase și vândute (nu mai circulă)
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, brand, model, registration_number, vehicle_type, status')
        .not('status', 'in', '(retired,sold)')  // Exclude retrase și vândute
        .order('brand', { ascending: true })
      
      if (vehiclesError) throw vehiclesError

      // Fetch all insurances
      const { data: insurances, error: insurancesError } = await supabase
        .from('vehicle_insurances')
        .select('vehicle_id, insurance_type, end_date, is_active')
      
      if (insurancesError) throw insurancesError

      // Fetch all vignettes
      const { data: vignettes, error: vignettesError } = await supabase
        .from('vehicle_vignettes')
        .select('vehicle_id, end_date, is_active')
      
      if (vignettesError) throw vignettesError

      // Fetch all ITP records
      const { data: itpRecords, error: itpError } = await supabase
        .from('vehicle_itp')
        .select('vehicle_id, expiry_date, result, is_active')
      
      if (itpError) throw itpError

      // Fetch all revisions
      const { data: revisions, error: revisionsError } = await supabase
        .from('vehicle_revisions')
        .select('vehicle_id, revision_date, next_revision_date, next_revision_km')
      
      if (revisionsError) throw revisionsError

      // Combine data
      return vehicles.map(vehicle => {
        const vehicleInsurances = insurances.filter(i => i.vehicle_id === vehicle.id)
        const vehicleVignettes = vignettes.filter(v => v.vehicle_id === vehicle.id)
        const vehicleITP = itpRecords.filter(i => i.vehicle_id === vehicle.id)
        const vehicleRevisions = revisions.filter(r => r.vehicle_id === vehicle.id)

        return {
          ...vehicle,
          insurances: vehicleInsurances,
          vignettes: vehicleVignettes,
          itp: vehicleITP,
          revisions: vehicleRevisions
        }
      })
    },
    refetchInterval: 60000 // Refresh every minute
  })

  const getStatusBadge = (status) => {
    const badges = {
      ok: { icon: CheckCircle, color: 'text-green-600 bg-green-50', label: 'OK' },
      warning: { icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-50', label: 'Atenție' },
      expired: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Expirat' },
      missing: { icon: Clock, color: 'text-gray-600 bg-gray-50', label: 'Lipsă' }
    }
    return badges[status] || badges.missing
  }

  const checkExpiry = (date) => {
    if (!date) return 'missing'
    const today = new Date()
    const expiryDate = new Date(date)
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
    
    if (daysUntilExpiry < 0) return 'expired'
    if (daysUntilExpiry <= 30) return 'warning'
    return 'ok'
  }

  const analyzeVehicle = (vehicle) => {
    const issues = []
    let overallStatus = 'ok'

    // Check Insurance (RCA + CASCO)
    const activeRCA = vehicle.insurances.find(i => i.is_active && i.insurance_type === 'rca')
    const activeCASCO = vehicle.insurances.find(i => i.is_active && i.insurance_type === 'casco')
    
    const rcaStatus = activeRCA ? checkExpiry(activeRCA.end_date) : 'missing'
    const cascoStatus = activeCASCO ? checkExpiry(activeCASCO.end_date) : 'missing'

    if (rcaStatus === 'expired' || rcaStatus === 'missing') {
      issues.push({ type: 'RCA', status: rcaStatus, date: activeRCA?.end_date })
      overallStatus = 'expired'
    } else if (rcaStatus === 'warning') {
      issues.push({ type: 'RCA', status: 'warning', date: activeRCA?.end_date })
      if (overallStatus !== 'expired') overallStatus = 'warning'
    }

    // Check Vignette (doar pentru autovehicule)
    if (vehicle.vehicle_type !== 'remorca') {
      const activeVignette = vehicle.vignettes.find(v => v.is_active)
      const vignetteStatus = activeVignette ? checkExpiry(activeVignette.end_date) : 'missing'
      
      if (vignetteStatus === 'expired' || vignetteStatus === 'missing') {
        issues.push({ type: 'Rovinietă', status: vignetteStatus, date: activeVignette?.end_date })
        overallStatus = 'expired'
      } else if (vignetteStatus === 'warning') {
        issues.push({ type: 'Rovinietă', status: 'warning', date: activeVignette?.end_date })
        if (overallStatus !== 'expired') overallStatus = 'warning'
      }
    }

    // Check ITP
    const activeITP = vehicle.itp.find(i => i.is_active)
    const itpStatus = activeITP ? checkExpiry(activeITP.expiry_date) : 'missing'
    
    if (itpStatus === 'expired' || itpStatus === 'missing') {
      issues.push({ type: 'ITP', status: itpStatus, date: activeITP?.expiry_date })
      overallStatus = 'expired'
    } else if (itpStatus === 'warning') {
      issues.push({ type: 'ITP', status: 'warning', date: activeITP?.expiry_date })
      if (overallStatus !== 'expired') overallStatus = 'warning'
    }

    return { overallStatus, issues, vehicle }
  }

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!vehiclesData || vehiclesData.length === 0) {
    return null
  }

  const analyzedVehicles = vehiclesData.map(analyzeVehicle)
  const criticalVehicles = analyzedVehicles.filter(v => v.overallStatus === 'expired')
  const warningVehicles = analyzedVehicles.filter(v => v.overallStatus === 'warning')
  const okVehicles = analyzedVehicles.filter(v => v.overallStatus === 'ok')

  return (
    <div className="bg-white shadow rounded-lg mb-6">
      {/* Header */}
      <div 
        className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Raport Status Vehicule</h2>
            <p className="text-sm text-gray-500 mt-1">
              {criticalVehicles.length > 0 && (
                <span className="text-red-600 font-medium">
                  {criticalVehicles.length} vehicul{criticalVehicles.length !== 1 ? 'e' : ''} cu probleme critice
                </span>
              )}
              {criticalVehicles.length > 0 && warningVehicles.length > 0 && ' • '}
              {warningVehicles.length > 0 && (
                <span className="text-yellow-600 font-medium">
                  {warningVehicles.length} vehicul{warningVehicles.length !== 1 ? 'e' : ''} cu avertizări
                </span>
              )}
              {criticalVehicles.length === 0 && warningVehicles.length === 0 && (
                <span className="text-green-600 font-medium">
                  Toate vehiculele sunt în regulă
                </span>
              )}
              <span className="text-gray-400 ml-2">
                • Exclude vehicule retrase/vândute
              </span>
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Summary badges */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-red-600">{criticalVehicles.length}</span>
              </div>
              <div className="flex items-center space-x-1">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-600">{warningVehicles.length}</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-600">{okVehicles.length}</span>
              </div>
            </div>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-6">
          {/* Critical vehicles */}
          {criticalVehicles.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-red-900 mb-3 flex items-center">
                <XCircle className="w-4 h-4 mr-2" />
                Probleme Critice ({criticalVehicles.length})
              </h3>
              <div className="space-y-2">
                {criticalVehicles.map(({ vehicle, issues }) => (
                  <Link
                    key={vehicle.id}
                    to={`/vehicles/${vehicle.id}`}
                    className="block border border-red-200 rounded-lg p-4 hover:border-red-300 hover:bg-red-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">
                            {vehicle.brand} {vehicle.model}
                          </h4>
                          <span className="text-sm text-gray-500 font-mono">
                            {vehicle.registration_number}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {issues.map((issue, idx) => {
                            const badge = getStatusBadge(issue.status)
                            const Icon = badge.icon
                            return (
                              <span
                                key={idx}
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
                              >
                                <Icon className="w-3 h-3 mr-1" />
                                {issue.type}: {badge.label}
                                {issue.date && issue.status === 'expired' && (
                                  <span className="ml-1">
                                    (expirat {new Date(issue.date).toLocaleDateString('ro-RO')})
                                  </span>
                                )}
                                {issue.date && issue.status === 'warning' && (
                                  <span className="ml-1">
                                    ({Math.ceil((new Date(issue.date) - new Date()) / (1000 * 60 * 60 * 24))} zile)
                                  </span>
                                )}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Warning vehicles */}
          {warningVehicles.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-yellow-900 mb-3 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Avertizări ({warningVehicles.length})
              </h3>
              <div className="space-y-2">
                {warningVehicles.map(({ vehicle, issues }) => (
                  <Link
                    key={vehicle.id}
                    to={`/vehicles/${vehicle.id}`}
                    className="block border border-yellow-200 rounded-lg p-4 hover:border-yellow-300 hover:bg-yellow-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">
                            {vehicle.brand} {vehicle.model}
                          </h4>
                          <span className="text-sm text-gray-500 font-mono">
                            {vehicle.registration_number}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {issues.map((issue, idx) => {
                            const badge = getStatusBadge(issue.status)
                            const Icon = badge.icon
                            return (
                              <span
                                key={idx}
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
                              >
                                <Icon className="w-3 h-3 mr-1" />
                                {issue.type}: 
                                {issue.date && (
                                  <span className="ml-1">
                                    {Math.ceil((new Date(issue.date) - new Date()) / (1000 * 60 * 60 * 24))} zile
                                  </span>
                                )}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* OK vehicles */}
          {okVehicles.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-green-900 mb-3 flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                În Regulă ({okVehicles.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {okVehicles.map(({ vehicle }) => (
                  <Link
                    key={vehicle.id}
                    to={`/vehicles/${vehicle.id}`}
                    className="border border-green-200 rounded-lg p-3 hover:border-green-300 hover:bg-green-50 transition-colors"
                  >
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {vehicle.brand} {vehicle.model}
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-1">
                        {vehicle.registration_number}
                      </div>
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Totul este OK
                        </span>
                      </div>
                    </div>
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
