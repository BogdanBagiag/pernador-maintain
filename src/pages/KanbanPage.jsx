import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { format } from 'date-fns'
import {
  Plus, Trash2, Users, Lock, X, ChevronRight,
  LayoutGrid, AlertCircle, UserPlus, Check, CalendarOff, ShieldOff,
} from 'lucide-react'

const DAYS_FULL_RO = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă']

const BOARD_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#64748b',
]

export default function KanbanPage() {
  const { profile, user } = useAuth()
  const { canView, canEdit } = usePermissions()
  const pView = canView('todo')
  const pEdit = canEdit('todo')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdmin = profile?.role === 'admin'
  const canCreateTeamBoard = isAdmin

  const [showCreate, setShowCreate] = useState(false)
  const [createType, setCreateType] = useState('personal')
  const [form, setForm] = useState({ name: '', description: '', color: BOARD_COLORS[0] })
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [error, setError] = useState('')
  const [managingBoard, setManagingBoard] = useState(null)
  const [showNonWorking, setShowNonWorking] = useState(false)

  // ── Fetch all profiles ────────────────────────────────────
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['profiles_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name')
      if (error) throw error
      return data
    },
  })

  // ── Fetch boards ──────────────────────────────────────────
  const { data: boards = [], isLoading } = useQuery({
    queryKey: ['kan_boards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kan_boards')
        .select(`
          *,
          kan_columns (
            id,
            kan_tasks ( id, completed )
          ),
          kan_board_members ( user_id, profiles ( full_name ) )
        `)
        .order('created_at', { ascending: false })
      if (error) throw error

      // Filtrare: personal = doar ale mele; team = ale mele + unde sunt membru + admin/manager vede toate
      return data.filter((b) => {
        if (b.type === 'personal') return b.created_by === user.id
        if (isAdmin || isManager) return true
        return b.created_by === user.id || b.kan_board_members?.some((m) => m.user_id === user.id)
      })
    },
  })

  // ── Non-working days ──────────────────────────────────────
  const { data: nonWorkingDays = [], refetch: refetchNonWorking } = useQuery({
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

  // ── Create board ──────────────────────────────────────────
  const createBoard = useMutation({
    mutationFn: async ({ name, description, color, type, memberIds }) => {
      const { data, error } = await supabase
        .from('kan_boards')
        .insert({ name, description, color, type, created_by: user.id })
        .select()
        .single()
      if (error) throw error

      const defaultColumns = [
        { board_id: data.id, name: 'De făcut',   position: 0, color: '#6B7280' },
        { board_id: data.id, name: 'În progres', position: 1, color: '#3B82F6' },
        { board_id: data.id, name: 'Review',     position: 2, color: '#F59E0B' },
        { board_id: data.id, name: 'Finalizat',  position: 3, color: '#10B981' },
      ]
      const { error: colErr } = await supabase.from('kan_columns').insert(defaultColumns)
      if (colErr) throw colErr

      if (memberIds.length > 0) {
        const { error: memErr } = await supabase.from('kan_board_members').insert(
          memberIds.map((uid) => ({ board_id: data.id, user_id: uid }))
        )
        if (memErr) throw memErr
      }

      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kan_boards'] })
      setShowCreate(false)
      setForm({ name: '', description: '', color: BOARD_COLORS[0] })
      setSelectedMemberIds([])
      setError('')
      navigate(`/todo/${data.id}`)
    },
    onError: (err) => setError(err.message),
  })

  // ── Delete board ──────────────────────────────────────────
  const deleteBoard = useMutation({
    mutationFn: async (boardId) => {
      const { error } = await supabase.from('kan_boards').delete().eq('id', boardId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kan_boards'] }),
  })

  // ── Helpers ───────────────────────────────────────────────
  const getTaskStats = (board) => {
    const tasks = board.kan_columns?.flatMap((c) => c.kan_tasks || []) || []
    const total = tasks.length
    const done = tasks.filter((t) => t.completed).length
    return { total, done }
  }

  const toggleMember = (id) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleCreate = () => {
    if (!form.name.trim()) {
      setError('Numele board-ului este obligatoriu.')
      return
    }
    createBoard.mutate({ ...form, type: createType, memberIds: selectedMemberIds })
  }

  const otherProfiles = allProfiles.filter((p) => p.id !== user.id)
  const teamBoards = boards.filter((b) => b.type === 'team')
  const personalBoards = boards.filter((b) => b.type === 'personal')

  // ── Render ────────────────────────────────────────────────
  if (!pView) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <ShieldOff className="w-14 h-14 text-gray-300" />
      <p className="text-lg font-semibold text-gray-500">Acces restricționat</p>
      <p className="text-sm text-gray-400">Nu ai permisiunea de a vizualiza To Do.</p>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-primary-600" />
            To Do / Kanban
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestionează task-urile echipei și board-urile personale
          </p>
        </div>
        <div className="flex gap-2">
          {canCreateTeamBoard && (
            <button
              onClick={() => setShowNonWorking(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100 text-sm font-medium transition-colors"
            >
              <CalendarOff className="w-4 h-4" />
              Zile nelucratoare
              {nonWorkingDays.length > 0 && (
                <span className="bg-rose-200 text-rose-700 text-xs px-1.5 py-0.5 rounded-full font-semibold leading-none">
                  {nonWorkingDays.length}
                </span>
              )}
            </button>
          )}
          {canCreateTeamBoard && (
            <button
              onClick={() => { setCreateType('team'); setSelectedMemberIds([]); setShowCreate(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors"
            >
              <Users className="w-4 h-4" />
              Board echipă
            </button>
          )}
          {pEdit && (
            <button
              onClick={() => { setCreateType('personal'); setSelectedMemberIds([]); setShowCreate(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Board personal
            </button>
          )}
        </div>
      </div>

      {/* ── Create Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {createType === 'team' ? '👥 Board Echipă Nou' : '🔒 Board Personal Nou'}
              </h2>
              <button
                onClick={() => { setShowCreate(false); setError('') }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nume <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="ex: Sprint Q2, Renovare hală..."
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descriere <span className="text-gray-400 font-normal">(opțional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                  rows={2}
                  placeholder="Scurtă descriere..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Culoare</label>
                <div className="flex gap-2 flex-wrap">
                  {BOARD_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className={`w-8 h-8 rounded-full transition-all duration-150 ${
                        form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Asociere membri — doar pentru board echipă */}
              {createType === 'team' && otherProfiles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-gray-400" />
                    Membri echipă
                    <span className="text-gray-400 font-normal">(opțional)</span>
                  </label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {otherProfiles.map((p) => {
                      const selected = selectedMemberIds.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleMember(p.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                            selected
                              ? 'border-primary-400 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            selected ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {selected ? <Check className="w-3.5 h-3.5" /> : (p.full_name?.[0] || '?')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{p.full_name || p.email}</p>
                            <p className="text-xs text-gray-400 truncate">{p.role}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {selectedMemberIds.length > 0 && (
                    <p className="text-xs text-primary-600 mt-1.5 font-medium">
                      {selectedMemberIds.length} utilizator(i) selectat(i)
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 px-6 pb-6 pt-3 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => { setShowCreate(false); setError('') }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.name.trim() || createBoard.isPending}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {createBoard.isPending ? 'Se creează...' : 'Creează Board'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Members management modal ── */}
      {managingBoard && (
        <BoardMembersModal
          board={managingBoard}
          allProfiles={otherProfiles}
          onClose={() => setManagingBoard(null)}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['kan_boards'] })}
        />
      )}

      {showNonWorking && (
        <NonWorkingDaysModal
          days={nonWorkingDays}
          onClose={() => setShowNonWorking(false)}
          onRefresh={refetchNonWorking}
        />
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden animate-pulse">
              <div className="h-2 bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Board-uri Echipă */}
          {(canCreateTeamBoard || teamBoards.length > 0) && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                Board-uri Echipă
              </h2>
              {teamBoards.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                  <p className="text-gray-400 text-sm">Niciun board de echipă creat încă.</p>
                  {canCreateTeamBoard && (
                    <button
                      onClick={() => { setCreateType('team'); setSelectedMemberIds([]); setShowCreate(true) }}
                      className="mt-2 text-primary-600 text-sm font-medium hover:underline"
                    >
                      + Creează primul board de echipă
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teamBoards.map((board) => (
                    <BoardCard
                      key={board.id}
                      board={board}
                      stats={getTaskStats(board)}
                      canDelete={isAdmin || board.created_by === user.id}
                      canManageMembers={isAdmin || isManager || board.created_by === user.id}
                      currentUserId={user.id}
                      onOpen={() => navigate(`/todo/${board.id}`)}
                      onDelete={() => {
                        if (confirm(`Ștergi board-ul "${board.name}" cu toate task-urile?`)) {
                          deleteBoard.mutate(board.id)
                        }
                      }}
                      onManageMembers={() => setManagingBoard(board)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Board-uri Personale */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" />
              Board-urile Mele
            </h2>
            {personalBoards.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                <LayoutGrid className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Nu ai niciun board personal.</p>
                <button
                  onClick={() => { setCreateType('personal'); setSelectedMemberIds([]); setShowCreate(true) }}
                  className="mt-3 text-primary-600 text-sm font-medium hover:underline"
                >
                  + Creează primul tău board
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {personalBoards.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    stats={getTaskStats(board)}
                    canDelete={true}
                    canManageMembers={false}
                    currentUserId={user.id}
                    onOpen={() => navigate(`/todo/${board.id}`)}
                    onDelete={() => {
                      if (confirm(`Ștergi board-ul "${board.name}" cu toate task-urile?`)) {
                        deleteBoard.mutate(board.id)
                      }
                    }}
                    onManageMembers={() => {}}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// BoardCard
// ══════════════════════════════════════════════════════════════
function BoardCard({ board, stats, canDelete, canManageMembers, currentUserId, onOpen, onDelete, onManageMembers }) {
  const progress = stats.total > 0 ? (stats.done / stats.total) * 100 : 0
  const members = board.kan_board_members || []

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group"
      onClick={onOpen}
    >
      <div className="h-1.5" style={{ backgroundColor: board.color }} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: board.color }} />
              <h3 className="font-semibold text-gray-900 truncate">{board.name}</h3>
            </div>
            {board.description && (
              <p className="text-xs text-gray-500 truncate">{board.description}</p>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {canManageMembers && (
              <button
                onClick={(e) => { e.stopPropagation(); onManageMembers() }}
                className="p-1.5 text-gray-300 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-all"
                title="Gestionează membri"
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Șterge board"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Membri avatare */}
        {members.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            {members.slice(0, 5).map((m) => (
              <div
                key={m.user_id}
                className="w-6 h-6 rounded-full bg-primary-100 border-2 border-white flex items-center justify-center text-xs font-bold text-primary-700 -ml-1 first:ml-0"
                title={m.profiles?.full_name || ''}
              >
                {m.profiles?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            ))}
            {members.length > 5 && (
              <span className="text-xs text-gray-400 ml-1">+{members.length - 5}</span>
            )}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {stats.total > 0 ? (
            <>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{stats.done} din {stats.total} task-uri finalizate</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, backgroundColor: board.color }}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-300">Niciun task încă</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            board.type === 'team' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'
          }`}>
            {board.type === 'team' ? '👥 Echipă' : '🔒 Personal'}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// BoardMembersModal — adaugă/elimină membri din board existent
// ══════════════════════════════════════════════════════════════
function BoardMembersModal({ board, allProfiles, onClose, onRefresh }) {
  const existingIds = board.kan_board_members?.map((m) => m.user_id) || []
  const [memberIds, setMemberIds] = useState(existingIds)
  const [saving, setSaving] = useState(false)

  const toggle = (id) => {
    setMemberIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Șterge toți membrii existenți și re-inserează
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
                    selected ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    selected ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
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
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// NonWorkingDaysModal
// ══════════════════════════════════════════════════════════════
function NonWorkingDaysModal({ days, onClose, onRefresh }) {
  const [newDate, setNewDate] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!newDate) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('kan_non_working_days')
      .insert({ date: newDate, label: newLabel.trim() || null })
    setSaving(false)
    if (err) { setError('Data există deja sau eroare la salvare.'); return }
    setNewDate('')
    setNewLabel('')
    onRefresh()
  }

  const handleDelete = async (id) => {
    await supabase.from('kan_non_working_days').delete().eq('id', id)
    onRefresh()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900">Zile nelucratoare</h2>
              <p className="text-xs text-gray-400 mt-0.5">Taskurile recurente nu apar în aceste zile</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-400"
              />
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Denumire (opt.)"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-400"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <button
                onClick={handleAdd}
                disabled={!newDate || saving}
                className="px-3 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {days.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Nicio zi adăugată încă.</p>
              ) : days.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-rose-50 border border-rose-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {format(new Date(d.date + 'T00:00:00'), 'dd.MM.yyyy')}
                      <span className="ml-2 text-xs text-gray-400">
                        {DAYS_FULL_RO[new Date(d.date + 'T00:00:00').getDay()]}
                      </span>
                    </p>
                    {d.label && <p className="text-xs text-rose-600">{d.label}</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 pb-5 pt-2 border-t border-gray-100">
            <button onClick={onClose} className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
              Închide
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
