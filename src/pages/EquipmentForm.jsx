import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function EquipmentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isEditMode = Boolean(id)

  const [formData, setFormData] = useState({
    name: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    inventory_number: '',
    location_id: '',
    purchase_date: '',
    warranty_months: '',
    description: '',
    status: 'operational',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Fetch locations for dropdown
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })
      
      if (error) throw error
      return data
    },
  })

  // Fetch equipment data if editing
  const { data: equipment, isLoading: isLoadingEquipment } = useQuery({
    queryKey: ['equipment', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: isEditMode,
  })

  // Populate form when editing
  useEffect(() => {
    if (equipment) {
      setFormData({
        name: equipment.name || '',
        manufacturer: equipment.manufacturer || '',
        model: equipment.model || '',
        serial_number: equipment.serial_number || '',
        inventory_number: equipment.inventory_number || '',
        location_id: equipment.location_id || '',
        purchase_date: equipment.purchase_date || '',
        warranty_months: equipment.warranty_months || '',
        description: equipment.description || '',
        status: equipment.status || 'operational',
      })
    }
  }, [equipment])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase
        .from('equipment')
        .insert([{ ...data, created_by: user.id }])
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      navigate('/equipment')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase
        .from('equipment')
        .update(data)
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      queryClient.invalidateQueries({ queryKey: ['equipment', id] })
      navigate(`/equipment/${id}`)
    },
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validation
      if (!formData.name.trim()) {
        setError('Equipment name is required')
        setLoading(false)
        return
      }

      // Convert empty date strings to null for PostgreSQL
      // Also convert empty serial_number and inventory_number to null to avoid unique constraint violations
      const dataToSubmit = {
        ...formData,
        purchase_date: formData.purchase_date || null,
        warranty_months: formData.warranty_months ? parseInt(formData.warranty_months) : null,
        serial_number: formData.serial_number?.trim() || null,
        inventory_number: formData.inventory_number?.trim() || null,
      }

      if (isEditMode) {
        await updateMutation.mutateAsync(dataToSubmit)
      } else {
        await createMutation.mutateAsync(dataToSubmit)
      }
    } catch (err) {
      setError(err.message || 'Failed to save equipment')
      setLoading(false)
    }
  }

  if (isEditMode && isLoadingEquipment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? 'Edit Equipment' : 'Add Equipment'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEditMode ? 'Update equipment information' : 'Add new equipment to your registry'}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="card">
        <div className="space-y-6">
          {/* Inventory Number */}
          <div>
            <label htmlFor="inventory_number" className="block text-sm font-medium text-gray-700 mb-1">
              Nr. Inventar
            </label>
            <input
              id="inventory_number"
              name="inventory_number"
              type="text"
              value={formData.inventory_number}
              onChange={handleChange}
              className="input"
              placeholder="e.g., INV-2024-001"
            />
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              className="input"
              placeholder="e.g., Diesel Generator"
            />
          </div>

          {/* Brand/Manufacturer */}
          <div>
            <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-700 mb-1">
              Brand
            </label>
            <input
              id="manufacturer"
              name="manufacturer"
              type="text"
              value={formData.manufacturer}
              onChange={handleChange}
              className="input"
              placeholder="e.g., Caterpillar"
            />
          </div>

          {/* Model */}
          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            <input
              id="model"
              name="model"
              type="text"
              value={formData.model}
              onChange={handleChange}
              className="input"
              placeholder="e.g., CAT-3500"
            />
          </div>

          {/* Serial Number */}
          <div>
            <label htmlFor="serial_number" className="block text-sm font-medium text-gray-700 mb-1">
              Serial Number
            </label>
            <input
              id="serial_number"
              name="serial_number"
              type="text"
              value={formData.serial_number}
              onChange={handleChange}
              className="input"
              placeholder="e.g., SN-12345"
            />
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location_id" className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <select
              id="location_id"
              name="location_id"
              value={formData.location_id}
              onChange={handleChange}
              className="input"
            >
              <option value="">Select a location...</option>
              {locations?.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                  {location.building && ` - ${location.building}`}
                </option>
              ))}
            </select>
            {locations && locations.length === 0 && (
              <p className="mt-1 text-sm text-gray-500">
                No locations available.{' '}
                <Link to="/locations/new" className="text-primary-600 hover:text-primary-700">
                  Add a location first
                </Link>
              </p>
            )}
          </div>

          {/* Purchase Date și Warranty */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Purchase Date */}
            <div>
              <label htmlFor="purchase_date" className="block text-sm font-medium text-gray-700 mb-1">
                Data Achiziție <span className="text-gray-400 text-xs">(opțional)</span>
              </label>
              <input
                id="purchase_date"
                name="purchase_date"
                type="date"
                value={formData.purchase_date}
                onChange={handleChange}
                className="input"
              />
            </div>

            {/* Warranty Period */}
            <div>
              <label htmlFor="warranty_months" className="block text-sm font-medium text-gray-700 mb-1">
                Garanție (luni) <span className="text-gray-400 text-xs">(opțional)</span>
              </label>
              <input
                id="warranty_months"
                name="warranty_months"
                type="number"
                min="0"
                step="1"
                value={formData.warranty_months}
                onChange={handleChange}
                className="input"
                placeholder="ex: 12, 24, 36"
              />
              <p className="text-xs text-gray-500 mt-1">
                Număr de luni (ex: 12 luni = 1 an)
              </p>
            </div>
          </div>

          {/* Warranty Expiration Info */}
          {formData.purchase_date && formData.warranty_months && parseInt(formData.warranty_months) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Garanția expiră:</span>{' '}
                {(() => {
                  const purchaseDate = new Date(formData.purchase_date)
                  const warrantyMonths = parseInt(formData.warranty_months)
                  const expiryDate = new Date(purchaseDate)
                  expiryDate.setMonth(expiryDate.getMonth() + warrantyMonths)
                  
                  const isExpired = expiryDate < new Date()
                  const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24))
                  
                  return (
                    <span className={isExpired ? 'text-red-600 font-semibold' : ''}>
                      {expiryDate.toLocaleDateString('ro-RO', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                      {isExpired ? ' (Expirată)' : ` (${daysLeft} zile rămase)`}
                    </span>
                  )
                })()}
              </p>
            </div>
          )}

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
              placeholder="Detailed description of the equipment..."
            />
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="input"
            >
              <option value="operational">Operational</option>
              <option value="maintenance">Under Maintenance</option>
              <option value="broken">Broken</option>
              <option value="retired">Retired</option>
            </select>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate(-1)}
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
                {isEditMode ? 'Update Equipment' : 'Add Equipment'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
