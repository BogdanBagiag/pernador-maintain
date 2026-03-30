import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MODULES } from '../contexts/PermissionsContext'
import { Shield, X, Save, Eye, Pencil, Trash2, CheckSquare, Square } from 'lucide-react'

export default function UserPermissionsEditor({ targetUser, onClose }) {
  // perms: { module_key: { can_view, can_edit, can_delete } }
  const [perms, setPerms] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('user_permissions')
        .select('module, can_view, can_edit, can_delete')
        .eq('user_id', targetUser.id)

      const map = {}
      MODULES.forEach(m => { map[m.key] = { can_view: false, can_edit: false, can_delete: false } })
      if (data) {
        data.forEach(p => { map[p.module] = { can_view: p.can_view, can_edit: p.can_edit, can_delete: p.can_delete } })
      }
      setPerms(map)
      setLoading(false)
    }
    load()
  }, [targetUser.id])

  const toggle = (module, field) => {
    setPerms(prev => {
      const current = { ...prev[module] }
      const newVal = !current[field]

      // Logica: daca activezi edit/delete, activam automat view
      // Daca dezactivezi view, dezactivam si edit si delete
      if (field === 'can_view' && !newVal) {
        return { ...prev, [module]: { can_view: false, can_edit: false, can_delete: false } }
      }
      if ((field === 'can_edit' || field === 'can_delete') && newVal) {
        return { ...prev, [module]: { ...current, [field]: newVal, can_view: true } }
      }
      return { ...prev, [module]: { ...current, [field]: newVal } }
    })
  }

  const setAll = (module, value) => {
    const m = MODULES.find(mod => mod.key === module)
    setPerms(prev => ({
      ...prev,
      [module]: {
        can_view: value,
        can_edit: value,
        can_delete: value && m?.hasDelete,
      }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const rows = MODULES.map(m => ({
        user_id: targetUser.id,
        module: m.key,
        can_view:   perms[m.key]?.can_view   || false,
        can_edit:   perms[m.key]?.can_edit   || false,
        can_delete: perms[m.key]?.can_delete || false,
        updated_at: new Date().toISOString(),
      }))

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            userToken: session.access_token,
            action: 'save_permissions',
            targetUserId: targetUser.id,
            permissions: rows,
          }),
        }
      )
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || 'Eroare la salvare')

      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 1000)
    } catch (err) {
      alert('Eroare: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const Check = ({ checked, onClick, title }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors border ${
        checked
          ? 'bg-primary-600 border-primary-600 text-white'
          : 'bg-white border-gray-300 text-gray-300 hover:border-gray-400'
      }`}
    >
      {checked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
    </button>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <Shield className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Permisiuni acces</h2>
              <p className="text-sm text-gray-500">{targetUser.full_name || targetUser.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3 pr-4">Modul</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3 w-20">
                    <div className="flex items-center justify-center gap-1"><Eye className="w-3.5 h-3.5" /> Vizual.</div>
                  </th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3 w-20">
                    <div className="flex items-center justify-center gap-1"><Pencil className="w-3.5 h-3.5" /> Editare</div>
                  </th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3 w-20">
                    <div className="flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Ștergere</div>
                  </th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3 w-20">Toate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MODULES.map(m => {
                  const p = perms[m.key] || {}
                  const allOn = p.can_view && p.can_edit && (!m.hasDelete || p.can_delete)
                  return (
                    <tr key={m.key} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 text-sm font-medium text-gray-700">{m.label}</td>
                      <td className="py-3 text-center">
                        <div className="flex justify-center">
                          <Check checked={!!p.can_view} onClick={() => toggle(m.key, 'can_view')} title="Vizualizare" />
                        </div>
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex justify-center">
                          <Check checked={!!p.can_edit} onClick={() => toggle(m.key, 'can_edit')} title="Editare" />
                        </div>
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex justify-center">
                          {m.hasDelete
                            ? <Check checked={!!p.can_delete} onClick={() => toggle(m.key, 'can_delete')} title="Ștergere" />
                            : <span className="text-gray-300 text-xs">—</span>
                          }
                        </div>
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => setAll(m.key, !allOn)}
                            className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                              allOn
                                ? 'bg-primary-50 border-primary-300 text-primary-700'
                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}
                          >
                            {allOn ? 'Toate' : 'Nimic'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Anulează
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saved ? 'Salvat!' : saving ? 'Se salvează...' : 'Salvează permisiunile'}
          </button>
        </div>
      </div>
    </div>
  )
}
