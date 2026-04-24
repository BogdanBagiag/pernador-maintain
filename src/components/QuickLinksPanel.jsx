import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Plus, X, Save, Pencil, Loader2,
  ExternalLink, Link, ChevronDown, ChevronUp,
} from 'lucide-react'

export default function QuickLinksPanel({ page }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [open,          setOpen]          = useState(true)
  const [showModal,     setShowModal]     = useState(false)
  const [editingLink,   setEditingLink]   = useState(null)
  const [deletingId,    setDeletingId]    = useState(null)

  const QK = ['quick_links', page]

  const { data: links = [], isLoading } = useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_links')
        .select('*')
        .eq('page', page)
        .order('pozitie')
        .order('created_at')
      if (error) throw error
      return data
    },
    enabled: !!user,
    staleTime: 30_000,
  })

  const handleDelete = async (id) => {
    if (!confirm('Ștergi acest link?')) return
    setDeletingId(id)
    await supabase.from('quick_links').delete().eq('id', id)
    setDeletingId(null)
    queryClient.invalidateQueries({ queryKey: QK })
  }

  const handleSave = async ({ label, url }) => {
    if (editingLink) {
      await supabase.from('quick_links').update({ label, url }).eq('id', editingLink.id)
    } else {
      await supabase.from('quick_links').insert({
        page,
        label,
        url,
        pozitie: links.length,
        created_by: user.id,
      })
    }
    queryClient.invalidateQueries({ queryKey: QK })
    setShowModal(false)
    setEditingLink(null)
  }

  const openAdd  = () => { setEditingLink(null); setShowModal(true) }
  const openEdit = (link) => { setEditingLink(link); setShowModal(true) }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
          onClick={() => setOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            <Link className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Linkuri rapide</span>
            {links.length > 0 && (
              <span className="bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded-full">{links.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); openAdd() }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              title="Adaugă link nou"
            >
              <Plus className="w-3.5 h-3.5" />
              Adaugă
            </button>
            {open
              ? <ChevronUp   className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />
            }
          </div>
        </div>

        {/* Body */}
        {open && (
          <div className="px-4 pb-4">
            {isLoading ? (
              <div className="flex items-center gap-2 py-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Se încarcă...
              </div>
            ) : links.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">
                Niciun link adăugat. Apasă <span className="font-medium">+ Adaugă</span> pentru a salva un link util.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {links.map(link => (
                  <div
                    key={link.id}
                    className="group flex items-center gap-1 pl-3 pr-1 py-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm font-medium text-gray-700 group-hover:text-primary-700"
                    >
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                      {link.label}
                    </a>
                    <button
                      onClick={() => openEdit(link)}
                      className="ml-1 p-1 text-gray-300 hover:text-blue-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Editează"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(link.id)}
                      disabled={deletingId === link.id}
                      className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Șterge"
                    >
                      {deletingId === link.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <X className="w-3 h-3" />
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal adăugare / editare */}
      {showModal && (
        <LinkModal
          link={editingLink}
          onClose={() => { setShowModal(false); setEditingLink(null) }}
          onSave={handleSave}
        />
      )}
    </>
  )
}

function LinkModal({ link, onClose, onSave }) {
  const [label,   setLabel]   = useState(link?.label || '')
  const [url,     setUrl]     = useState(link?.url   || '')
  const [saving,  setSaving]  = useState(false)
  const isEdit = !!link

  const handleSave = async () => {
    const trimLabel = label.trim()
    const trimUrl   = url.trim()
    if (!trimLabel || !trimUrl) return
    setSaving(true)
    await onSave({ label: trimLabel, url: trimUrl })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <Link className="w-5 h-5 text-primary-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? 'Editează link' : 'Link nou'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Nume afișat <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="ex: Retururi eMAG, Admin WooCommerce..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="https://..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !label.trim() || !url.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Salvează modificările' : 'Adaugă link'}
          </button>
        </div>
      </div>
    </div>
  )
}
