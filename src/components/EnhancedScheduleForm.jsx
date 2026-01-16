import { useState } from 'react'
import { X, Plus, GripVertical, Trash2, Check } from 'lucide-react'

export default function EnhancedScheduleForm({ schedule, onSave, onClose, equipment, users, checklistTemplates, procedureTemplates }) {
  const [formData, setFormData] = useState({
    title_type: schedule?.title || 'custom',
    custom_title: '',
    equipment_id: schedule?.equipment_id || '',
    frequency: schedule?.frequency || 'monthly',
    assigned_to: schedule?.assigned_to || '',
    estimated_hours: schedule?.estimated_hours || '',
    next_due_date: schedule?.next_due_date ? schedule.next_due_date.split('T')[0] : '',
    description: schedule?.description || '',
    repeat_count: schedule?.repeat_count || '',
    auto_pause_when_done: schedule?.auto_pause_when_done || false,
    
    // Procedures
    procedure_template_id: schedule?.procedure_template_id || '',
    procedure_steps: schedule?.procedure_steps || [],
    
    // Checklist
    checklist_template_id: schedule?.checklist_template_id || '',
    custom_checklist: schedule?.custom_checklist || []
  })

  const [currentStep, setCurrentStep] = useState('')
  const [currentChecklistItem, setCurrentChecklistItem] = useState('')
  const [errors, setErrors] = useState({})

  const maintenanceTypes = [
    { value: 'Filter Change', label: 'Filter Change', hours: 1 },
    { value: 'Oil Change', label: 'Oil Change', hours: 1.5 },
    { value: 'System Inspection', label: 'System Inspection', hours: 2 },
    { value: 'Cleaning & Lubrication', label: 'Cleaning & Lubrication', hours: 1.5 },
    { value: 'Calibration', label: 'Calibration', hours: 2 },
    { value: 'Safety Check', label: 'Safety Check', hours: 1 },
    { value: 'Belt Replacement', label: 'Belt Replacement', hours: 1 },
    { value: 'Fluid Level Check', label: 'Fluid Level Check', hours: 0.5 },
    { value: 'Electrical Testing', label: 'Electrical Testing', hours: 2 },
    { value: 'Deep Cleaning', label: 'Deep Cleaning', hours: 3 },
    { value: 'Parts Replacement', label: 'Parts Replacement', hours: 2 },
    { value: 'Performance Testing', label: 'Performance Testing', hours: 2 },
    { value: 'Complete Service', label: 'Complete Service', hours: 4 },
    { value: 'custom', label: 'Custom (specify below)', hours: 0 }
  ]

  const selectedTemplate = checklistTemplates?.find(t => t.id === formData.checklist_template_id)
  const selectedProcedureTemplate = procedureTemplates?.find(t => t.id === formData.procedure_template_id)
  const displayChecklist = selectedTemplate?.items || formData.custom_checklist

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else if (name === 'title_type') {
      const selectedType = maintenanceTypes.find(t => t.value === value)
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        title: value === 'custom' ? prev.custom_title : value,
        estimated_hours: selectedType?.hours || prev.estimated_hours
      }))
    } else if (name === 'custom_title') {
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        title: value
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  // Procedure Steps Management
  const addProcedureStep = () => {
    if (!currentStep.trim()) return
    setFormData(prev => ({
      ...prev,
      procedure_steps: [...prev.procedure_steps, currentStep.trim()]
    }))
    setCurrentStep('')
  }

  const removeProcedureStep = (index) => {
    setFormData(prev => ({
      ...prev,
      procedure_steps: prev.procedure_steps.filter((_, i) => i !== index)
    }))
  }

  const moveProcedureStep = (index, direction) => {
    const newSteps = [...formData.procedure_steps]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= newSteps.length) return
    
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]]
    setFormData(prev => ({ ...prev, procedure_steps: newSteps }))
  }

  // Checklist Management
  const addChecklistItem = () => {
    if (!currentChecklistItem.trim()) return
    const newItem = {
      id: Date.now(),
      text: currentChecklistItem.trim(),
      order: formData.custom_checklist.length + 1
    }
    setFormData(prev => ({
      ...prev,
      custom_checklist: [...prev.custom_checklist, newItem]
    }))
    setCurrentChecklistItem('')
  }

  const removeChecklistItem = (itemId) => {
    setFormData(prev => ({
      ...prev,
      custom_checklist: prev.custom_checklist.filter(item => item.id !== itemId)
    }))
  }

  const handleTemplateChange = (templateId) => {
    setFormData(prev => ({
      ...prev,
      checklist_template_id: templateId,
      custom_checklist: [] // Clear custom when template selected
    }))
  }

  const handleProcedureTemplateChange = (templateId) => {
    setFormData(prev => ({
      ...prev,
      procedure_template_id: templateId,
      procedure_steps: [] // Clear custom when template selected
    }))
  }

  const validate = () => {
    const newErrors = {}

    if (formData.title_type === 'custom' && !formData.custom_title.trim()) {
      newErrors.custom_title = 'Custom title is required'
    }

    if (!formData.title_type) {
      newErrors.title_type = 'Maintenance type is required'
    }

    if (!formData.equipment_id) {
      newErrors.equipment_id = 'Equipment is required'
    }

    if (!formData.frequency) {
      newErrors.frequency = 'Frequency is required'
    }

    if (!formData.next_due_date) {
      newErrors.next_due_date = 'Next due date is required'
    }

    if (formData.repeat_count && parseInt(formData.repeat_count) < 1) {
      newErrors.repeat_count = 'Repeat count must be at least 1'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!validate()) return

    const dataToSave = {
      title: formData.title_type === 'custom' ? formData.custom_title : formData.title_type,
      equipment_id: formData.equipment_id,
      frequency: formData.frequency,
      next_due_date: formData.next_due_date,
      procedure_template_id: formData.procedure_template_id || null,
      procedure_steps: formData.procedure_steps.length > 0 ? formData.procedure_steps : null,
      repeat_count: formData.repeat_count ? parseInt(formData.repeat_count) : null,
      auto_pause_when_done: formData.auto_pause_when_done,
      checklist_template_id: formData.checklist_template_id || null,
      custom_checklist: formData.custom_checklist.length > 0 ? formData.custom_checklist : null
    }

    if (formData.description.trim()) {
      dataToSave.description = formData.description.trim()
    }
    
    if (formData.assigned_to) {
      dataToSave.assigned_to = formData.assigned_to
    }
    
    if (formData.estimated_hours) {
      dataToSave.estimated_hours = parseFloat(formData.estimated_hours)
    }

    onSave(dataToSave)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8 max-h-[90vh] flex flex-col">
        <div className="p-6 overflow-y-auto flex-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 pb-4 border-b">
            <h3 className="text-2xl font-bold text-gray-900">
              {schedule ? 'Edit Schedule' : 'Create Schedule'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info Section */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg text-gray-900 border-b pb-2">Basic Information</h4>
              
              {/* Maintenance Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maintenance Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="title_type"
                  value={formData.title_type}
                  onChange={handleChange}
                  className={`input ${errors.title_type ? 'border-red-500' : ''}`}
                  required
                >
                  <option value="">Select type...</option>
                  {maintenanceTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label} {type.hours > 0 && `(~${type.hours}h)`}
                    </option>
                  ))}
                </select>
                {errors.title_type && <p className="text-sm text-red-600 mt-1">{errors.title_type}</p>}
              </div>

              {/* Custom Title */}
              {formData.title_type === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="custom_title"
                    type="text"
                    value={formData.custom_title}
                    onChange={handleChange}
                    className={`input ${errors.custom_title ? 'border-red-500' : ''}`}
                    placeholder="e.g., Quarterly HVAC Deep Clean"
                    required
                  />
                  {errors.custom_title && <p className="text-sm text-red-600 mt-1">{errors.custom_title}</p>}
                </div>
              )}

              {/* Equipment, Frequency, Next Due, Assigned, Hours */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Equipment <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="equipment_id"
                    value={formData.equipment_id}
                    onChange={handleChange}
                    className={`input ${errors.equipment_id ? 'border-red-500' : ''}`}
                    required
                  >
                    <option value="">Select equipment...</option>
                    {equipment?.map(eq => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} {eq.serial_number && `(SN: ${eq.serial_number})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frequency <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="frequency"
                    value={formData.frequency}
                    onChange={handleChange}
                    className="input"
                    required
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Next Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="next_due_date"
                    type="date"
                    value={formData.next_due_date}
                    onChange={handleChange}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign To
                  </label>
                  <select
                    name="assigned_to"
                    value={formData.assigned_to}
                    onChange={handleChange}
                    className="input"
                  >
                    <option value="">Unassigned</option>
                    {users?.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Hours
                  </label>
                  <input
                    name="estimated_hours"
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.estimated_hours}
                    onChange={handleChange}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Repeat Count
                    <span className="text-xs text-gray-500 ml-2">(leave empty for infinite)</span>
                  </label>
                  <input
                    name="repeat_count"
                    type="number"
                    min="1"
                    value={formData.repeat_count}
                    onChange={handleChange}
                    className="input"
                    placeholder="e.g., 12 (stops after 12 completions)"
                  />
                </div>
              </div>

              {/* Auto-pause checkbox */}
              {formData.repeat_count && (
                <div className="flex items-center">
                  <input
                    id="auto_pause"
                    name="auto_pause_when_done"
                    type="checkbox"
                    checked={formData.auto_pause_when_done}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="auto_pause" className="ml-2 text-sm text-gray-700">
                    Automatically pause schedule when repeat count is reached
                  </label>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={2}
                  value={formData.description}
                  onChange={handleChange}
                  className="input"
                  placeholder="Brief overview of this maintenance..."
                />
              </div>
            </div>

            {/* Procedure Section */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg text-gray-900 border-b pb-2">Procedure</h4>
              <p className="text-sm text-gray-600">Select a procedure template or create custom steps.</p>
              
              {/* Procedure Template Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Procedure Template
                </label>
                <select
                  value={formData.procedure_template_id}
                  onChange={(e) => handleProcedureTemplateChange(e.target.value)}
                  className="input"
                >
                  <option value="">None (use custom steps)</option>
                  {procedureTemplates?.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Show template preview or custom steps */}
              {formData.procedure_template_id ? (
                // Template Preview
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">Template Preview:</p>
                  <div className="space-y-2">
                    {selectedProcedureTemplate?.steps?.map((step, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <span className="font-semibold text-blue-800 min-w-[2rem]">{index + 1}.</span>
                        <div className="flex-1">
                          <p className="text-blue-900">{step.text}</p>
                          {step.image_url && (
                            <div className="mt-1 flex items-center text-xs text-blue-600">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Has image
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Custom Steps
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentStep}
                      onChange={(e) => setCurrentStep(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProcedureStep())}
                      placeholder="Enter a procedure step..."
                      className="input flex-1"
                    />
                    <button
                      type="button"
                      onClick={addProcedureStep}
                      className="btn-secondary"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {formData.procedure_steps.length > 0 && (
                    <div className="space-y-2">
                      {formData.procedure_steps.map((step, index) => (
                        <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                          <span className="font-semibold text-gray-500 min-w-[2rem]">{index + 1}.</span>
                          <span className="flex-1 text-gray-900">{step}</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => moveProcedureStep(index, 'up')}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveProcedureStep(index, 'down')}
                              disabled={index === formData.procedure_steps.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => removeProcedureStep(index)}
                              className="p-1 text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Checklist Section */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg text-gray-900 border-b pb-2">Checklist</h4>
              <p className="text-sm text-gray-600">Choose a template or create custom checklist items.</p>
              
              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Checklist Template
                </label>
                <select
                  value={formData.checklist_template_id}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="input"
                >
                  <option value="">None (use custom checklist)</option>
                  {checklistTemplates?.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Checklist */}
              {!formData.checklist_template_id && (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentChecklistItem}
                      onChange={(e) => setCurrentChecklistItem(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                      placeholder="Enter a checklist item..."
                      className="input flex-1"
                    />
                    <button
                      type="button"
                      onClick={addChecklistItem}
                      className="btn-secondary"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {formData.custom_checklist.length > 0 && (
                    <div className="space-y-2">
                      {formData.custom_checklist.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                          <Check className="w-5 h-5 text-gray-400" />
                          <span className="flex-1 text-gray-900">{item.text}</span>
                          <button
                            type="button"
                            onClick={() => removeChecklistItem(item.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Preview Template Checklist */}
              {formData.checklist_template_id && selectedTemplate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">Template Preview:</p>
                  <div className="space-y-2">
                    {selectedTemplate.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-blue-800">
                        <Check className="w-4 h-4" />
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
              >
                {schedule ? 'Update Schedule' : 'Create Schedule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
