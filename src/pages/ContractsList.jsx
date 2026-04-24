import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import {
  Plus, FileText, Search, Filter, Eye, Edit2, Trash2,
  Send, CheckCircle, Clock, XCircle, AlertCircle, ChevronDown, Settings2, Ban, Archive, RotateCcw, CreditCard,
  ShieldOff,
} from 'lucide-react'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'
import ContractTemplateEditor from './ContractTemplateEditor'
import PaymentConditionsPage from './PaymentConditionsPage'

const STATUS_CONFIG = {
  draft:     { label: 'Ciornă',   color: 'bg-gray-100 text-gray-700',   icon: FileText },
  sent:      { label: 'Trimis',   color: 'bg-blue-100 text-blue-700',   icon: Send },
  signed:    { label: 'Semnat',   color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Anulat',  color: 'bg-red-100 text-red-700',     icon: XCircle },
}

export default function ContractsList() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { canView, canEdit: canEditModule, canDelete: canDeleteModule } = usePermissions()
  const pView   = canView('contracts')
  const pEdit   = canEditModule('contracts')
  const pDelete = canDeleteModule('contracts')
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'template' | 'payment_conditions'
  const [addPaymentCondition, setAddPaymentCondition] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(null)
  const isAdmin = profile?.role === 'admin'

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*, creator:created_by(full_name)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: deletedContracts = [] } = useQuery({
    queryKey: ['contracts-deleted'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*, creator:created_by(full_name)')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('contracts')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts'])
      queryClient.invalidateQueries(['contracts-deleted'])
      setDeleteConfirm(null)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('contracts')
        .update({ status: 'cancelled' })
        .eq('id', id)
      if (error) throw error
      // Trimite email notificare anulare (fire-and-forget)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contract-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ contractId: id, type: 'cancelled' }),
        }).catch(e => console.warn('Email notificare anulare failed:', e))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts'])
      setCancelConfirm(null)
    },
  })

  const restoreMutation = useMutation({
    mutationFn: async (id) => {
      // Fetch current contract to determine previous status
      const { data: current } = await supabase.from('contracts')
        .select('status, is_deleted, signed_at').eq('id', id).single()
      const updatePayload = { is_deleted: false, deleted_at: null }
      if (current?.status === 'cancelled') {
        // Dacă a fost semnat anterior, restaurăm la 'signed', altfel la 'draft'
        updatePayload.status = current?.signed_at ? 'signed' : 'draft'
      }
      const { error } = await supabase.from('contracts')
        .update(updatePayload)
        .eq('id', id)
      if (error) throw error
      // Trimite email notificare restaurare (fire-and-forget)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contract-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ contractId: id, type: 'restored' }),
        }).catch(e => console.warn('Email notificare restaurare failed:', e))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts'])
      queryClient.invalidateQueries(['contracts-deleted'])
    },
  })

  const filtered = contracts.filter(c => {
    const matchSearch = !search || 
      c.contract_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.buyer_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.buyer_cui?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  if (!pView) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <ShieldOff className="w-14 h-14 text-gray-300" />
      <p className="text-lg font-semibold text-gray-500">Acces restricționat</p>
      <p className="text-sm text-gray-400">Nu ai permisiunea de a vizualiza Contractele.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contracte</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestionare contracte de vânzare-cumpărare
          </p>
        </div>
        {pEdit && activeTab === 'list' && (
          <Link
            to="/contracte/nou"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Contract nou
          </Link>
        )}
        {pEdit && activeTab === 'payment_conditions' && (
          <button
            onClick={() => setAddPaymentCondition(v => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Adaugă condiție
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Lista contracte
        </button>
        {pEdit && (
          <button
            onClick={() => setActiveTab('template')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'template' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Șablon contract
          </button>
        )}
        {pEdit && (
          <button
            onClick={() => setActiveTab('payment_conditions')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'payment_conditions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Condiții de plată
          </button>
        )}
      </div>

      {/* Template Editor */}
      {activeTab === 'template' && <ContractTemplateEditor />}

      {/* Payment Conditions Manager */}
      {activeTab === 'payment_conditions' && (
        <PaymentConditionsPage
          embedded
          triggerAdd={addPaymentCondition}
          onAddHandled={() => setAddPaymentCondition(false)}
        />
      )}

      {/* List content — shown only on list tab */}
      {activeTab === 'list' && <>

      {/* Filtre */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Caută după număr, firmă, CUI..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">Toate statusurile</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      {/* Stats rapide */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = contracts.filter(c => c.status === key).length
          const Icon = cfg.icon
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              className={`p-3 rounded-xl border-2 transition-all text-left ${
                statusFilter === key ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900">{count}</span>
                <Icon className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">{cfg.label}</p>
            </button>
          )
        })}
        {/* Card Șterse */}
        <button
          onClick={() => setShowDeleted(v => !v)}
          className={`p-3 rounded-xl border-2 transition-all text-left ${
            showDeleted ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-gray-900">{deletedContracts.length}</span>
            <Archive className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mt-1">Șterse</p>
        </button>
      </div>

      {/* Tabel / Liste */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : showDeleted ? (
        /* ── Contracte șterse ── */
        deletedContracts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Niciun contract șters</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
              <Archive className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Contracte arhivate — {deletedContracts.length} înregistrări</span>
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Nr. Contract</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Cumpărător</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status anterior</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Șters la</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deletedContracts.map(contract => {
                    const cfg = STATUS_CONFIG[contract.status]
                    return (
                      <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-medium text-gray-400 line-through">{contract.contract_number}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-700">{contract.buyer_name}</p>
                          {contract.buyer_email && <p className="text-xs text-gray-400">{contract.buyer_email}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg?.color || 'bg-gray-100 text-gray-600'}`}>
                            {cfg?.label || contract.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {contract.deleted_at
                            ? format(new Date(contract.deleted_at), 'dd MMM yyyy', { locale: ro })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/contracte/${contract.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Vizualizează"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Vizualizează
                            </Link>
                            {isAdmin && (
                              <button
                                onClick={() => restoreMutation.mutate(contract.id)}
                                disabled={restoreMutation.isPending}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors disabled:opacity-50"
                                title="Restaurează"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restaurează
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards - deleted */}
            <div className="md:hidden divide-y divide-gray-100">
              {deletedContracts.map(contract => {
                const cfg = STATUS_CONFIG[contract.status]
                return (
                  <div key={contract.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-sm font-medium text-gray-400 line-through">{contract.contract_number}</span>
                        <p className="text-sm font-medium text-gray-700 mt-0.5">{contract.buyer_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.color || 'bg-gray-100 text-gray-600'}`}>
                            {cfg?.label || contract.status}
                          </span>
                          {contract.deleted_at && (
                            <span className="text-xs text-gray-400">
                              {format(new Date(contract.deleted_at), 'dd MMM yyyy', { locale: ro })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Link to={`/contracte/${contract.id}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
                          <Eye className="w-3.5 h-3.5" />
                          Vezi
                        </Link>
                        {isAdmin && (
                          <button
                            onClick={() => restoreMutation.mutate(contract.id)}
                            disabled={restoreMutation.isPending}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restaurează
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Niciun contract găsit</p>
          {pEdit && (
            <Link
              to="/contracte/nou"
              className="mt-3 inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
            >
              <Plus className="w-4 h-4" />
              Creează primul contract
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Nr. Contract</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Cumpărător</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">CUI</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Data</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(contract => {
                  const cfg = STATUS_CONFIG[contract.status]
                  const StatusIcon = cfg?.icon || FileText
                  return (
                    <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-gray-900">{contract.contract_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{contract.buyer_name}</p>
                        {contract.buyer_email && (
                          <p className="text-xs text-gray-400">{contract.buyer_email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{contract.buyer_cui || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {format(new Date(contract.contract_date || contract.created_at), 'dd MMM yyyy', { locale: ro })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg?.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/contracte/${contract.id}`}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Vizualizează"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {pEdit && contract.status !== 'signed' && (
                            <Link
                              to={`/contracte/${contract.id}/editeaza`}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editează"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Link>
                          )}
                          {pEdit && contract.status !== 'cancelled' && (
                            <button
                              onClick={() => setCancelConfirm(contract)}
                              className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Anulează"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {contract.status === 'cancelled' && (
                            <button
                              onClick={() => restoreMutation.mutate(contract.id)}
                              disabled={restoreMutation.isPending}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Restaurează (reactivează)"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {pDelete && (
                            <button
                              onClick={() => setDeleteConfirm(contract)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Șterge (mută în arhivă)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.map(contract => {
              const cfg = STATUS_CONFIG[contract.status]
              const StatusIcon = cfg?.icon || FileText
              return (
                <div key={contract.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-gray-900">{contract.contract_number}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg?.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 mt-1">{contract.buyer_name}</p>
                      {contract.buyer_cui && <p className="text-xs text-gray-500">CUI: {contract.buyer_cui}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(contract.contract_date || contract.created_at), 'dd MMM yyyy', { locale: ro })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link to={`/contracte/${contract.id}`} className="p-2 text-gray-400 hover:text-primary-600 rounded-lg">
                        <Eye className="w-4 h-4" />
                      </Link>
                      {pEdit && contract.status !== 'signed' && (
                        <Link to={`/contracte/${contract.id}/editeaza`} className="p-2 text-gray-400 hover:text-blue-600 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      </>
      }

      {/* Modal confirmare anulare */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-full">
                <Ban className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Anulează contractul</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Ești sigur că vrei să anulezi contractul <strong>{cancelConfirm.contract_number}</strong> cu{' '}
              <strong>{cancelConfirm.buyer_name}</strong>? Statusul va fi schimbat în <strong>Anulat</strong>.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setCancelConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Nu
              </button>
              <button
                onClick={() => cancelMutation.mutate(cancelConfirm.id)}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Se anulează...' : 'Anulează contractul'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmare ștergere */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Șterge contractul</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Ești sigur că vrei să ștergi contractul <strong>{deleteConfirm.contract_number}</strong> cu{' '}
              <strong>{deleteConfirm.buyer_name}</strong>? Acțiunea este ireversibilă.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Anulează
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Se șterge...' : 'Șterge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
