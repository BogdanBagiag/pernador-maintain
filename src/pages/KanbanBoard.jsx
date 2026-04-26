import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, isPast, isToday, addDays } from 'date-fns'
import { ro } from 'date-fns/locale'
import {
  ArrowLeft, Plus, X, Check, Trash2,
  Calendar, User, MessageSquare, CheckSquare,
  Loader2, AlertCircle, GripVertical, Repeat, Pencil, Users,
  Link2, ExternalLink,
} from 'lucide-react'

// ── Constante ─────────────────────────────────────────────────
const PRIORITIES = {
  urgent: { label: 'Urgent',  color: 'bg-red-100 text-red-700 border-red-200' },
  high:   { label: 'Ridicat', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: 'Mediu',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low:    { label: 'Scăzut',  color: 'bg-gray-100 text-gray-600 border-gray-200' },
}

const DAYS_RO = ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ']
const DAYS_FULL_RO = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă']

function getDueDateStyle(dueDate) {
  if (!dueDate) return null
  const d = new Date(dueDate)
  if (isPast(d) && !isToday(d)) return 'text-red-500'
  if (isToday(d)) return 'text-amber-500'
  if (d <= addDays(new Date(), 3)) return 'text-orange-500'
  return 'text-emerald-600'
}

function getDueDateBadge(dueDate) {
  if (!dueDate) return null
  const d = new Date(dueDate)
  if (isPast(d) && !isToday(d)) {
    return { label: 'Overdue', className: 'bg-red-100 text-red-600 border-red-200' }
  }
  if (isToday(d)) {
    return { label: 'To do: azi', className: 'bg-amber-100 text-amber-700 border-amber-200' }
  }
  if (d <= addDays(new Date(), 1)) {
    return { label: 'To do: mâine', className: 'bg-orange-100 text-orange-700 border-orange-200' }
  }
  return { label: `To do: ${format(d, 'dd.MM.yyyy')}`, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
}

// ══════════════════════════════════════════════════════════════
// KanbanBoard — pagina principală
// ══════════════════════════════════════════════════════════════
export default function KanbanBoard() {
  const { boardId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  // Drag & Drop state
  const [dragState, setDragState] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  // UI state
  const [selectedTask, setSelectedTask] = useState(null)
  const [addingTaskCol, setAddingTaskCol] = useState(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')
  const [showRecurring, setShowRecurring] = useState(false)
  const [showMembers, setShowMembers] = useState(false)

  // Previne spawn dublu în același minut
  const lastCheckMinuteRef = useRef(null)

  // ── Queries ───────────────────────────────────────────────
  const { data: board, isLoading: boardLoading } = useQuery({
    queryKey: ['kan_board', boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kan_boards')
        .select('*')
        .eq('id', boardId)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: columns = [], isLoading: columnsLoading } = useQuery({
    queryKey: ['kan_columns', boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kan_columns')
        .select(`
          *,
          kan_tasks (
            *,
            assignee:kan_tasks_assignee_id_fkey ( id, full_name ),
            kan_subtasks ( id, completed ),
            kan_comments ( id )
          )
        `)
        .eq('board_id', boardId)
        .order('position')
      if (error) throw error
      return data.map((col) => ({
        ...col,
        kan_tasks: [...(col.kan_tasks || [])].sort((a, b) => a.position - b.position),
      }))
    },
  })

  const { data: members = [] } = useQuery({
    queryKey: ['profiles_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .order('full_name')
      if (error) throw error
      return data
    },
  })

  const { data: boardMembers = [] } = useQuery({
    queryKey: ['kan_board_members', boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kan_board_members')
        .select('user_id')
        .eq('board_id', boardId)
      if (error) throw error
      return data
    },
    enabled: !!boardId,
  })

  const { data: templates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ['kan_templates', boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kan_task_templates')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at')
      if (error) throw error
      return data
    },
    enabled: !!boardId,
  })

  const { data: nonWorkingDays = [] } = useQuery({
    queryKey: ['kan_non_working_days'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kan_non_working_days')
        .select('*')
        .order('date')
      if (error) throw error
      return data
    },
  })

  const canManageBoard = board && (isAdmin || isManager || board.created_by === user?.id)
  // Membru asociat: poate vedea, muta taskuri si bifa checklist, dar nu poate gestiona board-ul
  const isMemberOnly = !canManageBoard && boardMembers.some((m) => m.user_id === user?.id)

  // ── Spawn taskuri recurente ───────────────────────────────
  const checkAndSpawnRecurring = useCallback(async (tplList, colList, nonWorkingList) => {
    if (!tplList.length || !colList.length) return

    const now = new Date()
    const minuteKey = format(now, 'yyyy-MM-dd HH:mm')
    if (lastCheckMinuteRef.current === minuteKey) return
    lastCheckMinuteRef.current = minuteKey

    const todayStr = format(now, 'yyyy-MM-dd')

    // Nu spawnăm în zile nelucratoare
    if (nonWorkingList.some((d) => d.date === todayStr)) return
    const dayOfWeek = now.getDay()
    const dayOfMonth = now.getDate()

    const toSpawn = tplList.filter((tpl) => {
      if (tpl.last_spawned_date === todayStr) return false
      if (tpl.recurrence_time) {
        const [h, m] = tpl.recurrence_time.split(':').map(Number)
        if (now.getHours() < h || (now.getHours() === h && now.getMinutes() < m)) return false
      }
      if (tpl.recurrence_type === 'daily') return true
      if (tpl.recurrence_type === 'weekly') {
        const days = Array.isArray(tpl.recurrence_days) && tpl.recurrence_days.length > 0
          ? tpl.recurrence_days
          : (tpl.recurrence_day != null ? [tpl.recurrence_day] : [])
        return days.includes(dayOfWeek)
      }
      if (tpl.recurrence_type === 'monthly') return tpl.recurrence_day === dayOfMonth
      return false
    })

    if (!toSpawn.length) return

    for (const tpl of toSpawn) {
      const targetCol = tpl.column_id
        ? colList.find((c) => c.id === tpl.column_id)
        : colList[0]
      if (!targetCol) continue

      const { data: newTask, error: taskErr } = await supabase
        .from('kan_tasks')
        .insert({
          column_id: targetCol.id,
          title: tpl.name,
          description: tpl.description || null,
          priority: tpl.priority,
          assignee_id: tpl.assigned_to || null,
          created_by: user.id,
          position: targetCol.kan_tasks?.length || 0,
          template_id: tpl.id,
          due_date: todayStr,
        })
        .select()
        .single()

      if (taskErr) { console.error('Spawn error:', taskErr); continue }

      if (tpl.checklist?.length > 0) {
        await supabase.from('kan_subtasks').insert(
          tpl.checklist.map((item, i) => ({
            task_id: newTask.id,
            title: item.title,
            completed: false,
            position: i,
          }))
        )
      }

      await supabase
        .from('kan_task_templates')
        .update({ last_spawned_date: todayStr })
        .eq('id', tpl.id)
    }

    queryClient.invalidateQueries({ queryKey: ['kan_columns', boardId] })
    refetchTemplates()
  }, [user, boardId, queryClient, refetchTemplates])

  // Rulează la încărcare și la fiecare minut
  useEffect(() => {
    if (columnsLoading || !columns.length || !templates.length) return
    checkAndSpawnRecurring(templates, columns, nonWorkingDays)

    const interval = setInterval(() => {
      checkAndSpawnRecurring(templates, columns, nonWorkingDays)
    }, 60_000)

    return () => clearInterval(interval)
  }, [templates, columns, columnsLoading, nonWorkingDays, checkAndSpawnRecurring])

  // ── Mutations ─────────────────────────────────────────────
  const addTask = useMutation({
    mutationFn: async ({ columnId, title }) => {
      const col = columns.find((c) => c.id === columnId)
      const position = col?.kan_tasks?.length || 0
      const { data, error } = await supabase
        .from('kan_tasks')
        .insert({ column_id: columnId, title, created_by: user.id, position })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kan_columns', boardId] })
      setNewTaskTitle('')
      setAddingTaskCol(null)
    },
  })

  const finalizatCol = columns.find((c) => c.name?.toLowerCase().includes('finalizat'))

  const moveTask = useMutation({
    mutationFn: async ({ taskId, toColumnId }) => {
      const toCol = columns.find((c) => c.id === toColumnId)
      const newPosition = toCol?.kan_tasks?.length || 0
      const isFinalizat = toCol?.name?.toLowerCase().includes('finalizat')
      const { error } = await supabase
        .from('kan_tasks')
        .update({ column_id: toColumnId, position: newPosition, completed: isFinalizat, updated_at: new Date().toISOString() })
        .eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kan_columns', boardId] }),
  })

  const updateTask = useMutation({
    mutationFn: async ({ taskId, updates }) => {
      let finalUpdates = { ...updates, updated_at: new Date().toISOString() }

      // Dacă se bifează "finalizat", mută în coloana Finalizat
      if (updates.completed === true && finalizatCol) {
        const newPosition = finalizatCol.kan_tasks?.length || 0
        finalUpdates = { ...finalUpdates, column_id: finalizatCol.id, position: newPosition }
      }
      // Dacă se debifează, scoate din coloana Finalizat (mută în prima coloană)
      if (updates.completed === false && finalizatCol && selectedTask?.column_id === finalizatCol.id) {
        const firstCol = columns.find((c) => !c.name?.toLowerCase().includes('finalizat'))
        if (firstCol) {
          finalUpdates = { ...finalUpdates, column_id: firstCol.id, position: firstCol.kan_tasks?.length || 0 }
        }
      }

      const { data, error } = await supabase
        .from('kan_tasks')
        .update(finalUpdates)
        .eq('id', taskId)
        .select(`*, assignee:kan_tasks_assignee_id_fkey ( id, full_name )`)
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      setSelectedTask((prev) => (prev ? { ...prev, ...data } : null))
      queryClient.invalidateQueries({ queryKey: ['kan_columns', boardId] })
    },
  })

  const deleteTask = useMutation({
    mutationFn: async (taskId) => {
      const { error } = await supabase.from('kan_tasks').delete().eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      setSelectedTask(null)
      queryClient.invalidateQueries({ queryKey: ['kan_columns', boardId] })
    },
  })

  const addColumn = useMutation({
    mutationFn: async (name) => {
      const { error } = await supabase.from('kan_columns').insert({
        board_id: boardId,
        name,
        position: columns.length,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kan_columns', boardId] })
      setNewColumnName('')
      setAddingColumn(false)
    },
  })

  const deleteColumn = useMutation({
    mutationFn: async (columnId) => {
      const { error } = await supabase.from('kan_columns').delete().eq('id', columnId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kan_columns', boardId] }),
  })

  // ── Drag & Drop handlers ──────────────────────────────────
  const handleDragStart = useCallback((taskId, fromColumnId) => {
    setDragState({ taskId, fromColumnId })
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragState(null)
    setDragOverColumn(null)
  }, [])

  const handleDragOver = useCallback((e, columnId) => {
    e.preventDefault()
    setDragOverColumn(columnId)
  }, [])

  const handleDrop = useCallback((e, toColumnId) => {
    e.preventDefault()
    if (dragState && dragState.fromColumnId !== toColumnId) {
      moveTask.mutate({ taskId: dragState.taskId, toColumnId })
    }
    setDragState(null)
    setDragOverColumn(null)
  }, [dragState, moveTask])

  // ── Loading / Error states ────────────────────────────────
  if (boardLoading || columnsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-10 h-10 text-gray-300" />
        <p className="text-gray-500">Board-ul nu a fost găsit.</p>
        <button onClick={() => navigate('/todo')} className="text-primary-600 text-sm hover:underline">
          ← Înapoi la To Do
        </button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="flex flex-col -m-4 lg:-m-8" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* ── Board Header ── */}
      <div className="flex items-center gap-3 px-4 lg:px-8 py-4 bg-white border-b border-gray-200 flex-shrink-0">
        <button
          onClick={() => navigate('/todo')}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: board.color }} />

        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 truncate">{board.name}</h1>
          {board.description && (
            <p className="text-xs text-gray-400 truncate">{board.description}</p>
          )}
        </div>

        <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${
          board.type === 'team' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
        }`}>
          {board.type === 'team' ? '👥 Echipă' : '🔒 Personal'}
        </span>

        {/* Buton membri board — doar pentru board echipă cu drepturi de management */}
        {canManageBoard && !isMemberOnly && board.type === 'team' && (
          <button
            onClick={() => setShowMembers(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-200"
            title="Gestionează membri"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Membri</span>
            {boardMembers.length > 0 && (
              <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-medium leading-none">
                {boardMembers.length}
              </span>
            )}
          </button>
        )}

        {/* Buton taskuri recurente — ascuns pentru membri */}
        {canManageBoard && !isMemberOnly && (
          <button
            onClick={() => setShowRecurring(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200 hover:border-indigo-200"
            title="Taskuri recurente"
          >
            <Repeat className="w-4 h-4" />
            <span className="hidden sm:inline">Recurente</span>
            {templates.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full font-medium leading-none">
                {templates.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Columns area ── */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-4 lg:p-6 h-full" style={{ minWidth: 'max-content' }}>

          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              isDragOver={dragOverColumn === column.id}
              canManage={canManageBoard && !isMemberOnly}
              isAddingTask={addingTaskCol === column.id}
              newTaskTitle={newTaskTitle}
              dragState={dragState}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDrop={(e) => handleDrop(e, column.id)}
              onDragLeave={() => dragOverColumn === column.id && setDragOverColumn(null)}
              onStartAddTask={() => { setAddingTaskCol(column.id); setNewTaskTitle('') }}
              onCancelAddTask={() => setAddingTaskCol(null)}
              onNewTaskTitleChange={setNewTaskTitle}
              onAddTask={() => {
                if (newTaskTitle.trim()) addTask.mutate({ columnId: column.id, title: newTaskTitle.trim() })
              }}
              onDeleteColumn={() => {
                if (confirm(`Ștergi coloana "${column.name}" cu toate task-urile?`)) {
                  deleteColumn.mutate(column.id)
                }
              }}
              onTaskClick={setSelectedTask}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          ))}

          {/* ── Add Column ── */}
          <div className="w-72 flex-shrink-0 self-start">
            {canManageBoard && !isMemberOnly && (
              addingColumn ? (
                <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                  <input
                    autoFocus
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newColumnName.trim()) addColumn.mutate(newColumnName.trim())
                      if (e.key === 'Escape') setAddingColumn(false)
                    }}
                    placeholder="Nume coloană..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (newColumnName.trim()) addColumn.mutate(newColumnName.trim()) }}
                      disabled={addColumn.isPending}
                      className="flex-1 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                    >
                      Adaugă
                    </button>
                    <button
                      onClick={() => { setAddingColumn(false); setNewColumnName('') }}
                      className="px-3 py-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingColumn(true)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-gray-400 hover:text-gray-600 bg-gray-100/50 hover:bg-gray-100 rounded-xl text-sm font-medium transition-colors border-2 border-dashed border-gray-200 hover:border-gray-300"
                >
                  <Plus className="w-4 h-4" />
                  Coloană nouă
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Task Detail Drawer ── */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          boardId={boardId}
          columns={columns}
          members={members}
          currentUser={user}
          currentProfile={profile}
          isMemberOnly={isMemberOnly}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updates) => updateTask.mutate({ taskId: selectedTask.id, updates })}
          onDelete={() => deleteTask.mutate(selectedTask.id)}
          onMoveToColumn={(columnId) => {
            moveTask.mutate({ taskId: selectedTask.id, toColumnId: columnId })
            setSelectedTask(null)
          }}
        />
      )}

      {/* ── Recurring Templates Modal ── */}
      {showRecurring && (
        <RecurringModal
          boardId={boardId}
          columns={columns}
          members={members}
          currentUser={user}
          templates={templates}
          onClose={() => setShowRecurring(false)}
          onRefresh={() => {
            refetchTemplates()
            lastCheckMinuteRef.current = null // permite re-spawn după adăugare template
          }}
        />
      )}

      {/* ── Board Members Modal ── */}
      {showMembers && (
        <BoardMembersModal
          board={board}
          allProfiles={members.filter((p) => p.id !== user?.id)}
          currentMembers={boardMembers}
          onClose={() => setShowMembers(false)}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['kan_board_members', boardId] })}
        />
      )}

    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// KanbanColumn
// ══════════════════════════════════════════════════════════════
function KanbanColumn({
  column, isDragOver, canManage,
  isAddingTask, newTaskTitle, dragState,
  onDragOver, onDrop, onDragLeave,
  onStartAddTask, onCancelAddTask, onNewTaskTitleChange, onAddTask,
  onDeleteColumn, onTaskClick, onDragStart, onDragEnd,
}) {
  const tasks = column.kan_tasks || []

  return (
    <div
      className={`w-72 flex-shrink-0 flex flex-col rounded-2xl transition-all duration-150 ${
        isDragOver
          ? 'bg-primary-50 ring-2 ring-primary-300 ring-offset-1'
          : 'bg-gray-50'
      }`}
      style={{ maxHeight: 'calc(100vh - 160px)' }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: column.color }}
          />
          <span className="font-semibold text-sm text-gray-700">{column.name}</span>
          <span className="text-xs text-gray-400 bg-white border border-gray-200 rounded-full px-1.5 min-w-[20px] text-center">
            {tasks.length}
          </span>
        </div>
        {canManage && tasks.length === 0 && (
          <button
            onClick={onDeleteColumn}
            className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors"
            title="Șterge coloana (goală)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-2 pb-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isDragging={dragState?.taskId === task.id}
            onDragStart={() => onDragStart(task.id, column.id)}
            onDragEnd={onDragEnd}
            onClick={() => onTaskClick(task)}
          />
        ))}

        {tasks.length === 0 && !isDragOver && (
          <div className="py-8 text-center text-xs text-gray-300 select-none">
            Trage un task aici
          </div>
        )}

        {isDragOver && (
          <div className="h-16 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/50 flex items-center justify-center">
            <span className="text-xs text-primary-400 font-medium">Eliberează aici</span>
          </div>
        )}
      </div>

      {/* Add Task footer */}
      <div className="p-2 border-t border-gray-100">
        {isAddingTask ? (
          <div>
            <textarea
              autoFocus
              value={newTaskTitle}
              onChange={(e) => onNewTaskTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddTask() }
                if (e.key === 'Escape') onCancelAddTask()
              }}
              placeholder="Titlul task-ului... (Enter pentru a salva)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={2}
            />
            <div className="flex gap-1 mt-1.5">
              <button
                onClick={onAddTask}
                disabled={!newTaskTitle.trim()}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Adaugă
              </button>
              <button
                onClick={onCancelAddTask}
                className="px-3 py-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onStartAddTask}
            className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adaugă task
          </button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TaskCard
// ══════════════════════════════════════════════════════════════
const TaskCard = React.memo(function TaskCard({ task, isDragging, onDragStart, onDragEnd, onClick }) {
  const subtasks = task.kan_subtasks || []
  const comments = task.kan_comments || []
  const doneSubtasks = subtasks.filter((s) => s.completed).length
  const priority = PRIORITIES[task.priority]
  const dueDateStyle = getDueDateStyle(task.due_date)
  const dueDateBadge = getDueDateBadge(task.due_date)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 p-3 cursor-pointer select-none
        hover:shadow-md hover:border-gray-300 transition-all duration-150
        ${isDragging ? 'opacity-30 scale-95 rotate-1 shadow-lg' : ''}
        ${task.completed ? 'opacity-60' : ''}
      `}
    >
      {/* Top row: due date badge (stânga) + priority badge (dreapta) */}
      {(dueDateBadge || priority) && (
        <div className="flex items-center justify-between gap-2 mb-2">
          {dueDateBadge ? (
            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${dueDateBadge.className}`}>
              {dueDateBadge.label}
            </span>
          ) : <span />}
          {priority && (
            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${priority.color}`}>
              {priority.label}
            </span>
          )}
        </div>
      )}

      {/* Title */}
      <p className={`text-sm font-medium text-gray-800 leading-snug ${task.completed ? 'line-through text-gray-400' : ''}`}>
        {task.title}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {task.assignee?.full_name && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <User className="w-3 h-3" />
            {task.assignee.full_name.split(' ')[0]}
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {task.template_id && (
            <span className="flex items-center gap-0.5 text-xs text-indigo-400" title="Task recurent">
              <Repeat className="w-3 h-3" />
            </span>
          )}
          {subtasks.length > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <CheckSquare className="w-3 h-3" />
              {doneSubtasks}/{subtasks.length}
            </span>
          )}
          {comments.length > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <MessageSquare className="w-3 h-3" />
              {comments.length}
            </span>
          )}
        </div>
      </div>

      {/* Subtask progress bar */}
      {subtasks.length > 0 && (
        <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${(doneSubtasks / subtasks.length) * 100}%` }}
          />
        </div>
      )}

      <div className="flex justify-center mt-2 opacity-0 group-hover:opacity-100">
        <GripVertical className="w-3 h-3 text-gray-200" />
      </div>
    </div>
  )
})

// ══════════════════════════════════════════════════════════════
// TaskDetailModal — drawer lateral
// ══════════════════════════════════════════════════════════════
function TaskDetailModal({
  task, boardId, columns, members, currentUser, currentProfile,
  isMemberOnly,
  onClose, onUpdate, onDelete, onMoveToColumn,
}) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [priority, setPriority] = useState(task.priority || 'medium')
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '')
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [completed, setCompleted] = useState(task.completed)
  const [newSubtask,    setNewSubtask]    = useState('')
  const [newComment,    setNewComment]    = useState('')
  const [editingLinkId, setEditingLinkId] = useState(null) // id subtask cu URL deschis
  const [linkDraft,     setLinkDraft]     = useState('')
  const [postingComment, setPostingComment] = useState(false)

  // Auto-save
  const debounceRef = useRef(null)
  const mountedRef = useRef(false)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved'

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    if (!title.trim()) return
    setSaveStatus('saving')
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        await onUpdate({ title, description, priority, assignee_id: assigneeId || null, due_date: dueDate || null, completed })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch { setSaveStatus('idle') }
    }, 800)
    return () => clearTimeout(debounceRef.current)
  }, [title, description, priority, assigneeId, dueDate, completed])

  // Repeat state
  const [repeatOpen, setRepeatOpen] = useState(false)
  const [repeatType, setRepeatType] = useState('monthly')
  const [repeatDay, setRepeatDay] = useState(5)
  const [repeatDays, setRepeatDays] = useState([1])
  const [repeatColumnId, setRepeatColumnId] = useState('')
  const [repeatTime, setRepeatTime] = useState('')
  const [savingRepeat, setSavingRepeat] = useState(false)
  const [repeatSaved, setRepeatSaved] = useState(false)

  const isAdmin = currentProfile?.role === 'admin'
  const isManager = currentProfile?.role === 'manager'
  const canDelete = !isMemberOnly && (task.created_by === currentUser.id || isAdmin || isManager)

  const currentColumn = columns.find((c) => c.kan_tasks?.some((t) => t.id === task.id))

  const { data: subtasks = [], refetch: refetchSubtasks } = useQuery({
    queryKey: ['kan_subtasks', task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kan_subtasks')
        .select('*')
        .eq('task_id', task.id)
        .order('position')
      if (error) throw error
      return data
    },
  })

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['kan_comments', task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kan_comments')
        .select(`*, profiles ( full_name )`)
        .eq('task_id', task.id)
        .order('created_at')
      if (error) throw error
      return data
    },
  })

  // Fetch template dacă taskul are deja repeat setat
  const { data: existingTemplate, refetch: refetchTemplate } = useQuery({
    queryKey: ['kan_template_single', task.template_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kan_task_templates')
        .select('*')
        .eq('id', task.template_id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!task.template_id,
  })

  // Populează starea repeat din template existent
  useEffect(() => {
    if (existingTemplate) {
      setRepeatType(existingTemplate.recurrence_type)
      setRepeatDay(existingTemplate.recurrence_day ?? 5)
      setRepeatDays(
        Array.isArray(existingTemplate.recurrence_days) && existingTemplate.recurrence_days.length > 0
          ? existingTemplate.recurrence_days
          : [1]
      )
      setRepeatColumnId(existingTemplate.column_id || columns[0]?.id || '')
      setRepeatTime(existingTemplate.recurrence_time?.slice(0, 5) || '')
      setRepeatOpen(true)
    } else {
      setRepeatColumnId(columns[0]?.id || '')
    }
  }, [existingTemplate])

  const handleSaveRepeat = async () => {
    setSavingRepeat(true)
    try {
      const payload = {
        board_id: boardId,
        name: title.trim() || task.title,
        description: description.trim() || null,
        checklist: subtasks.map((s) => ({ title: s.title })),
        priority,
        assigned_to: assigneeId || null,
        column_id: repeatColumnId || null,
        recurrence_type: repeatType,
        recurrence_day: repeatType === 'monthly' ? Number(repeatDay) : null,
        recurrence_days: repeatType === 'weekly' ? repeatDays : [],
        recurrence_time: repeatTime || null,
        created_by: currentUser.id,
      }

      if (task.template_id) {
        const { error } = await supabase.from('kan_task_templates').update(payload).eq('id', task.template_id)
        if (error) throw error
      } else {
        const { data: newTpl, error } = await supabase.from('kan_task_templates').insert(payload).select().single()
        if (error) throw error
        const { error: e2 } = await supabase.from('kan_tasks').update({ template_id: newTpl.id }).eq('id', task.id)
        if (e2) throw e2
        task.template_id = newTpl.id // actualizează local
      }

      setRepeatSaved(true)
      setTimeout(() => setRepeatSaved(false), 2000)
      refetchTemplate()
    } catch (e) {
      console.error(e)
    } finally {
      setSavingRepeat(false)
    }
  }

  const handleRemoveRepeat = async () => {
    if (!confirm('Oprești repeat-ul? Task-urile deja create rămân neatinse.')) return
    await supabase.from('kan_tasks').update({ template_id: null }).eq('id', task.id)
    if (task.template_id) {
      await supabase.from('kan_task_templates').delete().eq('id', task.template_id)
    }
    task.template_id = null
    setRepeatOpen(false)
  }

  const addSubtask = async () => {
    if (!newSubtask.trim()) return
    await supabase.from('kan_subtasks').insert({
      task_id: task.id,
      title: newSubtask.trim(),
      position: subtasks.length,
    })
    setNewSubtask('')
    refetchSubtasks()
  }

  const toggleSubtask = async (id, checked) => {
    await supabase.from('kan_subtasks').update({ completed: checked }).eq('id', id)
    const updated = subtasks.map((s) => (s.id === id ? { ...s, completed: checked } : s))
    const allDone = updated.length > 0 && updated.every((s) => s.completed)
    if (allDone && !task.completed) {
      onUpdate({ completed: true })
    }
    refetchSubtasks()
  }

  const deleteSubtask = async (id) => {
    await supabase.from('kan_subtasks').delete().eq('id', id)
    refetchSubtasks()
  }

  const openLinkEdit = (st) => {
    setEditingLinkId(st.id)
    setLinkDraft(st.url || '')
  }

  const saveLinkDraft = async (id) => {
    const raw = linkDraft.trim()
    const normalized = raw
      ? (/^https?:\/\//i.test(raw) ? raw : 'https://' + raw)
      : null
    const { error } = await supabase.from('kan_subtasks').update({ url: normalized }).eq('id', id)
    if (error) {
      alert('Eroare la salvarea linkului: ' + error.message)
      return
    }
    setEditingLinkId(null)
    setLinkDraft('')
    refetchSubtasks()
  }

  const addComment = async () => {
    if (!newComment.trim()) return
    setPostingComment(true)
    await supabase.from('kan_comments').insert({
      task_id: task.id,
      user_id: currentUser.id,
      content: newComment.trim(),
    })
    setNewComment('')
    setPostingComment(false)
    refetchComments()
  }

  const deleteComment = async (id) => {
    await supabase.from('kan_comments').delete().eq('id', id)
    refetchComments()
  }

  const doneSubtasks = subtasks.filter((s) => s.completed).length

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {task.template_id && (
              <span className="flex items-center gap-1 text-xs text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">
                <Repeat className="w-3 h-3" />
                Recurent
              </span>
            )}
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium cursor-pointer outline-none ${PRIORITIES[priority]?.color}`}
            >
              {Object.entries(PRIORITIES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-xs text-gray-500">Finalizat</span>
            </label>
          </div>
          <div className="flex items-center gap-1">
            {canDelete && (
              <button
                onClick={() => { if (confirm('Ștergi acest task definitiv?')) onDelete() }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-5">

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Titlu</label>
              <textarea
                value={title}
                onChange={(e) => !isMemberOnly && setTitle(e.target.value)}
                readOnly={isMemberOnly}
                className={`w-full text-base font-semibold text-gray-900 border-0 resize-none p-0 outline-none leading-snug bg-transparent ${isMemberOnly ? 'cursor-default' : ''}`}
                rows={2}
              />
            </div>

            {/* Mută în coloana */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Coloană</label>
              <div className="flex flex-wrap gap-1.5">
                {columns.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => onMoveToColumn(col.id)}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
                      col.id === currentColumn?.id
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                    {col.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Descriere</label>
              <textarea
                value={description}
                onChange={(e) => !isMemberOnly && setDescription(e.target.value)}
                readOnly={isMemberOnly}
                placeholder={isMemberOnly ? '' : 'Adaugă o descriere...'}
                className={`w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${isMemberOnly ? 'bg-gray-50 cursor-default text-gray-600' : ''}`}
                rows={3}
              />
            </div>

            {/* Assignee + Due Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Responsabil</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={isMemberOnly}
                  className={`w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white ${isMemberOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <option value="">Nealocat</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Termen limită</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  readOnly={isMemberOnly}
                  className={`w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 ${isMemberOnly ? 'bg-gray-50 cursor-default opacity-70' : ''}`}
                />
              </div>
            </div>

            {/* Auto-save indicator */}
            <div className="flex items-center justify-end h-5">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Se salvează...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  Salvat
                </span>
              )}
            </div>

            {/* ── Secțiunea Repeat — ascunsă pentru membri ── */}
            {!isMemberOnly && <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setRepeatOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Repeat className={`w-4 h-4 ${task.template_id ? 'text-indigo-500' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium text-gray-700">Repeat</span>
                  {task.template_id && (
                    <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">Activ</span>
                  )}
                </div>
                <span className="text-gray-400 text-xs">{repeatOpen ? '▲' : '▼'}</span>
              </button>

              {repeatOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  {/* Frecvență */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Frecvență</label>
                    <div className="flex gap-2">
                      {[{ value: 'daily', label: 'Zilnic' }, { value: 'weekly', label: 'Săptămânal' }, { value: 'monthly', label: 'Lunar' }].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setRepeatType(opt.value)
                            setRepeatDays([1])
                            setRepeatDay(5)
                          }}
                          className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                            repeatType === opt.value
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 text-gray-500 hover:border-gray-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Zile săptămână */}
                  {repeatType === 'weekly' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Zilele săptămânii</label>
                      <div className="flex gap-1">
                        {DAYS_RO.map((d, i) => {
                          const sel = repeatDays.includes(i)
                          return (
                            <button
                              key={i}
                              onClick={() => setRepeatDays((prev) =>
                                sel ? prev.filter((x) => x !== i) : [...prev, i]
                              )}
                              className={`flex-1 h-9 rounded-lg text-xs font-medium border transition-colors ${
                                sel
                                  ? 'border-indigo-500 bg-indigo-500 text-white'
                                  : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50'
                              }`}
                            >
                              {d}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ziua lunii */}
                  {repeatType === 'monthly' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ziua lunii</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={28}
                          value={repeatDay}
                          onChange={(e) => setRepeatDay(Number(e.target.value))}
                          className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 text-center font-semibold"
                        />
                        <span className="text-sm text-gray-500">a fiecărei luni</span>
                      </div>
                    </div>
                  )}

                  {/* Coloana destinație + Ora */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Coloana</label>
                      <select
                        value={repeatColumnId}
                        onChange={(e) => setRepeatColumnId(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      >
                        {columns.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Ora <span className="text-gray-400 font-normal">(opț.)</span>
                      </label>
                      <input
                        type="time"
                        value={repeatTime}
                        onChange={(e) => setRepeatTime(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 font-semibold"
                      />
                    </div>
                  </div>

                  {/* Acțiuni */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSaveRepeat}
                      disabled={savingRepeat || (repeatType === 'weekly' && repeatDays.length === 0)}
                      className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {repeatSaved ? '✓ Salvat!' : savingRepeat ? 'Se salvează...' : 'Salvează repeat'}
                    </button>
                    {task.template_id && (
                      <button
                        onClick={handleRemoveRepeat}
                        className="px-3 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Oprește
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>}

            <div className="border-t border-gray-100" />

            {/* Subtasks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Checklist
                </label>
                {subtasks.length > 0 && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {doneSubtasks}/{subtasks.length}
                  </span>
                )}
              </div>

              {subtasks.length > 0 && (
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${(doneSubtasks / subtasks.length) * 100}%` }}
                  />
                </div>
              )}

              <div className="space-y-1.5 mb-3">
                {subtasks.map((st) => (
                  <div key={st.id} className="group">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={st.completed}
                        onChange={(e) => toggleSubtask(st.id, e.target.checked)}
                        className="w-4 h-4 text-primary-600 rounded cursor-pointer flex-shrink-0"
                      />
                      <span className={`flex-1 text-sm ${st.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {st.title}
                      </span>
                      {/* Link — vizibil tuturor, editabil doar de admin/manager */}
                      {st.url ? (
                        <a
                          href={st.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={st.url}
                          className="p-0.5 text-blue-500 hover:text-blue-700 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : !isMemberOnly ? (
                        <button
                          onClick={() => openLinkEdit(st)}
                          title="Adaugă link"
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-blue-500 transition-all flex-shrink-0"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                      {/* Editare URL — doar admin/manager */}
                      {st.url && !isMemberOnly && (
                        <button
                          onClick={() => openLinkEdit(st)}
                          title="Editează linkul"
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-blue-500 transition-all flex-shrink-0"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      {/* Ștergere item — doar admin/manager */}
                      {!isMemberOnly && (
                        <button
                          onClick={() => deleteSubtask(st.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Input inline URL */}
                    {editingLinkId === st.id && (
                      <div className="ml-6 mt-1.5 flex gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={linkDraft}
                          onChange={(e) => setLinkDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveLinkDraft(st.id)
                            if (e.key === 'Escape') { setEditingLinkId(null); setLinkDraft('') }
                          }}
                          placeholder="https:// sau www.site.ro"
                          className="flex-1 border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button
                          onClick={() => saveLinkDraft(st.id)}
                          className="px-2.5 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        {st.url && (
                          <button
                            onClick={async () => {
                              await supabase.from('kan_subtasks').update({ url: null }).eq('id', st.id)
                              setEditingLinkId(null)
                              setLinkDraft('')
                              refetchSubtasks()
                            }}
                            className="px-2.5 py-1.5 bg-red-50 text-red-400 rounded-lg text-xs hover:bg-red-100"
                            title="Șterge linkul"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingLinkId(null); setLinkDraft('') }}
                          className="px-2.5 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs hover:bg-gray-200"
                        >
                          Anulează
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {!isMemberOnly && (
                <div className="flex gap-2">
                  <input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addSubtask() }}
                    placeholder="Adaugă item checklist..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={addSubtask}
                    disabled={!newSubtask.trim()}
                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100" />

            {/* Comments */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Comentarii ({comments.length})
              </label>

              <div className="space-y-3 mb-4">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5 group">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold text-primary-700">
                      {c.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5">
                      <p className="text-xs font-semibold text-gray-700">{c.profiles?.full_name || 'Utilizator'}</p>
                      <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{c.content}</p>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {format(new Date(c.created_at), 'd MMM, HH:mm', { locale: ro })}
                      </p>
                    </div>
                    {c.user_id === currentUser.id && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="self-start p-1 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {comments.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-2">Niciun comentariu încă.</p>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addComment() }}
                  placeholder="Scrie un comentariu..."
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={addComment}
                  disabled={!newComment.trim() || postingComment}
                  className="px-3 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="h-4" />
          </div>
        </div>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// RecurringModal — gestionare template-uri recurente
// ══════════════════════════════════════════════════════════════
function RecurringModal({ boardId, columns, members, currentUser, templates, onClose, onRefresh }) {
  const [editing, setEditing] = useState(null) // null=lista, 'new'=form nou, uuid=editare

  const emptyForm = {
    name: '',
    description: '',
    checklist: [],
    priority: 'medium',
    assigned_to: '',
    column_id: columns[0]?.id || '',
    recurrence_type: 'monthly',
    recurrence_day: 5,
    recurrence_days: [1],
    recurrence_time: '',
  }

  const [form, setForm] = useState(emptyForm)
  const [newCheckItem, setNewCheckItem] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const openNew = () => {
    setForm({ ...emptyForm, column_id: columns[0]?.id || '' })
    setError('')
    setEditing('new')
  }

  const openEdit = (tpl) => {
    setForm({
      name: tpl.name,
      description: tpl.description || '',
      checklist: tpl.checklist || [],
      priority: tpl.priority || 'medium',
      assigned_to: tpl.assigned_to || '',
      column_id: tpl.column_id || columns[0]?.id || '',
      recurrence_type: tpl.recurrence_type,
      recurrence_day: tpl.recurrence_day ?? 5,
      recurrence_days: Array.isArray(tpl.recurrence_days) && tpl.recurrence_days.length > 0
        ? tpl.recurrence_days
        : (tpl.recurrence_day != null ? [tpl.recurrence_day] : [1]),
      recurrence_time: tpl.recurrence_time || '',
    })
    setError('')
    setEditing(tpl.id)
  }

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return
    setForm((f) => ({ ...f, checklist: [...f.checklist, { title: newCheckItem.trim() }] }))
    setNewCheckItem('')
  }

  const removeCheckItem = (i) => {
    setForm((f) => ({ ...f, checklist: f.checklist.filter((_, idx) => idx !== i) }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Numele este obligatoriu.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        board_id: boardId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        checklist: form.checklist,
        priority: form.priority,
        assigned_to: form.assigned_to || null,
        column_id: form.column_id || null,
        recurrence_type: form.recurrence_type,
        recurrence_day: form.recurrence_type === 'monthly' ? Number(form.recurrence_day) : null,
        recurrence_days: form.recurrence_type === 'weekly' ? form.recurrence_days : [],
        recurrence_time: form.recurrence_time || null,
        created_by: currentUser.id,
        // resetează last_spawned_date la editare ca să poată spawna azi dacă e ziua potrivită
        last_spawned_date: editing !== 'new' ? null : undefined,
      }

      if (editing === 'new') {
        const { error: e } = await supabase.from('kan_task_templates').insert(payload)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('kan_task_templates').update(payload).eq('id', editing)
        if (e) throw e
      }

      onRefresh()
      setEditing(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Ștergi template-ul "${name}"?\nTask-urile deja create rămân neatinse.`)) return
    await supabase.from('kan_task_templates').delete().eq('id', id)
    onRefresh()
  }

  const recurrenceLabel = (tpl) => {
    if (tpl.recurrence_type === 'daily') return 'Zilnic'
    if (tpl.recurrence_type === 'weekly') {
      const days = Array.isArray(tpl.recurrence_days) && tpl.recurrence_days.length > 0
        ? tpl.recurrence_days
        : (tpl.recurrence_day != null ? [tpl.recurrence_day] : [])
      const names = days.sort((a, b) => a - b).map((d) => DAYS_FULL_RO[d] || '?').join(', ')
      return `Săptămânal — ${names || '?'}${tpl.recurrence_time ? ` la ${tpl.recurrence_time.slice(0,5)}` : ''}`
    }
    if (tpl.recurrence_type === 'monthly') return `Lunar — ziua ${tpl.recurrence_day}${tpl.recurrence_time ? ` la ${tpl.recurrence_time.slice(0,5)}` : ''}`
    return '-'
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              {editing && (
                <button
                  onClick={() => setEditing(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <Repeat className="w-4 h-4 text-indigo-500" />
              <h2 className="font-semibold text-gray-900">
                {editing === null ? 'Taskuri Recurente' : editing === 'new' ? 'Template Nou' : 'Editează Template'}
              </h2>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {editing === null ? (
              /* ── Lista template-uri ── */
              <div className="p-5 space-y-2">
                {templates.length === 0 ? (
                  <div className="text-center py-10">
                    <Repeat className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium text-sm">Niciun task recurent configurat</p>
                    <p className="text-gray-400 text-xs mt-1">Creează un template și va apărea automat în board conform programului setat.</p>
                  </div>
                ) : (
                  templates.map((tpl) => (
                    <div key={tpl.id} className="flex items-center gap-3 p-3.5 border border-gray-200 rounded-xl hover:bg-gray-50 group transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-800 truncate">{tpl.name}</p>
                        <p className="text-xs text-indigo-500 mt-0.5 font-medium">{recurrenceLabel(tpl)}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {tpl.checklist?.length > 0 && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <CheckSquare className="w-3 h-3" />
                              {tpl.checklist.length} item(e)
                            </span>
                          )}
                          {tpl.last_spawned_date && (
                            <span className="text-xs text-gray-400">
                              Ultima creare: {format(new Date(tpl.last_spawned_date), 'd MMM yyyy', { locale: ro })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => openEdit(tpl)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Editează"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(tpl.id, tpl.name)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Șterge"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {/* Info box */}
                <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    <strong>Cum funcționează:</strong> Când deschizi board-ul în ziua programată, task-ul se creează automat în coloana aleasă. Dacă task-ul anterior nu a fost finalizat, el rămâne — se adaugă unul nou în plus.
                  </p>
                </div>
              </div>
            ) : (
              /* ── Formular creare/editare ── */
              <div className="p-5 space-y-4">
                {error && (
                  <div className="text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Nume */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Nume <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="ex: Facturi contabile, Raport lunar..."
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                {/* Descriere */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Descriere</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Instrucțiuni sau detalii suplimentare..."
                    rows={2}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Checklist */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Checklist
                    {form.checklist.length > 0 && (
                      <span className="ml-1.5 text-gray-400 font-normal normal-case">({form.checklist.length} item(e))</span>
                    )}
                  </label>

                  {form.checklist.length > 0 && (
                    <div className="space-y-1.5 mb-2.5 p-3 bg-gray-50 rounded-xl">
                      {form.checklist.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 group">
                          <div className="w-4 h-4 rounded border border-gray-300 flex-shrink-0 bg-white" />
                          <span className="flex-1 text-sm text-gray-700">{item.title}</span>
                          <button
                            onClick={() => removeCheckItem(i)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      value={newCheckItem}
                      onChange={(e) => setNewCheckItem(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem() } }}
                      placeholder="Adaugă item checklist..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={addCheckItem}
                      disabled={!newCheckItem.trim()}
                      className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Prioritate + Responsabil */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Prioritate</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      {Object.entries(PRIORITIES).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Responsabil</label>
                    <select
                      value={form.assigned_to}
                      onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      <option value="">Nealocat</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Coloana destinație */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Coloana destinație</label>
                  <select
                    value={form.column_id}
                    onChange={(e) => setForm((f) => ({ ...f, column_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Tip recurență */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Frecvență</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'daily', label: 'Zilnic' },
                      { value: 'weekly', label: 'Săptămânal' },
                      { value: 'monthly', label: 'Lunar' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setForm((f) => ({
                          ...f,
                          recurrence_type: opt.value,
                          recurrence_day: opt.value === 'monthly' ? 5 : null,
                          recurrence_days: opt.value === 'weekly' ? [1] : [],
                        }))}
                        className={`flex-1 py-2 text-sm rounded-xl border font-medium transition-colors ${
                          form.recurrence_type === opt.value
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zilele săptămânii — multi-select */}
                {form.recurrence_type === 'weekly' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Zilele săptămânii
                      {form.recurrence_days.length === 0 && (
                        <span className="ml-1.5 text-red-400 font-normal normal-case">selectează cel puțin o zi</span>
                      )}
                    </label>
                    <div className="flex gap-1.5">
                      {DAYS_RO.map((d, i) => {
                        const selected = form.recurrence_days.includes(i)
                        return (
                          <button
                            key={i}
                            onClick={() => setForm((f) => ({
                              ...f,
                              recurrence_days: selected
                                ? f.recurrence_days.filter((x) => x !== i)
                                : [...f.recurrence_days, i],
                            }))}
                            className={`flex-1 h-10 rounded-xl text-sm font-medium border transition-colors ${
                              selected
                                ? 'border-indigo-500 bg-indigo-500 text-white'
                                : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50'
                            }`}
                          >
                            {d}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Ziua lunii */}
                {form.recurrence_type === 'monthly' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ziua lunii</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={form.recurrence_day}
                        onChange={(e) => setForm((f) => ({ ...f, recurrence_day: Number(e.target.value) }))}
                        className="w-24 border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 text-center font-semibold"
                      />
                      <span className="text-sm text-gray-500">a fiecărei luni</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">Maximum 28 pentru a evita probleme în lunile scurte.</p>
                  </div>
                )}

                {/* Ora de creare */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Ora de creare
                    <span className="ml-1.5 text-gray-400 font-normal normal-case">(opțional)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="time"
                      value={form.recurrence_time}
                      onChange={(e) => setForm((f) => ({ ...f, recurrence_time: e.target.value }))}
                      className="w-36 border border-gray-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500 font-semibold"
                    />
                    {form.recurrence_time && (
                      <button
                        onClick={() => setForm((f) => ({ ...f, recurrence_time: '' }))}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Șterge
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Task-ul apare doar dacă deschizi board-ul după această oră.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
            {editing === null ? (
              <button
                onClick={openNew}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adaugă Template Recurent
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Înapoi
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Se salvează...' : 'Salvează'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}


// ══════════════════════════════════════════════════════════════
// BoardMembersModal — gestionează membrii board-ului din interior
// ══════════════════════════════════════════════════════════════
function BoardMembersModal({ board, allProfiles, currentMembers, onClose, onRefresh }) {
  const existingIds = currentMembers.map((m) => m.user_id)
  const [memberIds, setMemberIds] = useState(existingIds)
  const [saving, setSaving] = useState(false)

  const toggle = (id) => {
    setMemberIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await supabase.from('kan_board_members').delete().eq('board_id', board.id)
      if (memberIds.length > 0) {
        await supabase.from('kan_board_members').insert(
          memberIds.map((uid) => ({ board_id: board.id, user_id: uid }))
        )
      }
      onRefresh()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900">Membri board</h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{board.name}</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5 max-h-80">
            {allProfiles.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nu există alți utilizatori.</p>
            ) : allProfiles.map((p) => {
              const selected = memberIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-colors ${
                    selected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    selected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {selected ? <Check className="w-4 h-4" /> : (p.full_name?.[0]?.toUpperCase() || '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.full_name || p.email}</p>
                    <p className="text-xs text-gray-400 capitalize">{p.role}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-gray-100">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              Anulează
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
