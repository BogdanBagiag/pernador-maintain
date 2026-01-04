import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { 
  Plus, 
  Calendar,
  Wrench,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2,
  Play,
  Pause,
  Clock,
  User,
  Filter
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import EnhancedScheduleForm from '../components/EnhancedScheduleForm'
import ScheduleCompletionWizard from '../components/ScheduleCompletionWizard'

export default function MaintenanceSchedules() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [statusFilter, setStatusFilter] = useState('upcoming')
  const [showCompletionWizard, setShowCompletionWizard] = useState(false)
  const [selectedScheduleForCompletion, setSelectedScheduleForCompletion] = useState(null)

  // Fetch schedules with equipment info and checklist templates
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['maintenance-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select(`
          *,
          equipment:equipment(id, name, serial_number),
          assigned_user:profiles!maintenance_schedules_assigned_to_fkey(id, full_name),
          checklist_template:checklist_templates(id, name, items),
          procedure_template:procedure_templates(id, name, steps)
        `)
        .order('next_due_date', { ascending: true })
      
      if (error) throw error
      return data
    },
  })

  // Fetch equipment list for form
  const { data: equipment } = useQuery({
    queryKey: ['equipment-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('id, name, serial_number')
        .order('name')
      if (error) throw error
      return data
    },
  })

  // Fetch users for assignment
  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name')
      if (error) throw error
      return data
    },
  })

  // Fetch checklist templates
  const { data: checklistTemplates } = useQuery({
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

  // Fetch procedure templates
  const { data: procedureTemplates } = useQuery({
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

  // Save mutation (create/update)
  const saveMutation = useMutation({
    mutationFn: async ({ schedule, data }) => {
      if (schedule) {
        // Update
        const { error } = await supabase
          .from('maintenance_schedules')
          .update(data)
          .eq('id', schedule.id)
        if (error) throw error
      } else {
        // Create
        const { error } = await supabase
          .from('maintenance_schedules')
          .insert([{ ...data, created_by: user.id }])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedules'] })
      setShowModal(false)
      setEditingSchedule(null)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('maintenance_schedules')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedules'] })
    },
  })

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }) => {
      const { error } = await supabase
        .from('maintenance_schedules')
        .update({ is_active: !isActive })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedules'] })
    },
  })

  const isOverdue = (dueDate) => {
    return new Date(dueDate) < new Date()
  }

  const getDaysUntilDue = (dueDate) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = due - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getFrequencyLabel = (frequency) => {
    return {
      daily: 'Daily',
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      semiannually: 'Semi-annually',
      annually: 'Annually'
    }[frequency] || frequency
  }

  // Filter schedules
  const filteredSchedules = schedules?.filter(schedule => {
    if (statusFilter === 'active') return schedule.is_active
    if (statusFilter === 'inactive') return !schedule.is_active
    if (statusFilter === 'overdue') return schedule.is_active && isOverdue(schedule.next_due_date)
    if (statusFilter === 'upcoming') {
      const days = getDaysUntilDue(schedule.next_due_date)
      return schedule.is_active && days >= 0 && days <= 7
    }
    if (statusFilter === 'completed') return schedule.last_completed_date !== null
    return schedule.is_active // default to active instead of all
  })

  // Calculate stats
  const stats = {
    total: schedules?.length || 0,
    active: schedules?.filter(s => s.is_active).length || 0,
    overdue: schedules?.filter(s => s.is_active && isOverdue(s.next_due_date)).length || 0,
    dueThisWeek: schedules?.filter(s => {
      const days = getDaysUntilDue(s.next_due_date)
      return s.is_active && days >= 0 && days <= 7
    }).length || 0
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
          <h1 className="text-3xl font-bold text-gray-900">Programe Mentenanță</h1>
          <p className="text-gray-600 mt-1">Gestionează programele de mentenanță preventivă</p>
        </div>
        <button
          onClick={() => {
            setEditingSchedule(null)
            setShowModal(true)
          }}
          className="btn-primary mt-4 sm:mt-0 inline-flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Program Nou
        </button>
      </div>

      {/* Enhanced Filter Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {/* Upcoming - PRIMUL */}
        <button
          onClick={() => setStatusFilter('upcoming')}
          className={`p-4 rounded-lg border-2 transition-all ${
            statusFilter === 'upcoming'
              ? 'border-yellow-400 bg-yellow-100 ring-2 ring-yellow-300'
              : 'border-yellow-200 bg-yellow-50 hover:border-yellow-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-2xl font-bold ${statusFilter === 'upcoming' ? 'text-yellow-900' : 'text-yellow-700'}`}>
              {stats.dueThisWeek}
            </span>
            <Clock className={`w-6 h-6 ${statusFilter === 'upcoming' ? 'text-yellow-700' : 'text-yellow-400'} opacity-50`} />
          </div>
          <p className={`text-sm font-medium ${statusFilter === 'upcoming' ? 'text-yellow-800' : 'text-yellow-600'}`}>
            Următoarele 7 Zile
          </p>
        </button>

        {/* Active */}
        <button
          onClick={() => setStatusFilter('active')}
          className={`p-4 rounded-lg border-2 transition-all ${
            statusFilter === 'active'
              ? 'border-green-400 bg-green-100 ring-2 ring-green-300'
              : 'border-green-200 bg-green-50 hover:border-green-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-2xl font-bold ${statusFilter === 'active' ? 'text-green-900' : 'text-green-700'}`}>
              {stats.active}
            </span>
            <CheckCircle className={`w-6 h-6 ${statusFilter === 'active' ? 'text-green-700' : 'text-green-400'} opacity-50`} />
          </div>
          <p className={`text-sm font-medium ${statusFilter === 'active' ? 'text-green-800' : 'text-green-600'}`}>
            Active
          </p>
        </button>

        {/* Overdue */}
        <button
          onClick={() => setStatusFilter('overdue')}
          className={`p-4 rounded-lg border-2 transition-all ${
            statusFilter === 'overdue'
              ? 'border-red-400 bg-red-100 ring-2 ring-red-300'
              : 'border-red-200 bg-red-50 hover:border-red-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-2xl font-bold ${statusFilter === 'overdue' ? 'text-red-900' : 'text-red-700'}`}>
              {stats.overdue}
            </span>
            <AlertCircle className={`w-6 h-6 ${statusFilter === 'overdue' ? 'text-red-700' : 'text-red-400'} opacity-50`} />
          </div>
          <p className={`text-sm font-medium ${statusFilter === 'overdue' ? 'text-red-800' : 'text-red-600'}`}>
            Întârziate
          </p>
        </button>

        {/* Completed */}
        <button
          onClick={() => setStatusFilter('completed')}
          className={`p-4 rounded-lg border-2 transition-all ${
            statusFilter === 'completed'
              ? 'border-blue-400 bg-blue-100 ring-2 ring-blue-300'
              : 'border-blue-200 bg-blue-50 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-2xl font-bold ${statusFilter === 'completed' ? 'text-blue-900' : 'text-blue-700'}`}>
              {schedules?.filter(s => s.last_completed_date !== null).length || 0}
            </span>
            <CheckCircle className={`w-6 h-6 ${statusFilter === 'completed' ? 'text-blue-700' : 'text-blue-400'} opacity-50`} />
          </div>
          <p className={`text-sm font-medium ${statusFilter === 'completed' ? 'text-blue-800' : 'text-blue-600'}`}>
            Finalizate
          </p>
        </button>
      </div>

      {/* Completed Filter */}
      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-gray-700">Additional Filters:</span>
          </div>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={statusFilter === 'completed'}
              onChange={(e) => setStatusFilter(e.target.checked ? 'completed' : 'all')}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show Completed Only</span>
          </label>
        </div>
      </div>

      {/* Schedules List */}
      {!filteredSchedules || filteredSchedules.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {statusFilter !== 'all' ? 'No schedules found' : 'No schedules yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {statusFilter !== 'all' 
              ? 'Try adjusting your filter' 
              : 'Create your first maintenance schedule to get started'}
          </p>
          {statusFilter === 'all' && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary inline-flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Schedule
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSchedules.map((schedule) => {
            const daysUntil = getDaysUntilDue(schedule.next_due_date)
            const overdue = isOverdue(schedule.next_due_date)
            const hasChecklist = schedule.checklist_template_id || (schedule.custom_checklist && schedule.custom_checklist.length > 0)
            const hasProcedure = schedule.procedure_template_id || (schedule.procedure_steps && schedule.procedure_steps.length > 0)
            
            // Determine card color
            let cardClass = 'card'
            let statusBadge = null
            
            if (!schedule.is_active) {
              cardClass = 'card bg-gray-50 border-gray-300'
              statusBadge = { color: 'gray', text: 'Inactive', icon: Pause }
            } else if (overdue) {
              cardClass = 'card bg-red-50 border-red-300 border-2'
              statusBadge = { color: 'red', text: 'Overdue', icon: AlertCircle }
            } else if (daysUntil >= 0 && daysUntil <= 7) {
              cardClass = 'card bg-yellow-50 border-yellow-300 border-2'
              statusBadge = { color: 'yellow', text: 'Due Soon', icon: Clock }
            } else if (schedule.is_active) {
              cardClass = 'card bg-green-50 border-green-200'
              statusBadge = { color: 'green', text: 'Active', icon: CheckCircle }
            }

            return (
              <div key={schedule.id} className={cardClass}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-start space-x-4">
                      <div className={`p-2 rounded-lg ${
                        !schedule.is_active ? 'bg-gray-200' :
                        overdue ? 'bg-red-200' :
                        daysUntil >= 0 && daysUntil <= 7 ? 'bg-yellow-200' :
                        'bg-green-200'
                      }`}>
                        <Wrench className={`w-6 h-6 ${
                          !schedule.is_active ? 'text-gray-600' :
                          overdue ? 'text-red-700' :
                          daysUntil >= 0 && daysUntil <= 7 ? 'text-yellow-700' :
                          'text-green-700'
                        }`} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {schedule.title}
                          </h3>
                          {statusBadge && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${statusBadge.color}-100 text-${statusBadge.color}-800 border border-${statusBadge.color}-200`}>
                              <statusBadge.icon className="w-3 h-3 mr-1" />
                              {statusBadge.text}
                            </span>
                          )}
                        </div>
                        
                        {schedule.equipment && (
                          <Link
                            to={`/equipment/${schedule.equipment.id}`}
                            className="text-sm text-primary-600 hover:text-primary-700 mb-2 inline-block"
                          >
                            Equipment: {schedule.equipment.name}
                            {schedule.equipment.serial_number && ` (SN: ${schedule.equipment.serial_number})`}
                          </Link>
                        )}

                        {schedule.description && (
                          <p className="text-sm text-gray-600 mb-3">{schedule.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge badge-secondary">
                            {getFrequencyLabel(schedule.frequency)}
                          </span>

                          {hasProcedure && (
                            <span className="badge bg-purple-100 text-purple-800 border-purple-200">
                              📋 Procedure
                            </span>
                          )}

                          {hasChecklist && (
                            <span className="badge bg-blue-100 text-blue-800 border-blue-200">
                              ✓ Checklist
                            </span>
                          )}

                          {schedule.repeat_count && (
                            <span className="badge bg-orange-100 text-orange-800 border-orange-200">
                              {schedule.times_completed || 0} / {schedule.repeat_count} times
                            </span>
                          )}

                          {schedule.assigned_user && (
                            <span className="text-sm text-gray-600 flex items-center">
                              <User className="w-4 h-4 mr-1" />
                              {schedule.assigned_user.full_name}
                            </span>
                          )}

                          {schedule.estimated_hours && (
                            <span className="text-sm text-gray-600 flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {schedule.estimated_hours}h
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-2 ml-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Next Due:</p>
                      <p className={`text-lg font-semibold ${
                        overdue ? 'text-red-600' :
                        daysUntil >= 0 && daysUntil <= 7 ? 'text-yellow-600' :
                        'text-gray-900'
                      }`}>
                        {new Date(schedule.next_due_date).toLocaleDateString()}
                      </p>
                      {schedule.is_active && (
                        <p className={`text-xs font-medium ${
                          overdue ? 'text-red-600' :
                          daysUntil >= 0 && daysUntil <= 7 ? 'text-yellow-600' :
                          'text-gray-500'
                        }`}>
                          {overdue ? (
                            <>⚠️ {Math.abs(daysUntil)} days overdue</>
                          ) : daysUntil === 0 ? (
                            <>🔔 Due today!</>
                          ) : daysUntil <= 7 ? (
                            <>⏰ In {daysUntil} days</>
                          ) : (
                            <>✓ In {daysUntil} days</>
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {schedule.is_active && (
                        <button
                          onClick={() => {
                            setSelectedScheduleForCompletion(schedule)
                            setShowCompletionWizard(true)
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Complete Maintenance"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}

                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: schedule.id, isActive: schedule.is_active })}
                        disabled={toggleActiveMutation.isLoading}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title={schedule.is_active ? 'Pause' : 'Resume'}
                      >
                        {schedule.is_active ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </button>

                      <button
                        onClick={() => {
                          setEditingSchedule(schedule)
                          setShowModal(true)
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this schedule?')) {
                            deleteMutation.mutate(schedule.id)
                          }
                        }}
                        disabled={deleteMutation.isLoading}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {schedule.last_completed_date && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-600">
                      Last completed: {new Date(schedule.last_completed_date).toLocaleDateString()}
                      {schedule.times_completed > 0 && (
                        <span className="ml-2 text-green-600 font-medium">
                          ({schedule.times_completed} {schedule.times_completed === 1 ? 'time' : 'times'})
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Enhanced Schedule Form Modal */}
      {showModal && (
        <EnhancedScheduleForm
          schedule={editingSchedule}
          equipment={equipment}
          users={users}
          checklistTemplates={checklistTemplates}
          procedureTemplates={procedureTemplates}
          onSave={(data) => saveMutation.mutate({ schedule: editingSchedule, data })}
          onClose={() => {
            setShowModal(false)
            setEditingSchedule(null)
          }}
        />
      )}

      {/* Completion Wizard Modal */}
      {showCompletionWizard && selectedScheduleForCompletion && (
        <ScheduleCompletionWizard
          schedule={selectedScheduleForCompletion}
          onClose={() => {
            setShowCompletionWizard(false)
            setSelectedScheduleForCompletion(null)
          }}
          onComplete={() => {
            setShowCompletionWizard(false)
            setSelectedScheduleForCompletion(null)
          }}
        />
      )}
    </div>
  )
}
