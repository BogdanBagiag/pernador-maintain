import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { 
  Plus, 
  Edit, 
  Trash2, 
  X,
  ChevronUp,
  ChevronDown,
  Save,
  Image as ImageIcon,
  Upload,
  FileText
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ProcedureTemplates() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)

  // Check permissions
  const canCreateEdit = profile?.role === 'admin' || profile?.role === 'manager'
  const canDelete = profile?.role === 'admin'

  const { data: templates, isLoading } = useQuery({
    queryKey: ['procedure-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procedure_templates')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('procedure_templates')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedure-templates'] })
    },
  })

  const handleDelete = (template) => {
    if (window.confirm(`Are you sure you want to delete "${template.name}"?`)) {
      deleteMutation.mutate(template.id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Procedure Templates</h1>
          <p className="text-gray-600 mt-1">Create and manage step-by-step procedures with images</p>
        </div>
        {canCreateEdit && (
          <button
            onClick={() => {
              setEditingTemplate(null)
              setShowModal(true)
            }}
            className="btn-primary mt-4 sm:mt-0 inline-flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Template
          </button>
        )}
      </div>

      {!templates || templates.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
          <p className="text-gray-600 mb-4">
            Create your first procedure template with step-by-step instructions
          </p>
          {canCreateEdit && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary inline-flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Template
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {templates.map((template) => (
            <div key={template.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {template.name}
                  </h3>
                  {template.description && (
                    <p className="text-sm text-gray-600">{template.description}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {canCreateEdit && (
                    <button
                      onClick={() => {
                        setEditingTemplate(template)
                        setShowModal(true)
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(template)}
                      disabled={deleteMutation.isLoading}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  {template.steps?.length || 0} steps:
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {template.steps?.map((step, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                      <span className="font-semibold text-gray-500 min-w-[1.5rem]">{index + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{step.text}</p>
                        {step.image_url && (
                          <div className="mt-1 flex items-center text-xs text-blue-600">
                            <ImageIcon className="w-3 h-3 mr-1" />
                            Has image
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Created: {new Date(template.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => {
            setShowModal(false)
            setEditingTemplate(null)
          }}
        />
      )}
    </div>
  )
}

function TemplateModal({ template, onClose }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    steps: template?.steps || []
  })
  const [currentStep, setCurrentStep] = useState({ text: '', image_url: '' })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [errors, setErrors] = useState({})

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (template) {
        const { error } = await supabase
          .from('procedure_templates')
          .update(data)
          .eq('id', template.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('procedure_templates')
          .insert([{ ...data, created_by: user.id }])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedure-templates'] })
      onClose()
    },
  })

  const handleImageUpload = async (e, stepIndex = null) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    setUploadingImage(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `procedure-images/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('maintenance-files')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('maintenance-files')
        .getPublicUrl(filePath)

      if (stepIndex !== null) {
        // Update existing step
        const newSteps = [...formData.steps]
        newSteps[stepIndex].image_url = publicUrl
        setFormData(prev => ({ ...prev, steps: newSteps }))
      } else {
        // Set for new step
        setCurrentStep(prev => ({ ...prev, image_url: publicUrl }))
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload image: ' + error.message)
    } finally {
      setUploadingImage(false)
    }
  }

  const addStep = () => {
    if (!currentStep.text.trim()) return
    
    const newStep = {
      text: currentStep.text.trim(),
      image_url: currentStep.image_url || null,
      order: formData.steps.length + 1
    }
    
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }))
    setCurrentStep({ text: '', image_url: '' })
  }

  const removeStep = (index) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }))
  }

  const updateStep = (index, field, value) => {
    const newSteps = [...formData.steps]
    newSteps[index][field] = value
    setFormData(prev => ({ ...prev, steps: newSteps }))
  }

  const moveStep = (index, direction) => {
    const newSteps = [...formData.steps]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    
    if (newIndex < 0 || newIndex >= newSteps.length) return
    
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]]
    
    newSteps.forEach((step, idx) => {
      step.order = idx + 1
    })
    
    setFormData(prev => ({ ...prev, steps: newSteps }))
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Template name is required'
    if (formData.steps.length === 0) newErrors.steps = 'At least one step is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    saveMutation.mutate({
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      steps: formData.steps
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              {template ? 'Edit Procedure Template' : 'Create Procedure Template'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={saveMutation.isLoading}>
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`input ${errors.name ? 'border-red-500' : ''}`}
                placeholder="e.g., Filter Replacement Procedure"
              />
              {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="input"
                placeholder="Brief description of this procedure..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Procedure Steps <span className="text-red-500">*</span>
              </label>
              
              <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-3">
                <input
                  type="text"
                  value={currentStep.text}
                  onChange={(e) => setCurrentStep(prev => ({ ...prev, text: e.target.value }))}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addStep()
                    }
                  }}
                  placeholder="Enter step description..."
                  className="input"
                />
                
                <div className="flex items-center gap-3">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 p-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors">
                      {uploadingImage ? (
                        <LoadingSpinner size="sm" />
                      ) : currentStep.image_url ? (
                        <>
                          <ImageIcon className="w-5 h-5 text-green-600" />
                          <span className="text-sm text-green-600">Image attached</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-gray-400" />
                          <span className="text-sm text-gray-600">Add image (optional)</span>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e)}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                  
                  <button
                    type="button"
                    onClick={addStep}
                    className="btn-primary px-4"
                    disabled={!currentStep.text.trim()}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {currentStep.image_url && (
                  <img src={currentStep.image_url} alt="Preview" className="max-h-32 rounded border" />
                )}
              </div>

              {formData.steps.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <p className="text-gray-600">No steps yet. Add your first step above.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.steps.map((step, index) => (
                    <StepRow
                      key={index}
                      step={step}
                      index={index}
                      totalSteps={formData.steps.length}
                      onUpdate={(field, value) => updateStep(index, field, value)}
                      onRemove={() => removeStep(index)}
                      onMoveUp={() => moveStep(index, 'up')}
                      onMoveDown={() => moveStep(index, 'down')}
                      onImageUpload={(e) => handleImageUpload(e, index)}
                      uploadingImage={uploadingImage}
                    />
                  ))}
                </div>
              )}

              {errors.steps && <p className="text-sm text-red-600 mt-2">{errors.steps}</p>}
              <p className="text-xs text-gray-500 mt-2">Total steps: {formData.steps.length}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
              <button type="button" onClick={onClose} className="btn-secondary" disabled={saveMutation.isLoading}>
                Cancel
              </button>
              <button type="submit" className="btn-primary inline-flex items-center" disabled={saveMutation.isLoading}>
                {saveMutation.isLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    {template ? 'Update Template' : 'Create Template'}
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

function StepRow({ step, index, totalSteps, onUpdate, onRemove, onMoveUp, onMoveDown, onImageUpload, uploadingImage }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(step.text)

  const handleSave = () => {
    if (editText.trim() && editText !== step.text) {
      onUpdate('text', editText.trim())
    }
    setIsEditing(false)
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-2">
        <span className="font-semibold text-gray-500 min-w-[2rem] mt-1">{index + 1}.</span>
        
        {isEditing ? (
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleSave()
            }}
            onBlur={handleSave}
            className="flex-1 input py-1 px-2 text-sm"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-gray-900 cursor-pointer" onClick={() => setIsEditing(true)}>
            {step.text}
          </span>
        )}

        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <ChevronUp className="w-4 h-4" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === totalSteps - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <ChevronDown className="w-4 h-4" />
          </button>
          {!isEditing && (
            <button type="button" onClick={() => setIsEditing(true)} className="p-1 text-blue-600 hover:text-blue-800">
              <Edit className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={onRemove} className="p-1 text-red-600 hover:text-red-800">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-8">
        <label className="flex-1 cursor-pointer">
          <div className="flex items-center gap-2 p-2 border border-gray-200 rounded hover:border-blue-500 transition-colors">
            {uploadingImage ? (
              <LoadingSpinner size="sm" />
            ) : step.image_url ? (
              <>
                <ImageIcon className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-600">Change image</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-600">Add image</span>
              </>
            )}
          </div>
          <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" disabled={uploadingImage} />
        </label>
        
        {step.image_url && (
          <button
            type="button"
            onClick={() => onUpdate('image_url', null)}
            className="text-xs text-red-600 hover:text-red-800"
          >
            Remove image
          </button>
        )}
      </div>

      {step.image_url && (
        <div className="pl-8">
          <img src={step.image_url} alt={`Step ${index + 1}`} className="max-h-48 rounded border" />
        </div>
      )}
    </div>
  )
}
