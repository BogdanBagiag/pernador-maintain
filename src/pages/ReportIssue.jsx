import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { notifyWorkOrderAssigned } from '../lib/notifications'
import { AlertTriangle, CheckCircle, Wrench, MapPin, Camera, Upload, X, Building, Hash, DoorOpen } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ReportIssue() {
  const { equipmentId } = useParams()
  const [searchParams] = useSearchParams()
  const locationId = searchParams.get('location')
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    reporterName: '',
    reporterEmail: '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Fetch equipment details (if equipmentId)
  const { data: equipment, isLoading: equipmentLoading } = useQuery({
    queryKey: ['equipment-public', equipmentId],
    queryFn: async () => {
      if (!equipmentId) return null
      const { data, error } = await supabase
        .from('equipment')
        .select(`
          *,
          location:locations(name, building)
        `)
        .eq('id', equipmentId)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!equipmentId,
  })

  // Fetch location details (if locationId)
  const { data: location, isLoading: locationLoading } = useQuery({
    queryKey: ['location-public', locationId],
    queryFn: async () => {
      if (!locationId) return null
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', locationId)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!locationId,
  })

  const isLoading = equipmentLoading || locationLoading
  const item = equipment || location
  const itemType = equipmentId ? 'equipment' : 'location'

  const createWorkOrderMutation = useMutation({
    mutationFn: async (data) => {
      let imageUrl = null
      
      // Upload image if provided
      if (imageFile) {
        setUploadingImage(true)
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `issue-reports/${fileName}`
        
        const { error: uploadError } = await supabase.storage
          .from('maintenance-files')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: false
          })
        
        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error('Eroare la încărcarea imaginii')
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('maintenance-files')
          .getPublicUrl(filePath)
        
        imageUrl = publicUrl
        setUploadingImage(false)
      }
      
      // Create work order for equipment OR location
      let newWorkOrder = null
      
      if (itemType === 'equipment') {
        // Create work order for equipment
        const { data: woData, error } = await supabase
          .from('work_orders')
          .insert([{
            title: data.title,
            description: `${data.description}\n\n---\nRaportat de: ${data.reporterName}${data.reporterEmail ? `\nEmail: ${data.reporterEmail}` : ''}${imageUrl ? `\n\nPoza: ${imageUrl}` : ''}`,
            equipment_id: equipmentId,
            priority: data.priority,
            status: 'open',
            type: 'corrective',
            image_url: imageUrl,
          }])
          .select()
          .single()
        
        if (error) throw error
        newWorkOrder = woData
      } else {
        // Create work order for location
        const { data: woData, error } = await supabase
          .from('work_orders')
          .insert([{
            title: data.title,
            description: `${data.description}\n\n---\nRaportat de: ${data.reporterName}${data.reporterEmail ? `\nEmail: ${data.reporterEmail}` : ''}${imageUrl ? `\n\nPoza: ${imageUrl}` : ''}`,
            location_id: locationId,
            priority: data.priority,
            status: 'open',
            type: 'corrective',
            image_url: imageUrl,
          }])
          .select()
          .single()
        
        if (error) throw error
        newWorkOrder = woData
      }
      
      // Send push notifications to ALL active users (fire-and-forget)
      if (newWorkOrder) {
        // Don't await - send in background to not block the response
        const sendNotifications = async () => {
          try {
            const { data: users } = await supabase
              .from('profiles')
              .select('*')
              .in('role', ['admin', 'manager', 'technician'])
              .eq('is_active', true)
            
            if (users && users.length > 0) {
              // Notify all users in parallel
              await Promise.all(
                users.map(u => {
                  return notifyWorkOrderAssigned(newWorkOrder, u).catch(err => {
                    console.error('Notification failed for user:', u.id, err)
                  })
                })
              )
            }
          } catch (err) {
            console.error('❌ Notification error:', err)
          }
        }
        
        // Fire-and-forget: don't await, just trigger
        sendNotifications()
      }
      
      // Return immediately without waiting for notifications
      return newWorkOrder
    },
    onSuccess: () => {
      setSubmitted(true)
    },
    onError: (err) => {
      setUploadingImage(false)
      setError(err.message || 'Eroare la trimiterea raportului')
    },
  })

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Vă rugăm să selectați un fișier imagine')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Imaginea este prea mare. Maxim 5MB.')
        return
      }
      
      setImageFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
      setError('')
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.title.trim()) {
      setError('Vă rugăm să descrieți problema')
      return
    }

    if (!formData.reporterName.trim()) {
      setError('Vă rugăm să introduceți numele dumneavoastră')
      return
    }

    await createWorkOrderMutation.mutateAsync(formData)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="card max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {itemType === 'equipment' ? 'Echipament Negăsit' : 'Locație Negăsită'}
          </h2>
          <p className="text-gray-600">
            {itemType === 'equipment' 
              ? 'Echipamentul pentru care încercați să raportați o problemă nu a fost găsit.'
              : 'Locația pentru care încercați să raportați o problemă nu a fost găsită.'}
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="card max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Problema Raportată cu Succes!
          </h2>
          <p className="text-gray-600 mb-6">
            Mulțumim pentru raportare. Echipa noastră de mentenanță a fost notificată și va rezolva problema cât mai curând posibil.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left">
            <p className="text-sm font-medium text-gray-700">
              {itemType === 'equipment' ? 'Echipament:' : 'Locație:'}
            </p>
            <p className="text-lg font-semibold text-gray-900">{item.name}</p>
            {itemType === 'equipment' && equipment.location && (
              <p className="text-sm text-gray-600 mt-1">
                ðŸ“ {equipment.location.name}
              </p>
            )}
            {itemType === 'location' && location.building && (
              <p className="text-sm text-gray-600 mt-1">
                ðŸ¢ {location.building}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Raportează Problemă {itemType === 'equipment' ? 'Echipament' : 'Locație'}
          </h1>
          <p className="text-gray-600">
            Spune-ne ce nu funcționează și o vom repara
          </p>
        </div>

        {/* Equipment/Location Info */}
        <div className="card mb-6">
          <div className="flex items-start">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
              {itemType === 'equipment' ? (
                <Wrench className="w-6 h-6 text-primary-600" />
              ) : (
                <Building className="w-6 h-6 text-primary-600" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">{item.name}</h2>
              {itemType === 'equipment' && equipment.serial_number && (
                <p className="text-sm text-gray-600 mt-1">
                  SN: {equipment.serial_number}
                </p>
              )}
              {itemType === 'equipment' && equipment.location && (
                <div className="flex items-center text-sm text-gray-600 mt-2">
                  <MapPin className="w-4 h-4 mr-1" />
                  {equipment.location.name}
                  {equipment.location.building && ` - ${equipment.location.building}`}
                </div>
              )}
              {itemType === 'location' && (
                <div className="text-sm text-gray-600 mt-2 space-y-1">
                  {location.building && (
                    <div className="flex items-center">
                      <Building className="w-4 h-4 mr-1" />
                      {location.building}
                    </div>
                  )}
                  {location.floor && (
                    <div className="flex items-center">
                      <Hash className="w-4 h-4 mr-1" />
                      Etaj {location.floor}
                    </div>
                  )}
                  {location.room && (
                    <div className="flex items-center">
                      <DoorOpen className="w-4 h-4 mr-1" />
                      Camera {location.room}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Report Form */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Detalii Problemă
          </h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Issue Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Care este problema? <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                value={formData.title}
                onChange={handleChange}
                className="input"
                placeholder={itemType === 'equipment' 
                  ? "ex: Mașina nu pornește, Zgomot ciudat, Scurgere"
                  : "ex: Perete crăpat, Lumină spartă, Curățenie necesară"}
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Detalii suplimentare
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="input"
                placeholder="Descrieți ce s-a întâmplat, când a început, detalii specifice..."
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fotografie Problemă (opțional)
              </label>
              
              {!imagePreview ? (
                <div className="space-y-3">
                  {/* Camera Button */}
                  <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 hover:border-blue-400 transition-colors bg-blue-50">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageChange}
                      className="hidden"
                      id="camera-capture"
                    />
                    <label 
                      htmlFor="camera-capture"
                      className="cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Camera className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-900">
                            📷 Fă Poză cu Camera
                          </p>
                          <p className="text-xs text-gray-600">
                            Deschide camera pentru a fotografia problema
                          </p>
                        </div>
                      </div>
                      <Camera className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    </label>
                  </div>

                  {/* Gallery Button */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="gallery-upload"
                    />
                    <label 
                      htmlFor="gallery-upload"
                      className="cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Upload className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-900">
                            🖼️ Alege din Galerie
                          </p>
                          <p className="text-xs text-gray-600">
                            Selectează o poză existentă
                          </p>
                        </div>
                      </div>
                      <Upload className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    </label>
                  </div>

                  <p className="text-xs text-gray-500 text-center">
                    PNG, JPG, GIF până la 5MB
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full h-64 object-cover rounded-lg border-2 border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-600">
                      📎 {imageFile?.name}
                    </p>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      Schimbă poza
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Cât de urgent este?
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="input"
              >
                <option value="low">Scăzut - Poate aștepta</option>
                <option value="medium">Mediu - Ar trebui reparat curând</option>
                <option value="high">Ridicat - Afectează operațiunile</option>
                <option value="critical">Critic - Pericol de siguranță / Defecțiune totală</option>
              </select>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Informațiile Dumneavoastră de Contact
              </h4>

              {/* Reporter Name */}
              <div className="mb-4">
                <label htmlFor="reporterName" className="block text-sm font-medium text-gray-700 mb-1">
                  Numele Dumneavoastră <span className="text-red-500">*</span>
                </label>
                <input
                  id="reporterName"
                  name="reporterName"
                  type="text"
                  required
                  value={formData.reporterName}
                  onChange={handleChange}
                  className="input"
                  placeholder="Ion Popescu"
                />
              </div>

              {/* Reporter Email */}
              <div>
                <label htmlFor="reporterEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email (opțional)
                </label>
                <input
                  id="reporterEmail"
                  name="reporterEmail"
                  type="email"
                  value={formData.reporterEmail}
                  onChange={handleChange}
                  className="input"
                  placeholder="ion@example.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Vă vom notifica când problema este rezolvată
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={createWorkOrderMutation.isLoading || uploadingImage}
            >
              {createWorkOrderMutation.isLoading || uploadingImage ? (
                <span className="flex items-center justify-center">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">
                    {uploadingImage ? 'Se încarcă imaginea...' : 'Se trimite...'}
                  </span>
                </span>
              ) : (
                'Trimite Raportul'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Powered by Pernador Maintenance
        </p>
      </div>
    </div>
  )
}
