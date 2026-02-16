import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { ArrowLeft, Save, Upload, X } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import DateInput from '../components/DateInput'

export default function VehicleForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const isEditMode = Boolean(id)

  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    registration_number: '',
    vin: '',
    vehicle_type: 'autovehicul',
    year: new Date().getFullYear(),
    color: '',
    fuel_type: 'benzina',
    engine_capacity: '',
    power_hp: '',
    transmission: 'manuala',
    status: 'operational',
    current_mileage: '',
    assigned_to: '',
    department: '',
    purchase_date: '',
    purchase_price: '',
    notes: '',
  })

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  // Fetch users for assignment dropdown
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true })
      
      if (error) throw error
      return data
    },
  })

  // Fetch vehicle data if editing
  const { data: vehicle, isLoading: isLoadingVehicle } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('vehicles')
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
    if (vehicle) {
      setFormData({
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        registration_number: vehicle.registration_number || '',
        vin: vehicle.vin || '',
        vehicle_type: vehicle.vehicle_type || 'autovehicul',
        year: vehicle.year || new Date().getFullYear(),
        color: vehicle.color || '',
        fuel_type: vehicle.fuel_type || 'benzina',
        engine_capacity: vehicle.engine_capacity || '',
        power_hp: vehicle.power_hp || '',
        transmission: vehicle.transmission || 'manuala',
        status: vehicle.status || 'operational',
        current_mileage: vehicle.current_mileage || '',
        assigned_to: vehicle.assigned_to || '',
        department: vehicle.department || '',
        purchase_date: vehicle.purchase_date || '',
        purchase_price: vehicle.purchase_price || '',
        notes: vehicle.notes || '',
      })
      if (vehicle.image_url) {
        setImagePreview(vehicle.image_url)
      }
    }
  }, [vehicle])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file size (2MB)
    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      setError('Imaginea este prea mare. Maxim 2MB.')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Fișierul selectat nu este o imagine.')
      return
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError('')
  }

  // Remove image
  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    const fileInput = document.getElementById('image-upload')
    if (fileInput) fileInput.value = ''
  }
  // Upload image to storage
  const uploadImage = async (vehicleId) => {
    if (!imageFile) return null

    const fileExt = imageFile.name.split('.').pop()
    const fileName = `${vehicleId}-${Date.now()}.${fileExt}`
    const filePath = `vehicles/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('maintenance-files')
      .upload(filePath, imageFile, {
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('maintenance-files')
      .getPublicUrl(filePath)

    return publicUrl
  }

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      setUploading(true)

      // Insert vehicle first
      const { data: newVehicle, error: insertError } = await supabase
        .from('vehicles')
        .insert([{ ...data, created_by: user.id }])
        .select()
        .single()
      
      if (insertError) throw insertError

      // Upload image if provided
      let imageUrl = null
      if (imageFile) {
        imageUrl = await uploadImage(newVehicle.id)
        
        // Update vehicle with image URL
        const { error: updateError } = await supabase
          .from('vehicles')
          .update({ image_url: imageUrl })
          .eq('id', newVehicle.id)
        
        if (updateError) throw updateError
      }

      return newVehicle
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      navigate('/vehicles')
    },
    onError: (error) => {
      setError(error.message || 'Eroare la crearea mașinii')
      setUploading(false)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      setUploading(true)

      // Upload new image if provided
      let imageUrl = vehicle?.image_url
      if (imageFile) {
        imageUrl = await uploadImage(id)
      }

      // Update vehicle
      const { error } = await supabase
        .from('vehicles')
        .update({ ...data, image_url: imageUrl })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['vehicle', id] })
      navigate(`/vehicles/${id}`)
    },
    onError: (error) => {
      setError(error.message || 'Eroare la actualizarea mașinii')
      setUploading(false)
    },
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.brand?.trim()) {
      setError('Marca este obligatorie')
      return
    }
    if (!formData.model?.trim()) {
      setError('Modelul este obligatoriu')
      return
    }
    if (!formData.registration_number?.trim()) {
      setError('Numărul de înmatriculare este obligatoriu')
      return
    }

    // Prepare data
    const dataToSubmit = {
      brand: formData.brand.trim(),
      model: formData.model.trim(),
      registration_number: formData.registration_number.trim().toUpperCase(),
      vin: formData.vin?.trim() || null,
      vehicle_type: formData.vehicle_type,
      year: formData.year ? parseInt(formData.year) : null,
      color: formData.color?.trim() || null,
      // fuel_type și transmission sunt null pentru remorci
      fuel_type: formData.vehicle_type === 'autovehicul' ? formData.fuel_type : null,
      engine_capacity: formData.vehicle_type === 'autovehicul' && formData.engine_capacity ? parseInt(formData.engine_capacity) : null,
      power_hp: formData.vehicle_type === 'autovehicul' && formData.power_hp ? parseInt(formData.power_hp) : null,
      transmission: formData.vehicle_type === 'autovehicul' ? formData.transmission : null,
      status: formData.status,
      current_mileage: formData.current_mileage ? parseInt(formData.current_mileage) : null,
      assigned_to: formData.assigned_to || null,
      department: formData.department?.trim() || null,
      purchase_date: formData.purchase_date || null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      notes: formData.notes?.trim() || null,
    }

    if (isEditMode) {
      updateMutation.mutate(dataToSubmit)
    } else {
      createMutation.mutate(dataToSubmit)
    }
  }

  if (isEditMode && isLoadingVehicle) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={isEditMode ? `/vehicles/${id}` : '/vehicles'}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditMode ? `${t('common.edit')} ${formData.brand} ${formData.model}` : t('vehicles.new')}
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Basic Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Informații de Bază</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Brand */}
            <div>
              <label htmlFor="brand" className="block text-sm font-medium text-gray-700">
                {t('vehicles.brand')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="brand"
                id="brand"
                required
                value={formData.brand}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="ex: Dacia, VW, Ford"
              />
            </div>

            {/* Model */}
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700">
                {t('vehicles.model')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="model"
                id="model"
                required
                value={formData.model}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="ex: Logan, Golf, Focus"
              />
            </div>

            {/* Registration Number */}
            <div>
              <label htmlFor="registration_number" className="block text-sm font-medium text-gray-700">
                {t('vehicles.registrationNumber')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="registration_number"
                id="registration_number"
                required
                value={formData.registration_number}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm uppercase"
                placeholder="ex: IS-12-ABC"
              />
            </div>

            {/* VIN */}
            <div>
              <label htmlFor="vin" className="block text-sm font-medium text-gray-700">
                {t('vehicles.vin')}
              </label>
              <input
                type="text"
                name="vin"
                id="vin"
                value={formData.vin}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="ex: 1HGBH41JXMN109186"
              />
            </div>

            {/* Year */}
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-gray-700">
                {t('vehicles.year')}
              </label>
              <input
                type="number"
                name="year"
                id="year"
                min="1900"
                max={new Date().getFullYear() + 1}
                value={formData.year}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>

            {/* Color */}
            <div>
              <label htmlFor="color" className="block text-sm font-medium text-gray-700">
                {t('vehicles.color')}
              </label>
              <input
                type="text"
                name="color"
                id="color"
                value={formData.color}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="ex: Negru, Alb, Roșu"
              />
            </div>

            {/* Vehicle Type */}
            <div>
              <label htmlFor="vehicle_type" className="block text-sm font-medium text-gray-700">
                Tip Vehicul <span className="text-red-500">*</span>
              </label>
              <select
                name="vehicle_type"
                id="vehicle_type"
                required
                value={formData.vehicle_type}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="autovehicul">{t('vehicles.autovehicul')}</option>
                <option value="remorca">{t('vehicles.remorca')}</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {formData.vehicle_type === 'autovehicul' 
                  ? 'Autovehicule: mașini, motociclete (cu motor și combustibil)' 
                  : 'Remorci: rulote, remorci (fără motor, fără combustibil)'}
              </p>
            </div>

            {/* Fuel Type - doar pentru autovehicule */}
            {formData.vehicle_type === 'autovehicul' && (
              <div>
                <label htmlFor="fuel_type" className="block text-sm font-medium text-gray-700">
                  {t('vehicles.fuelType')} <span className="text-red-500">*</span>
                </label>
                <select
                  name="fuel_type"
                  id="fuel_type"
                  required
                  value={formData.fuel_type}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  <option value="benzina">{t('vehicles.benzina')}</option>
                  <option value="motorina">{t('vehicles.motorina')}</option>
                  <option value="electric">{t('vehicles.electric')}</option>
                  <option value="hibrid">{t('vehicles.hibrid')}</option>
                  <option value="gpl">{t('vehicles.gpl')}</option>
                </select>
              </div>
            )}

            {/* Transmission - doar pentru autovehicule */}
            {formData.vehicle_type === 'autovehicul' && (
              <div>
                <label htmlFor="transmission" className="block text-sm font-medium text-gray-700">
                  {t('vehicles.transmission')} <span className="text-red-500">*</span>
                </label>
                <select
                  name="transmission"
                  id="transmission"
                  required
                  value={formData.transmission}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  <option value="manuala">{t('vehicles.manuala')}</option>
                  <option value="automata">{t('vehicles.automata')}</option>
                </select>
              </div>
            )}

            {/* Engine Capacity - doar pentru autovehicule */}
            {formData.vehicle_type === 'autovehicul' && (
              <div>
                <label htmlFor="engine_capacity" className="block text-sm font-medium text-gray-700">
                  {t('vehicles.engineCapacity')}
                </label>
                <input
                  type="number"
                  name="engine_capacity"
                  id="engine_capacity"
                  value={formData.engine_capacity}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholder="ex: 1600"
                />
              </div>
            )}

            {/* Power HP - doar pentru autovehicule */}
            {formData.vehicle_type === 'autovehicul' && (
              <div>
                <label htmlFor="power_hp" className="block text-sm font-medium text-gray-700">
                  {t('vehicles.powerHP')}
                </label>
                <input
                  type="number"
                  name="power_hp"
                  id="power_hp"
                  value={formData.power_hp}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholder="ex: 90"
                />
              </div>
            )}

            {/* Current Mileage */}
            <div>
              <label htmlFor="current_mileage" className="block text-sm font-medium text-gray-700">
                {t('vehicles.currentMileage')}
              </label>
              <input
                type="number"
                name="current_mileage"
                id="current_mileage"
                value={formData.current_mileage}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="ex: 125000"
              />
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                {t('vehicles.status')}
              </label>
              <select
                name="status"
                id="status"
                value={formData.status}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="operational">{t('vehicles.operational')}</option>
                <option value="in_service">{t('vehicles.inService')}</option>
                <option value="broken">{t('vehicles.broken')}</option>
                <option value="sold">{t('vehicles.sold')}</option>
                <option value="retired">{t('vehicles.retired')}</option>
              </select>
            </div>
          </div>
        </div>
        {/* Assignment and Purchase Info */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Asignare și Achiziție</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Assigned To */}
            <div>
              <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700">
                {t('vehicles.assignedTo')}
              </label>
              <select
                name="assigned_to"
                id="assigned_to"
                value={formData.assigned_to}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="">Neasignat</option>
                {users?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                {t('vehicles.department')}
              </label>
              <input
                type="text"
                name="department"
                id="department"
                value={formData.department}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="ex: Vânzări, IT, Management"
              />
            </div>

            {/* Purchase Date */}
            <div>
              <label htmlFor="purchase_date" className="block text-sm font-medium text-gray-700">
                {t('vehicles.purchaseDate')}
              </label>
              <DateInput
                value={formData.purchase_date}
                onChange={handleChange}
                placeholder="dd/mm/yyyy"
              />
            </div>

            {/* Purchase Price */}
            <div>
              <label htmlFor="purchase_price" className="block text-sm font-medium text-gray-700">
                {t('vehicles.purchasePrice')} (RON)
              </label>
              <input
                type="number"
                step="0.01"
                name="purchase_price"
                id="purchase_price"
                value={formData.purchase_price}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="ex: 50000.00"
              />
            </div>
          </div>
        </div>

        {/* Image Upload */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Imagine Mașină</h2>
          
          {/* Preview */}
          {imagePreview && (
            <div className="mb-4 relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-64 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Upload Button */}
          <div>
            <label
              htmlFor="image-upload"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
            >
              <Upload className="w-5 h-5 mr-2" />
              {imagePreview ? 'Schimbă Imaginea' : 'Încarcă Imagine'}
            </label>
            <input
              type="file"
              id="image-upload"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <p className="mt-2 text-xs text-gray-500">
              PNG, JPG, GIF până la 2MB
            </p>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('vehicles.notes')}</h2>
          <textarea
            name="notes"
            id="notes"
            rows={4}
            value={formData.notes}
            onChange={handleChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            placeholder="Observații suplimentare despre mașină..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-4">
          <Link
            to={isEditMode ? `/vehicles/${id}` : '/vehicles'}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            {t('common.cancel')}
          </Link>
          <button
            type="submit"
            disabled={uploading || createMutation.isPending || updateMutation.isPending}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading || createMutation.isPending || updateMutation.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Se salvează...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {t('common.save')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
