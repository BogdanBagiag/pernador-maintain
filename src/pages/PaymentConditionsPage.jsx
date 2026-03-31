import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft, Plus, Edit2, Trash2, Star, Save, X, CreditCard, CheckCircle
} from 'lucide-react'

const TYPE_COLORS = {
  term:             'bg-blue-50 text-blue-700 border-blue-200',
  advance_delivery: 'bg-amber-50 text-amber-700 border-amber-200',
  advance_term:     'bg-green-50 text-green-700 border-green-200',
}

const TYPE_LABELS = {
  term:             'La termen',
  advance_delivery: 'Avans + livrare',
  advance_term:     'Avans + termen',
}

const SHORTCODES_BY_TYPE = {
  term:             ['{{PAYMENT_TERM_DAYS}}', '{{PAYMENT_TERM_TEXT}}'],
  advance_delivery: ['{{ADVANCE_PERCENT}}', '{{DELIVERY_PERCENT}}'],
  advance_term:     ['{{ADVANCE_PERCENT}}', '{{INVOICE_TERM_PERCENT}}', '{{INVOICE_TERM_DAYS}}', '{{INVOICE_TERM_TEXT}}'],
}

const EMPTY_FORM = {
  name: '',
  description: '',
  payment_type: 'term',
  content: '',
}

