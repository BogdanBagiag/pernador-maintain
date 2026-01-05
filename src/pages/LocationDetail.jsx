import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Edit, MapPin, Building, Trash2, AlertTriangle, Wrench } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import QRCodeGenerator from '../components/QRCodeGenerator'

export default function LocationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  // Check permissions
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'
  const canDelete = profile?.role === 'admin'

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      navigate('/locations')
    },
  })

  const handleDelete = () => {
    if (window.confirm('Sigur vrei să ștergi această locație? Această acțiune nu poate fi anulată.')) {
      deleteMutation.mutate()
    }
  }

  // Fetch location
  const { data: location, isLoading } = useQuery({
    queryKey: ['location', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
  })

  // Fetch equipment in this location
  const { data: equipment } = useQuery({
    queryKey: ['location-equipment', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('location_id', id)
        .order('name')
      
      if (error) throw error
      return data
    },
  })

  // Fetch issues for this location
  const { data: issues } = useQuery({
    queryKey: ['location-issues', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issues')
        .select(`
          *,
          reported_by:profiles!issues_reported_by_fkey(full_name)
        `)
        .eq('location_id', id)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) throw error
      return data
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!location) {
    return (
      <div className="card text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Locație negăsită
        </h3>
        <button onClick={() => navigate('/locations')} className="btn-primary">
          Înapoi la Locații
        </button>
      </div>
    )
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'badge-warning'
      case 'in_progress':
        return 'badge-info'
      case 'resolved':
        return 'badge-success'
      default:
        return 'badge-secondary'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        {/* Back Button */}
        <button
          onClick={() => navigate('/locations')}
          className="btn-secondary mb-4 inline-flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Înapoi
        </button>

        {/* Title */}
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{location.name}</h1>
          <div className="flex items-center gap-2 text-gray-600 text-sm sm:text-base">
            <Building className="w-4 h-4 flex-shrink-0" />
            <span>{location.building}</span>
            {location.floor && <span>• Etaj {location.floor}</span>}
            {location.room && <span>• Camera {location.room}</span>}
          </div>
        </div>
        
        {/* Action Buttons - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            to={`/report-issue?location=${id}`}
            className="btn-secondary flex-1 sm:flex-none inline-flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="whitespace-nowrap">Raportează Problemă</span>
          </Link>
          
          <div className="flex gap-2">
            {canEdit && (
              <Link
                to={`/locations/${id}/edit`}
                className="btn-secondary flex-1 sm:flex-none inline-flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                <span>Editează</span>
              </Link>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="btn-danger flex-1 sm:flex-none inline-flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Șterge</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalii Locație</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-600">Nume</dt>
                <dd className="text-base font-medium text-gray-900">{location.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Clădire</dt>
                <dd className="text-base font-medium text-gray-900">{location.building || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Etaj</dt>
                <dd className="text-base font-medium text-gray-900">{location.floor || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Cameră</dt>
                <dd className="text-base font-medium text-gray-900">{location.room || '-'}</dd>
              </div>
              {location.address && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-gray-600">Adresă</dt>
                  <dd className="text-base font-medium text-gray-900">{location.address}</dd>
                </div>
              )}
              {location.description && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-gray-600">Descriere</dt>
                  <dd className="text-base text-gray-700">{location.description}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Equipment in Location */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Echipamente ({equipment?.length || 0})
              </h2>
            </div>
            {equipment && equipment.length > 0 ? (
              <div className="space-y-2">
                {equipment.map((item) => (
                  <Link
                    key={item.id}
                    to={`/equipment/${item.id}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Wrench className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{item.name}</p>
                        <p className="text-sm text-gray-600 truncate">{item.serial_number}</p>
                      </div>
                    </div>
                    <span className={`badge ${item.status === 'operational' ? 'badge-success' : 'badge-warning'} whitespace-nowrap ml-2`}>
                      {item.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">
                Niciun echipament în această locație
              </p>
            )}
          </div>

          {/* Recent Issues */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Probleme Raportate ({issues?.length || 0})
              </h2>
            </div>
            {issues && issues.length > 0 ? (
              <div className="space-y-2">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`badge ${getStatusColor(issue.status)}`}>
                          {issue.status}
                        </span>
                        <span className={`badge ${issue.priority === 'high' ? 'badge-error' : 'badge-secondary'}`}>
                          {issue.priority}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900 break-words">{issue.title}</p>
                      <p className="text-sm text-gray-600 break-words">
                        Raportată de {issue.reported_by?.full_name || 'Unknown'} • {new Date(issue.created_at).toLocaleDateString('ro-RO')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">
                Nicio problemă raportată
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* QR Code */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">QR Code Locație</h2>
            <QRCodeGenerator 
              id={location.id} 
              name={location.name}
              type="location"
            />
            <p className="text-sm text-gray-600 mt-4">
              Scanează acest cod QR pentru a raporta rapid probleme din această locație.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
