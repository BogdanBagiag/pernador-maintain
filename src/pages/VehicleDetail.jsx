import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { 
  ArrowLeft, Edit, Trash2, Car, Calendar, Gauge, User, DollarSign,
  Settings, FileText, Shield, Ticket, Wrench
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import VehicleDocumentsSection from '../components/VehicleDocumentsSection'
import VehicleInsuranceSection from '../components/VehicleInsuranceSection'
import VehicleVignetteSection from '../components/VehicleVignetteSection'
import VehicleITPSection from '../components/VehicleITPSection'
import VehicleRevisionsSection from '../components/VehicleRevisionsSection'
import VehicleRepairsSection from '../components/VehicleRepairsSection'

export default function VehicleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const { t } = useLanguage()

  const [activeTab, setActiveTab] = useState('details')

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'
  const canDelete = profile?.role === 'admin'

  // Fetch vehicle with assigned user
  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          assigned_user:assigned_to(id, full_name, email)
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
  })

  // Resetează tab-ul dacă este pe 'vignette' și vehiculul este remorcă
  useEffect(() => {
    if (vehicle?.vehicle_type === 'remorca' && activeTab === 'vignette') {
      setActiveTab('details')
    }
  }, [vehicle?.vehicle_type, activeTab])

  // Fetch vehicle documents
  const { data: documents, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['vehicle-documents', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_documents')
        .select('*')
        .eq('vehicle_id', id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
  })

  // Fetch vehicle insurance
  const { data: insurance, isLoading: isLoadingInsurance } = useQuery({
    queryKey: ['vehicle-insurance', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_insurances')
        .select('*')
        .eq('vehicle_id', id)
        .order('is_active', { ascending: false })  // Active first
        .order('end_date', { ascending: false })    // Then by end_date descending
      
      if (error) throw error
      return data
    },
  })

  // Fetch vehicle vignettes
  const { data: vignettes, isLoading: isLoadingVignettes } = useQuery({
    queryKey: ['vehicle-vignettes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_vignettes')
        .select('*')
        .eq('vehicle_id', id)
        .order('is_active', { ascending: false })  // Active first
        .order('end_date', { ascending: false })    // Then by end_date descending
      
      if (error) throw error
      return data
    },
  })

  // Fetch vehicle ITP records
  const { data: itpRecords, isLoading: isLoadingITP } = useQuery({
    queryKey: ['vehicle-itp', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_itp')
        .select('*')
        .eq('vehicle_id', id)
        .order('is_active', { ascending: false })  // Active first
        .order('expiry_date', { ascending: false })  // Then by expiry_date descending
      
      if (error) throw error
      return data
    },
  })

  // Fetch vehicle revisions
  const { data: revisions, isLoading: isLoadingRevisions } = useQuery({
    queryKey: ['vehicle-revisions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_revisions')
        .select('*')
        .eq('vehicle_id', id)
        .order('revision_date', { ascending: false })
      
      if (error) throw error
      return data
    },
  })

  // Fetch vehicle repairs
  const { data: repairs, isLoading: isLoadingRepairs } = useQuery({
    queryKey: ['vehicle-repairs', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_repairs')
        .select('*')
        .eq('vehicle_id', id)
        .order('repair_date', { ascending: false })
      
      if (error) throw error
      return data
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      navigate('/vehicles')
    },
  })

  const handleDelete = () => {
    if (window.confirm(`Sigur ștergi mașina ${vehicle?.brand} ${vehicle?.model} (${vehicle?.registration_number})?`)) {
      deleteMutation.mutate()
    }
  }

  // Get status badge
  const getStatusBadge = (status) => {
    const badges = {
      operational: { bg: 'bg-green-100', text: 'text-green-800', label: t('vehicles.operational') },
      in_service: { bg: 'bg-blue-100', text: 'text-blue-800', label: t('vehicles.inService') },
      broken: { bg: 'bg-red-100', text: 'text-red-800', label: t('vehicles.broken') },
      sold: { bg: 'bg-gray-100', text: 'text-gray-800', label: t('vehicles.sold') },
      retired: { bg: 'bg-gray-100', text: 'text-gray-800', label: t('vehicles.retired') }
    }
    return badges[status] || badges.operational
  }

  // Get fuel type label
  const getFuelTypeLabel = (fuelType) => {
    return t(`vehicles.${fuelType}`) || fuelType
  }

  // Get transmission label
  const getTransmissionLabel = (transmission) => {
    return t(`vehicles.${transmission}`) || transmission
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="max-w-7xl mx-auto text-center py-12">
        <Car className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Mașina nu a fost găsită</h3>
        <Link to="/vehicles" className="mt-4 inline-flex items-center text-primary-600 hover:text-primary-700">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Înapoi la Mașini
        </Link>
      </div>
    )
  }

  const statusBadge = getStatusBadge(vehicle.status)
  
  // Tabs - exclude Roviniete pentru remorci (nu au nevoie de roviniete)
  const allTabs = [
    { id: 'details', name: 'Detalii', icon: Settings },
    { id: 'documents', name: t('vehicles.documents'), icon: FileText },
    { id: 'insurance', name: t('vehicles.insurance'), icon: Shield },
    { id: 'vignette', name: t('vehicles.vignette'), icon: Ticket },
    { id: 'itp', name: t('vehicles.itp'), icon: Settings },
    { id: 'revisions', name: t('vehicles.revisions'), icon: Settings },
    { id: 'repairs', name: t('vehicles.repairs'), icon: Wrench }
  ]
  
  // Filtrează roviniete pentru remorci
  const tabs = vehicle.vehicle_type === 'remorca' 
    ? allTabs.filter(tab => tab.id !== 'vignette')
    : allTabs
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link to="/vehicles" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            {/* Vehicle Image */}
            {vehicle.image_url ? (
              <img
                src={vehicle.image_url}
                alt={`${vehicle.brand} ${vehicle.model}`}
                className="w-32 h-32 object-cover rounded-lg"
              />
            ) : (
              <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                <Car className="w-16 h-16 text-gray-300" />
              </div>
            )}

            {/* Vehicle Info */}
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {vehicle.brand} {vehicle.model}
                </h1>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                  {statusBadge.label}
                </span>
              </div>
              <p className="text-lg text-gray-600 font-mono font-semibold mb-2">
                {vehicle.registration_number}
              </p>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                {vehicle.year && (
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    <span>{vehicle.year}</span>
                  </div>
                )}
                {vehicle.fuel_type && (
                  <span>• {getFuelTypeLabel(vehicle.fuel_type)}</span>
                )}
                {vehicle.transmission && (
                  <span>• {getTransmissionLabel(vehicle.transmission)}</span>
                )}
                {vehicle.current_mileage && (
                  <div className="flex items-center">
                    <Gauge className="w-4 h-4 mr-1 ml-2" />
                    <span>{vehicle.current_mileage.toLocaleString()} km</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {(canEdit || canDelete) && (
            <div className="flex items-center space-x-3">
              {canEdit && (
                <Link
                  to={`/vehicles/${id}/edit`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {t('common.edit')}
                </Link>
              )}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('common.delete')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                    isActive
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>
      </div>
      {/* Tab Content */}
      <div className="space-y-6">
        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* General Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Car className="w-5 h-5 mr-2 text-primary-600" />
                Informații Generale
              </h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Marcă</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-semibold">{vehicle.brand}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Model</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-semibold">{vehicle.model}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Număr Înmatriculare</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono font-bold tracking-wider">{vehicle.registration_number}</dd>
                </div>
                {vehicle.vehicle_type && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Tip Vehicul</dt>
                    <dd className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        vehicle.vehicle_type === 'autovehicul' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {t(`vehicles.${vehicle.vehicle_type}`)}
                      </span>
                    </dd>
                  </div>
                )}
                {vehicle.year && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">An Fabricație</dt>
                    <dd className="mt-1 text-sm text-gray-900 flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                      {vehicle.year}
                    </dd>
                  </div>
                )}
                {vehicle.color && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">{t('vehicles.color')}</dt>
                    <dd className="mt-1 text-sm text-gray-900">{vehicle.color}</dd>
                  </div>
                )}
                {vehicle.vin && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">VIN</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">{vehicle.vin}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Technical Specifications - doar pentru autovehicule */}
            {vehicle.vehicle_type === 'autovehicul' && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-primary-600" />
                  Specificații Tehnice
                </h2>
                <dl className="space-y-3">
                  {vehicle.engine_capacity && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">{t('vehicles.engineCapacity')}</dt>
                      <dd className="mt-1 text-sm text-gray-900 font-semibold">{vehicle.engine_capacity} cmc</dd>
                    </div>
                  )}
                  {vehicle.power_hp && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">{t('vehicles.powerHP')}</dt>
                      <dd className="mt-1 text-sm text-gray-900 font-semibold">{vehicle.power_hp} CP</dd>
                    </div>
                  )}
                  {vehicle.fuel_type && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">{t('vehicles.fuelType')}</dt>
                      <dd className="mt-1 text-sm text-gray-900">{getFuelTypeLabel(vehicle.fuel_type)}</dd>
                    </div>
                  )}
                  {vehicle.transmission && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">{t('vehicles.transmission')}</dt>
                      <dd className="mt-1 text-sm text-gray-900">{getTransmissionLabel(vehicle.transmission)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Mileage & Status */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Gauge className="w-5 h-5 mr-2 text-primary-600" />
                Kilometraj & Status
              </h2>
              <dl className="space-y-3">
                {vehicle.current_mileage && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">{t('vehicles.currentMileage')}</dt>
                    <dd className="mt-1 text-sm text-gray-900 flex items-center">
                      <Gauge className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="font-semibold">{vehicle.current_mileage.toLocaleString()} km</span>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t('vehicles.status')}</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                      {statusBadge.label}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Assignment & Purchase */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-primary-600" />
                Asignare & Achiziție
              </h2>
              <dl className="space-y-3">
                {vehicle.assigned_user && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">{t('vehicles.assignedTo')}</dt>
                    <dd className="mt-1 text-sm text-gray-900 flex items-center">
                      <User className="w-4 h-4 mr-2 text-gray-400" />
                      {vehicle.assigned_user.full_name || vehicle.assigned_user.email}
                    </dd>
                  </div>
                )}
                {vehicle.department && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">{t('vehicles.department')}</dt>
                    <dd className="mt-1 text-sm text-gray-900">{vehicle.department}</dd>
                  </div>
                )}
                {vehicle.purchase_date && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">{t('vehicles.purchaseDate')}</dt>
                    <dd className="mt-1 text-sm text-gray-900 flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                      {new Date(vehicle.purchase_date).toLocaleDateString('ro-RO')}
                    </dd>
                  </div>
                )}
                {vehicle.purchase_price && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">{t('vehicles.purchasePrice')}</dt>
                    <dd className="mt-1 text-sm text-gray-900 flex items-center">
                      <DollarSign className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="font-semibold">{vehicle.purchase_price.toLocaleString()} RON</span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Notes */}
            {vehicle.notes && (
              <div className="bg-white shadow rounded-lg p-6 lg:col-span-2">
                <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-primary-600" />
                  {t('vehicles.notes')}
                </h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded">{vehicle.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <VehicleDocumentsSection
            vehicleId={id}
            documents={documents}
            isLoading={isLoadingDocuments}
          />
        )}

        {/* Insurance Tab */}
        {activeTab === 'insurance' && (
          <VehicleInsuranceSection
            vehicleId={id}
            insurance={insurance}
            isLoading={isLoadingInsurance}
          />
        )}

        {/* Vignette Tab - doar pentru autovehicule (remorcile nu au roviniete) */}
        {activeTab === 'vignette' && vehicle.vehicle_type !== 'remorca' && (
          <VehicleVignetteSection
            vehicleId={id}
            vignettes={vignettes}
            isLoading={isLoadingVignettes}
          />
        )}

        {/* ITP Tab */}
        {activeTab === 'itp' && (
          <VehicleITPSection
            vehicleId={id}
            itpRecords={itpRecords}
            isLoading={isLoadingITP}
          />
        )}

        {/* Revisions Tab */}
        {activeTab === 'revisions' && (
          <VehicleRevisionsSection
            vehicleId={id}
            revisions={revisions}
            isLoading={isLoadingRevisions}
          />
        )}

        {/* Repairs Tab */}
        {activeTab === 'repairs' && (
          <VehicleRepairsSection
            vehicleId={id}
            repairs={repairs}
            isLoading={isLoadingRepairs}
          />
        )}
      </div>
    </div>
  )
}
