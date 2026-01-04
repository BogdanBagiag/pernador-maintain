import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function LocationForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isEditMode = Boolean(id)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    building: '',
    floor: '',
    room: '',
    is_active: true,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Fetch location if editing
  const { data: location, isLoading: isLoadingLocation } = useQuery({
    queryKey: ['location', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: isEditMode,
  })

  useEffect(() => {
    if (location) {
      setFormData({
        name: location.name || '',
        description: location.description || '',
        address: location.address || '',
        building: location.building || '',
        floor: location.floor || '',
        room: location.room || '',
        is_active: location.is_active ?? true,
      })
    }
  }, [location])

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormData({
      ...formData,
      [e.target.name]: value,
    })
  }

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase
        .from('locations')
        .insert([{ ...data, created_by: user.id }])
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      navigate('/locations')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase
        .from('locations')
        .update(data)
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      queryClient.invalidateQueries({ queryKey: ['location', id] })
      navigate('/locations')
    },
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!formData.name.trim()) {
        setError('Location name is required')
        setLoading(false)
        return
      }

      if (isEditMode) {
        await updateMutation.mutateAsync(formData)
      } else {
        await createMutation.mutateAsync(formData)
      }
    } catch (err) {
      setError(err.message || 'Failed to save location')
      setLoading(false)
    }
  }

  if (isEditMode && isLoadingLocation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <button
          onClick={() => navigate('/locations')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Locations
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? 'Edit Location' : 'Add Location'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEditMode ? 'Update location information' : 'Add a new location to your facility'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <div className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Location Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              className="input"
              placeholder="e.g., Production Hall A"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="input"
              placeholder="Brief description of this location..."
            />
          </div>

          {/* Building */}
          <div>
            <label htmlFor="building" className="block text-sm font-medium text-gray-700 mb-1">
              Building
            </label>
            <input
              id="building"
              name="building"
              type="text"
              value={formData.building}
              onChange={handleChange}
              className="input"
              placeholder="e.g., Main Building, Warehouse 2"
            />
          </div>

          {/* Floor and Room */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="floor" className="block text-sm font-medium text-gray-700 mb-1">
                Floor
              </label>
              <input
                id="floor"
                name="floor"
                type="text"
                value={formData.floor}
                onChange={handleChange}
                className="input"
                placeholder="e.g., Ground Floor, 2nd Floor"
              />
            </div>

            <div>
              <label htmlFor="room" className="block text-sm font-medium text-gray-700 mb-1">
                Room
              </label>
              <input
                id="room"
                name="room"
                type="text"
                value={formData.room}
                onChange={handleChange}
                className="input"
                placeholder="e.g., Room 201, Lab A"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              id="address"
              name="address"
              rows={2}
              value={formData.address}
              onChange={handleChange}
              className="input"
              placeholder="Full address of this location..."
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              checked={formData.is_active}
              onChange={handleChange}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
              Active location (available for equipment assignment)
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/locations')}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary inline-flex items-center"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {isEditMode ? 'Update Location' : 'Add Location'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