function TemplateEditor({ initial, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const textareaRef = useRef(null)

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const insertShortcode = (code) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = form.content.substring(0, start)
    const after = form.content.substring(end)
    const newContent = before + code + after
    set('content', newContent)
    // Restore cursor after the inserted code
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = start + code.length
      ta.selectionEnd = start + code.length
    }, 0)
  }

  const shortcodes = SHORTCODES_BY_TYPE[form.payment_type] || []

  return (
    <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Nume șablon *</label>
        <input
          type="text"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="ex. Plată integrală la termen"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Descriere</label>
        <input
          type="text"
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Descriere scurtă a condiției de plată"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Payment type */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Tip plată</label>
        <select
          value={form.payment_type}
          onChange={e => set('payment_type', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="term">Plată la termen</option>
          <option value="advance_delivery">Avans + livrare</option>
          <option value="advance_term">Avans + termen</option>
        </select>
      </div>

      {/* Shortcode buttons */}
      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">Shortcode-uri disponibile (click pentru inserare):</p>
        <div className="flex flex-wrap gap-2">
          {shortcodes.map(code => (
            <button
              key={code}
              type="button"
              onClick={() => insertShortcode(code)}
              className="inline-flex items-center px-2.5 py-1 text-xs font-mono font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {/* Content textarea */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Text șablon *</label>
        <textarea
          ref={textareaRef}
          value={form.content}
          onChange={e => set('content', e.target.value)}
          rows={4}
          placeholder="Introduceți textul condiției de plată cu shortcode-urile dorite..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono resize-y"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={isSaving || !form.name.trim() || !form.content.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Se salvează...' : 'Salvează'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <X className="w-4 h-4" />
          Anulează
        </button>
      </div>
    </div>
  )
}

export default function PaymentConditionsPage({ embedded = false, triggerAdd = false, onAddHandled }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editingId, setEditingId] = useState(null) // id or 'new'

  useEffect(() => {
    if (triggerAdd) {
      setEditingId('new')
      onAddHandled?.()
    }
  }, [triggerAdd])
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['payment-condition-templates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('payment_condition_templates')
        .select('*')
        .order('order_index', { ascending: true })
      return data || []
    },
  })

  const saveMutation = useMutation({
    mutationFn: async ({ id, form }) => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        payment_type: form.payment_type,
        content: form.content.trim(),
        updated_at: new Date().toISOString(),
      }
      if (id && id !== 'new') {
        const { error } = await supabase
          .from('payment_condition_templates')
          .update(payload)
          .eq('id', id)
        if (error) throw error
      } else {
        const maxOrder = templates.reduce((m, t) => Math.max(m, t.order_index || 0), 0)
        const { error } = await supabase
          .from('payment_condition_templates')
          .insert({ ...payload, order_index: maxOrder + 1 })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payment-condition-templates'])
      setEditingId(null)
    },
    onError: (err) => {
      alert('Eroare la salvare: ' + err.message)
    },
  })

  const setDefaultMutation = useMutation({
    mutationFn: async (id) => {
      // Clear all defaults first
      const { error: e1 } = await supabase
        .from('payment_condition_templates')
        .update({ is_default: false })
        .neq('id', '00000000-0000-0000-0000-000000000000') // update all rows
      if (e1) throw e1
      // Set new default
      const { error: e2 } = await supabase
        .from('payment_condition_templates')
        .update({ is_default: true })
        .eq('id', id)
      if (e2) throw e2
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payment-condition-templates'])
    },
    onError: (err) => {
      alert('Eroare: ' + err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('payment_condition_templates')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payment-condition-templates'])
      setDeleteConfirm(null)
    },
    onError: (err) => {
      alert('Eroare la ștergere: ' + err.message)
    },
  })

  const handleSave = (form) => {
    saveMutation.mutate({ id: editingId, form })
  }

  return (
    <div className="space-y-6">
      {/* Header — hidden when embedded in a tab */}
      {!embedded && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Condiții de Plată — Șabloane</h1>
              <p className="text-sm text-gray-500 mt-0.5">Gestionează șabloanele de condiții de plată</p>
            </div>
          </div>
          <button
            onClick={() => setEditingId(editingId === 'new' ? null : 'new')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adaugă condiție
          </button>
        </div>
      )}

      {/* New template form at top */}
      {editingId === 'new' && (
        <div className="bg-white rounded-xl border-2 border-primary-300 p-5">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-primary-600" />
            <p className="text-sm font-semibold text-primary-700">Șablon nou</p>
          </div>
          <TemplateEditor
            initial={EMPTY_FORM}
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
            isSaving={saveMutation.isPending}
          />
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && templates.length === 0 && editingId !== 'new' && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-1">Nu există șabloane de condiții de plată.</p>
          <p className="text-sm text-gray-400 mb-4">Creați primul șablon pentru a putea folosi condiții de plată în contracte.</p>
          <button
            onClick={() => setEditingId('new')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Creează primul șablon
          </button>
        </div>
      )}

      {/* Template cards */}
      <div className="space-y-4">
        {templates.map(template => {
          const isEditing = editingId === template.id
          const typeColor = TYPE_COLORS[template.payment_type] || TYPE_COLORS.term
          const typeLabel = TYPE_LABELS[template.payment_type] || template.payment_type

          return (
            <div
              key={template.id}
              className={`bg-white rounded-xl border transition-colors ${
                isEditing ? 'border-primary-300 shadow-sm' : 'border-gray-200'
              }`}
            >
              {/* Card header */}
              <div
                className="p-5 cursor-pointer"
                onClick={() => setEditingId(isEditing ? null : template.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${typeColor}`}>
                        {typeLabel}
                      </span>
                      {template.is_default && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
                          <CheckCircle className="w-3 h-3" />
                          implicit
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-xs text-gray-500 mb-1">{template.description}</p>
                    )}
                    <p className="text-xs text-gray-400 font-mono truncate">
                      {template.content?.substring(0, 120)}{template.content?.length > 120 ? '…' : ''}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {/* Set default */}
                    <button
                      onClick={() => setDefaultMutation.mutate(template.id)}
                      disabled={template.is_default || setDefaultMutation.isPending}
                      title={template.is_default ? 'Șablon implicit' : 'Setează ca implicit'}
                      className={`p-1.5 rounded-lg transition-colors ${
                        template.is_default
                          ? 'text-amber-500 bg-amber-50'
                          : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${template.is_default ? 'fill-amber-400' : ''}`} />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => setEditingId(isEditing ? null : template.id)}
                      title="Editează"
                      className={`p-1.5 rounded-lg transition-colors ${
                        isEditing
                          ? 'text-primary-600 bg-primary-50'
                          : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                      }`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    {deleteConfirm === template.id ? (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          onClick={() => deleteMutation.mutate(template.id)}
                          disabled={deleteMutation.isPending}
                          className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {deleteMutation.isPending ? '...' : 'Șterge'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                        >
                          Anulează
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(template.id)}
                        title="Șterge"
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline editor */}
              {isEditing && (
                <div className="px-5 pb-5">
                  <TemplateEditor
                    initial={{
                      name: template.name,
                      description: template.description || '',
                      payment_type: template.payment_type,
                      content: template.content || '',
                    }}
                    onSave={handleSave}
                    onCancel={() => setEditingId(null)}
                    isSaving={saveMutation.isPending}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
