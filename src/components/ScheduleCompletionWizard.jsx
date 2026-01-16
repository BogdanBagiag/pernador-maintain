import { useState } from 'react'
import { X, Check, ChevronRight, ChevronLeft, Save, Clock, FileText } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

export default function ScheduleCompletionWizard({ schedule, onClose, onComplete }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  // Get procedure steps and checklist
  const procedureSteps = schedule.procedure_template?.steps || schedule.procedure_steps || []
  const checklistItems = schedule.checklist_template?.items || schedule.custom_checklist || []
  
  const [currentStep, setCurrentStep] = useState(0)
  const totalSteps = 2 + (procedureSteps.length > 0 ? 1 : 0) + (checklistItems.length > 0 ? 1 : 0)
  
  // Form state
  const [checklistState, setChecklistState] = useState(
    checklistItems.reduce((acc, item) => ({
      ...acc,
      [item.id]: { checked: false, notes: '' }
    }), {})
  )
  const [procedureNotes, setProcedureNotes] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [startTime] = useState(new Date())

  // Calculate next due date
  const calculateNextDueDate = (fromDate, frequency) => {
    const date = new Date(fromDate)
    switch (frequency) {
      case 'daily': return new Date(date.setDate(date.getDate() + 1))
      case 'weekly': return new Date(date.setDate(date.getDate() + 7))
      case 'monthly': return new Date(date.setMonth(date.getMonth() + 1))
      case 'quarterly': return new Date(date.setMonth(date.getMonth() + 3))
      case 'yearly': return new Date(date.setFullYear(date.getFullYear() + 1))
      default: return new Date(date.setMonth(date.getMonth() + 1))
    }
  }

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      const now = new Date()
      const nextDue = calculateNextDueDate(now, schedule.frequency)
      
      // 1. Create completion record
      const { data: completion, error: completionError } = await supabase
        .from('schedule_completions')
        .insert([{
          schedule_id: schedule.id,
          completed_by: user.id,
          completed_at: now.toISOString(),
          checklist_results: checklistState,
          procedure_notes: procedureNotes || null,
          duration_hours: durationHours ? parseFloat(durationHours) : null
        }])
        .select()
        .single()
      
      if (completionError) throw completionError

      // 2. Update schedule
      const { error: scheduleError } = await supabase
        .from('maintenance_schedules')
        .update({
          last_completed_date: now.toISOString(),
          next_due_date: nextDue.toISOString()
        })
        .eq('id', schedule.id)
      
      if (scheduleError) throw scheduleError

      // 3. Create work order
      const { data: workOrder, error: woError } = await supabase
        .from('work_orders')
        .insert([{
          title: `${schedule.title} - Scheduled Maintenance`,
          description: schedule.description,
          equipment_id: schedule.equipment_id,
          type: 'preventive',
          priority: 'medium',
          status: 'completed',
          assigned_to: schedule.assigned_to || user.id,
          completed_date: now.toISOString(),
          actual_hours: durationHours ? parseFloat(durationHours) : null,
          created_by: user.id
        }])
        .select()
        .single()
      
      if (woError) throw woError

      // 4. Link work order to completion
      await supabase
        .from('schedule_completions')
        .update({ work_order_id: workOrder.id })
        .eq('id', completion.id)

      return { completion, workOrder }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-work-orders'] })
      onComplete?.()
    },
  })

  const toggleChecklistItem = (itemId) => {
    setChecklistState(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        checked: !prev[itemId].checked
      }
    }))
  }

  const updateChecklistNotes = (itemId, notes) => {
    setChecklistState(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        notes
      }
    }))
  }

  const canProceed = () => {
    if (currentStep === totalSteps - 1) {
      // Final step - check if all required items are checked
      const allChecked = checklistItems.every(item => checklistState[item.id]?.checked)
      return allChecked
    }
    return true
  }

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    } else if (canProceed()) {
      completeMutation.mutate()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const checkedCount = Object.values(checklistState).filter(item => item.checked).length
  const completionPercentage = checklistItems.length > 0 
    ? Math.round((checkedCount / checklistItems.length) * 100)
    : 0

  // Render step content
  const renderStepContent = () => {
    let stepIndex = 0

    // Step 0: Overview
    if (currentStep === stepIndex++) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {schedule.title}
            </h3>
            <p className="text-gray-600">
              {schedule.equipment?.name}
              {schedule.equipment?.serial_number && ` (SN: ${schedule.equipment.serial_number})`}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <h4 className="font-semibold text-gray-900">Maintenance Overview</h4>
            
            {schedule.description && (
              <div>
                <p className="text-sm text-gray-600">{schedule.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              {schedule.estimated_hours && (
                <div>
                  <span className="text-gray-600">Estimated Duration:</span>
                  <p className="font-medium text-gray-900">{schedule.estimated_hours} hours</p>
                </div>
              )}
              
              <div>
                <span className="text-gray-600">Frequency:</span>
                <p className="font-medium text-gray-900 capitalize">
                  {schedule.frequency.replace('_', ' ')}
                </p>
              </div>

              {procedureSteps.length > 0 && (
                <div>
                  <span className="text-gray-600">Procedure Steps:</span>
                  <p className="font-medium text-gray-900">{procedureSteps.length} steps</p>
                </div>
              )}

              {checklistItems.length > 0 && (
                <div>
                  <span className="text-gray-600">Checklist Items:</span>
                  <p className="font-medium text-gray-900">{checklistItems.length} items</p>
                </div>
              )}

              {schedule.repeat_count && (
                <div>
                  <span className="text-gray-600">Completions:</span>
                  <p className="font-medium text-gray-900">
                    {schedule.times_completed || 0} / {schedule.repeat_count}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Ready to begin?</strong> Follow the procedure steps and complete the checklist to finish this maintenance task.
            </p>
          </div>
        </div>
      )
    }

    // Step 1: Procedure (if exists)
    if (procedureSteps.length > 0 && currentStep === stepIndex++) {
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Procedure Steps</h3>
            <p className="text-gray-600">Follow these steps in order to complete the maintenance.</p>
          </div>

          <div className="space-y-3">
            {procedureSteps.map((step, index) => {
              const stepText = typeof step === 'string' ? step : step.text
              const stepImage = typeof step === 'object' ? step.image_url : null
              
              return (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start gap-4 mb-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900">{stepText}</p>
                    </div>
                  </div>
                  {stepImage && (
                    <div className="ml-12">
                      <img 
                        src={stepImage} 
                        alt={`Step ${index + 1}`} 
                        className="max-h-64 rounded border border-gray-300"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Procedure Notes (Optional)
            </label>
            <textarea
              value={procedureNotes}
              onChange={(e) => setProcedureNotes(e.target.value)}
              rows={4}
              className="input"
              placeholder="Add any observations, issues found, or additional notes about the procedure..."
            />
          </div>
        </div>
      )
    }

    // Step 2: Checklist (if exists)
    if (checklistItems.length > 0 && currentStep === stepIndex++) {
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Checklist</h3>
            <p className="text-gray-600">
              Complete all items before finishing. Check off each item as you complete it.
            </p>
          </div>

          {/* Progress Bar */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-semibold text-blue-600">
                {checkedCount} / {checklistItems.length} ({completionPercentage}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Checklist Items */}
          <div className="space-y-3">
            {checklistItems.map((item, index) => (
              <div
                key={item.id}
                className={`border rounded-lg p-4 transition-all ${
                  checklistState[item.id]?.checked
                    ? 'bg-green-50 border-green-300'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleChecklistItem(item.id)}
                    className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                      checklistState[item.id]?.checked
                        ? 'bg-green-600 border-green-600'
                        : 'bg-white border-gray-300 hover:border-green-500'
                    }`}
                  >
                    {checklistState[item.id]?.checked && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </button>
                  
                  <div className="flex-1">
                    <p className={`font-medium ${
                      checklistState[item.id]?.checked ? 'text-green-900 line-through' : 'text-gray-900'
                    }`}>
                      {item.text}
                    </p>
                    
                    <input
                      type="text"
                      value={checklistState[item.id]?.notes || ''}
                      onChange={(e) => updateChecklistNotes(item.id, e.target.value)}
                      placeholder="Add notes (optional)..."
                      className="mt-2 input text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {checkedCount < checklistItems.length && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-900">
                <strong>Note:</strong> You must complete all checklist items before finishing.
              </p>
            </div>
          )}
        </div>
      )
    }

    // Final Step: Summary
    if (currentStep === stepIndex++) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Ready to Complete
            </h3>
            <p className="text-gray-600">
              Review your work and add final details before completing.
            </p>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <h4 className="font-semibold text-gray-900">Completion Summary</h4>
            
            {procedureSteps.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Procedure Steps Completed:</p>
                <p className="font-medium text-gray-900">{procedureSteps.length} steps</p>
              </div>
            )}

            {checklistItems.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Checklist Items Completed:</p>
                <p className="font-medium text-green-600">
                  {checkedCount} / {checklistItems.length} items ({completionPercentage}%)
                </p>
              </div>
            )}

            {procedureNotes && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Procedure Notes:</p>
                <p className="text-sm text-gray-900 bg-white p-3 rounded border">
                  {procedureNotes}
                </p>
              </div>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Actual Duration (hours)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              className="input"
              placeholder={schedule.estimated_hours || "0.0"}
            />
            <p className="text-xs text-gray-500 mt-1">
              {schedule.estimated_hours && `Estimated: ${schedule.estimated_hours} hours`}
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-900">
              <strong>Everything looks good!</strong> Click "Complete Maintenance" to finish and update the schedule.
            </p>
          </div>
        </div>
      )
    }

    return null
  }

  if (completeMutation.isSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Maintenance Complete!
          </h3>
          <p className="text-gray-600 mb-6">
            The schedule has been updated and a work order has been created.
          </p>
          <button
            onClick={onClose}
            className="btn-primary w-full"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full my-8">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Complete Maintenance</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={completeMutation.isLoading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-between">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div key={index} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  index < currentStep
                    ? 'bg-green-600 text-white'
                    : index === currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {index < currentStep ? <Check className="w-5 h-5" /> : index + 1}
                </div>
                {index < totalSteps - 1 && (
                  <div className={`flex-1 h-1 mx-2 ${
                    index < currentStep ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentStep === 0 || completeMutation.isLoading}
            className="btn-secondary inline-flex items-center disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Previous
          </button>

          <span className="text-sm text-gray-600">
            Step {currentStep + 1} of {totalSteps}
          </span>

          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed() || completeMutation.isLoading}
            className="btn-primary inline-flex items-center disabled:opacity-50"
          >
            {completeMutation.isLoading ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Completing...</span>
              </>
            ) : currentStep === totalSteps - 1 ? (
              <>
                <Save className="w-5 h-5 mr-2" />
                Complete Maintenance
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-5 h-5 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
