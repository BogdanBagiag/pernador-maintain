import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { Plus, Search, MapPin, Edit, Trash2, Building } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function LocationsList() {
  const { t } = useLanguage()
  const [searchTerm, setSearchTerm] = useState('')
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  // Check permissions
  const canCreateEdit = profile?.role === 'admin' || profile?.role === 'manager'
  const canDelete = profile?.role === 'admin'

  // Fetch locations
  const { data: locations, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name', { ascending: true })
      
      if (error) throw error
      return data
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
  })

  const handleDelete = async (id, name) => {
    if (window.confirm(`${t('locations.deleteConfirm')} "${name}"?`)) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (error) {
        alert('Error deleting location: ' + error.message)
      }
    }
  }

  // Filter locations
  const filteredLocations = locations?.filter((location) =>
    location.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.building?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.address?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('locations.title')}</h1>
          <p className="text-gray-600 mt-1">
            {t('locations.subtitle')}
          </p>
        </div>
        {canCreateEdit && (
          <Link
            to="/locations/new"
            className="btn-primary mt-4 sm:mt-0 inline-flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('locations.add')}
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder={t('locations.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Locations List */}
      {!filteredLocations || filteredLocations.length === 0 ? (
        <div className="card text-center py-12">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? t('locations.noLocations') : t('locations.noLocationsYet')}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm
              ? t('locations.tryAdjustingSearch')
              : t('locations.getStarted')}
          </p>
          {!searchTerm && (
            <Link to="/locations/new" className="btn-primary inline-flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              {t('locations.add')}
            </Link>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLocations.map((location) => (
            <Link 
              key={location.id} 
              to={`/locations/${location.id}`}
              className="card hover:shadow-lg transition-shadow block"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                    <Building className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {location.name}
                    </h3>
                    {location.building && (
                      <p className="text-sm text-gray-600">
                        {location.building}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {location.description && (
                <p className="text-sm text-gray-600 mb-3">
                  {location.description}
                </p>
              )}

              {location.address && (
                <div className="flex items-start text-sm text-gray-600 mb-2">
                  <MapPin className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                  <span>{location.address}</span>
                </div>
              )}

              {(location.floor || location.room) && (
                <div className="text-sm text-gray-600 mb-4">
                  {location.floor && `${t('locations.floor')}: ${location.floor}`}
                  {location.floor && location.room && ' • '}
                  {location.room && `${t('locations.room')}: ${location.room}`}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-gray-200">
                {canCreateEdit && (
                  <Link
                    to={`/locations/${location.id}/edit`}
                    className="text-primary-600 hover:text-primary-700 p-2 relative z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                )}
                {canDelete && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDelete(location.id, location.name)
                    }}
                    className="text-red-600 hover:text-red-700 p-2 relative z-10"
                    disabled={deleteMutation.isLoading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
