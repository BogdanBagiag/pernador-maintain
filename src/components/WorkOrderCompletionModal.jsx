import { useState } from 'react'
import { X, User, Wrench, Clock, FileText, Camera, Upload } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import LoadingSpinner from './LoadingSpinner'

export default function WorkOrderCompletionModal({ workOrder, onClose }) {
  const queryClient = useQueryClient()
  const [completionData, setCompletionData] = useState({
    completed_by: '',
    parts_replaced: '',
    parts_cost: '',
    labor_cost: '',
    actual_hours: '',
    completion_notes: ''
  })
  
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const handleCompletionChange = (e) => {
    const { name, value } = e.target
    setCompletionData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Vă rugăm să selectați un fișier imagine')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Imaginea este prea mare. Maxim 5MB.')
        return
      }
      
      setImageFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  // Complete work order mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
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
      
      const updateData = {
        status: 'completed',
        completed_date: new Date().toISOString()
      }

      // Add completion details
      if (completionData.completed_by) updateData.completed_by = completionData.completed_by
      if (completionData.parts_replaced) updateData.parts_replaced = completionData.parts_replaced
      if (completionData.parts_cost) updateData.parts_cost = parseFloat(completionData.parts_cost)
      if (completionData.labor_cost) updateData.labor_cost = parseFloat(completionData.labor_cost)
      if (completionData.actual_hours) updateData.actual_hours = parseFloat(completionData.actual_hours)
      if (completionData.completion_notes) updateData.completion_notes = completionData.completion_notes
      if (imageUrl) updateData.image_url = imageUrl

      const { error } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('id', workOrder.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['work-orders'])
      onClose()
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    completeMutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-2xl font-bold text-gray-900 pr-2">
              Finalizează Comanda de Lucru
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              type="button"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Work Order Title */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Work Order:</span> {workOrder.title}
              </p>
              {workOrder.equipment && (
                <p className="text-sm text-blue-700 mt-1">
                  <span className="font-semibold">Equipment:</span> {workOrder.equipment.name}
                </p>
              )}
            </div>

            {/* Completed By */}
            <div>
              <label htmlFor="completed_by" className="block text-sm font-medium text-gray-700 mb-1">
                Finalizat De <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="completed_by"
                  name="completed_by"
                  type="text"
                  required
                  value={completionData.completed_by}
                  onChange={handleCompletionChange}
                  className="input pl-10"
                  placeholder="Numele tehnicianului"
                />
              </div>
            </div>

            {/* Parts Replaced */}
            <div>
              <label htmlFor="parts_replaced" className="block text-sm font-medium text-gray-700 mb-1">
                Piese Înlocuite
              </label>
              <div className="relative">
                <Wrench className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <textarea
                  id="parts_replaced"
                  name="parts_replaced"
                  rows={3}
                  value={completionData.parts_replaced}
                  onChange={handleCompletionChange}
                  className="input pl-10"
                  placeholder="ex: Rulment motor, Curea transmisie, Filtru ulei..."
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Listează toate piesele care au fost înlocuite sau folosite
              </p>
            </div>

            {/* Costs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Parts Cost */}
              <div>
                <label htmlFor="parts_cost" className="block text-sm font-medium text-gray-700 mb-1">
                  Cost Piese (Lei)
                </label>
                <div className="relative">
                  <Wrench className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="parts_cost"
                    name="parts_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={completionData.parts_cost}
                    onChange={handleCompletionChange}
                    className="input pl-10"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Cost pentru piese înlocuite
                </p>
              </div>

              {/* Labor Cost */}
              <div>
                <label htmlFor="labor_cost" className="block text-sm font-medium text-gray-700 mb-1">
                  Cost Manoperă (Lei)
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="labor_cost"
                    name="labor_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={completionData.labor_cost}
                    onChange={handleCompletionChange}
                    className="input pl-10"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Cost pentru manoperă
                </p>
              </div>
            </div>

            {/* Total Cost Display */}
            {(completionData.parts_cost || completionData.labor_cost) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Cost Total:</span>
                  <span className="text-2xl font-bold text-green-600">
                    {(parseFloat(completionData.parts_cost || 0) + parseFloat(completionData.labor_cost || 0)).toFixed(2)} Lei
                  </span>
                </div>
              </div>
            )}

            {/* Actual Hours */}
            <div>
              <label htmlFor="actual_hours" className="block text-sm font-medium text-gray-700 mb-1">
                Ore Lucrate
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="actual_hours"
                  name="actual_hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={completionData.actual_hours}
                  onChange={handleCompletionChange}
                  className="input pl-10"
                  placeholder="0.0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Timp total petrecut la reparație
              </p>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fotografie Finalizare (opțional)
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
                            Fotografiază lucrarea finalizată
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

            {/* Completion Notes */}
            <div>
              <label htmlFor="completion_notes" className="block text-sm font-medium text-gray-700 mb-1">
                Note Finalizare
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <textarea
                  id="completion_notes"
                  name="completion_notes"
                  rows={4}
                  value={completionData.completion_notes}
                  onChange={handleCompletionChange}
                  className="input pl-10"
                  placeholder="Detalii suplimentare despre reparație, probleme găsite, recomandări..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary w-full sm:w-auto"
                disabled={completeMutation.isLoading || uploadingImage}
              >
                Anulează
              </button>
              <button
                type="submit"
                className="btn-primary inline-flex items-center justify-center bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                disabled={completeMutation.isLoading || uploadingImage}
              >
                {completeMutation.isLoading || uploadingImage ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">
                      {uploadingImage ? 'Se încarcă imaginea...' : 'Finalizare...'}
                    </span>
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 mr-2" />
                    Finalizează Work Order
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
