import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  X,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Save
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ChecklistTemplates() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('checklist_templates')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-templates'] })
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('checklists.title')}</h1>
          <p className="text-gray-600 mt-1">{t('checklists.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            setEditingTemplate(null)
            setShowModal(true)
          }}
          className="btn-primary mt-4 sm:mt-0 inline-flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          {t('checklists.new')}
        </button>
      </div>

      {/* Rest of component stays the same, only headers/buttons are translated */}
      {!templates || templates.length === 0 ? (
        <div className="card text-center py-12">
          <Check className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('checklists.noTemplates')}</h3>
          <p className="text-gray-600 mb-4">
            Create your first checklist template to use in maintenance schedules
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary inline-flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('checklists.new')}
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  <button
                    onClick={() => {
                      setEditingTemplate(template)
                      setShowModal(true)
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title={t('common.edit')}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    disabled={deleteMutation.isLoading}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  {template.items?.length || 0} {t('checklists.items')}:
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {template.items?.map((item, index) => (
                    <div key={item.id || index} className="flex items-start text-sm text-gray-600">
                      <Check className="w-4 h-4 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                      <span>{item.text}</span>
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

      {/* Template Modal - keeping original for now */}
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

// TemplateModal component stays mostly the same
function TemplateModal({ template, onClose }) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    items: template?.items || []
  })
  const [currentItem, setCurrentItem] = useState('')
  const [errors, setErrors] = useState({})

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (template) {
        const { error } = await supabase
          .from('checklist_templates')
          .update(data)
          .eq('id', template.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('checklist_templates')
          .insert([{ ...data, created_by: user.id }])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-templates'] })
      onClose()
    },
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const addItem = () => {
    if (!currentItem.trim()) return
    
    const newItem = {
      id: Date.now(),
      text: currentItem.trim(),
      order: formData.items.length + 1
    }
    
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
    setCurrentItem('')
  }

  const removeItem = (itemId) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }))
  }

  const updateItem = (itemId, newText) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === itemId ? { ...item, text: newText } : item
      )
    }))
  }

  const moveItem = (index, direction) => {
    const newItems = [...formData.items]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    
    if (newIndex < 0 || newIndex >= newItems.length) return
    
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]]
    newItems.forEach((item, idx) => {
      item.order = idx + 1
    })
    
    setFormData(prev => ({ ...prev, items: newItems }))
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Template name is required'
    if (formData.items.length === 0) newErrors.items = 'At least one checklist item is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return

    const dataToSave = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      items: formData.items
    }

    saveMutation.mutate(dataToSave)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              {template ? t('common.edit') + ' Template' : t('common.create') + ' Template'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={saveMutation.isLoading}>
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Template {t('common.name')} <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className={`input ${errors.name ? 'border-red-500' : ''}`}
                placeholder="e.g., Filter Change Checklist"
              />
              {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                {t('common.description')}
              </label>
              <textarea
                id="description"
                name="description"
                rows={2}
                value={formData.description}
                onChange={handleChange}
                className="input"
                placeholder="Brief description of this checklist template..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Checklist Items <span className="text-red-500">*</span>
              </label>
              
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={currentItem}
                  onChange={(e) => setCurrentItem(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addItem()
                    }
                  }}
                  placeholder="Enter a checklist item and press Enter..."
                  className="input flex-1"
                />
                <button type="button" onClick={addItem} className="btn-secondary px-4">
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {formData.items.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <p className="text-gray-600">No items yet. Add your first checklist item above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item}
                      index={index}
                      totalItems={formData.items.length}
                      onUpdate={(newText) => updateItem(item.id, newText)}
                      onRemove={() => removeItem(item.id)}
                      onMoveUp={() => moveItem(index, 'up')}
                      onMoveDown={() => moveItem(index, 'down')}
                    />
                  ))}
                </div>
              )}

              {errors.items && <p className="text-sm text-red-600 mt-2">{errors.items}</p>}
              <p className="text-xs text-gray-500 mt-2">Total items: {formData.items.length}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
              <button type="button" onClick={onClose} className="btn-secondary" disabled={saveMutation.isLoading}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary inline-flex items-center" disabled={saveMutation.isLoading}>
                {saveMutation.isLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">{t('common.loading')}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    {template ? t('common.update') + ' Template' : t('common.create') + ' Template'}
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

function ChecklistItemRow({ item, index, totalItems, onUpdate, onRemove, onMoveUp, onMoveDown }) {
  const { t } = useLanguage()
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(item.text)

  const handleSave = () => {
    if (editText.trim() && editText !== item.text) {
      onUpdate(editText.trim())
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditText(item.text)
    setIsEditing(false)
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 group hover:border-gray-300">
      <span className="font-semibold text-gray-500 min-w-[2rem]">{index + 1}.</span>

      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') handleCancel()
          }}
          onBlur={handleSave}
          className="flex-1 input py-1 px-2 text-sm"
          autoFocus
        />
      ) : (
        <span className="flex-1 text-gray-900 cursor-pointer" onClick={() => setIsEditing(true)}>
          {item.text}
        </span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move up"
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === totalItems - 1}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move down"
        >
          <ChevronDown className="w-4 h-4" />
        </button>

        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="p-1 text-blue-600 hover:text-blue-800"
            title={t('common.edit')}
          >
            <Edit className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-red-600 hover:text-red-800"
          title={t('common.delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
