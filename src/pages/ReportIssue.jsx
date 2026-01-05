import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { AlertTriangle, CheckCircle, Wrench, MapPin, Camera, Upload, X, Building } from 'lucide-react'
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
      if (itemType === 'equipment') {
        // Create work order for equipment
        const { error } = await supabase
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
        
        if (error) throw error
      } else {
        // Create work order for location
        const { error } = await supabase
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
        
        if (error) throw error
      }
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
                📍 {equipment.location.name}
              </p>
            )}
            {itemType === 'location' && location.building && (
              <p className="text-sm text-gray-600 mt-1">
                🏢 {location.building}
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
                <div className="text-sm text-gray-600 mt-2">
                  {location.building && <p>🏢 {location.building}</p>}
                  {location.floor && <p>📍 Etaj {location.floor}</p>}
                  {location.room && <p>🚪 Camera {location.room}</p>}
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
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="image-upload"
                  />
                  <label 
                    htmlFor="image-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <Camera className="w-6 h-6 text-gray-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Adaugă fotografie
                    </p>
                    <p className="text-xs text-gray-500">
                      Faceți o poză sau încărcați din galerie
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      PNG, JPG, GIF până la 5MB
                    </p>
                  </label>
                </div>
              ) : (
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    {imageFile?.name}
                  </p>
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
