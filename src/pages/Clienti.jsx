import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../contexts/PermissionsContext'
import ClientModal from '../components/ClientModal'
import { Search, Plus, Pencil, Trash2, Users } from 'lucide-react'

// ═════════════════════════════════════════════════════════════
// Clienți — pagina unificată de gestiune a clienților, folosită atât de
// Comenzi cât și de Datorii Clienți (tabelul "clienti" e comun ambelor).
// ═════════════════════════════════════════════════════════════

async function fetchClienti() {
  const { data, error } = await supabase.from('clienti').select('*').order('nume')
  if (error) throw error
  return data || []
}

export default function Clienti() {
  const { canView, canEdit, canDelete } = usePermissions()
  const pView = canView('clienti')
  const pEdit = canEdit('clienti')
  const pDelete = canDelete('clienti')

  const queryClient = useQueryClient()
  const { data: clienti = [], isLoading } = useQuery({ queryKey: ['clienti'], queryFn: fetchClienti })
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const filtered = clienti.filter(c => !search.trim() || c.nume.toLowerCase().includes(search.trim().toLowerCase()))

  const toggleVizibil = async (c) => {
    const { error } = await supabase.from('clienti').update({ vizibil: !c.vizibil }).eq('id', c.id)
    if (error) { alert('Eroare: ' + error.message); return }
    queryClient.invalidateQueries({ queryKey: ['clienti'] })
  }

  const handleDelete = async (c) => {
    if (!window.confirm(`Ștergi clientul "${c.nume}"? Această acțiune nu poate fi anulată.`)) return
    setDeleting(c.id)
    const { error } = await supabase.from('clienti').delete().eq('id', c.id)
    setDeleting(null)
    if (error) { alert('Eroare la ștergere: ' + error.message); return }
    queryClient.invalidateQueries({ queryKey: ['clienti'] })
  }

  if (!pView) {
    return <div className="p-6 text-sm text-gray-500">Nu ai acces la această pagină.</div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Users className="w-6 h-6 text-primary-600" />
        <h1 className="text-xl font-bold text-gray-900">Clienți</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">Baza unificată de clienți, folosită de Comenzi și Datorii Clienți.</p>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Caută client..."
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-400 w-full" />
        </div>
        {pEdit && (
          <button onClick={() => { setEditingClient(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium whitespace-nowrap">
            <Plus className="w-4 h-4" /> Client nou
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Se încarcă...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Niciun client găsit.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Client</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">CIF</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Telefon</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Adresă</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Afișare</th>
                {(pEdit || pDelete) && <th className="px-4 py-2 w-20"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className={c.vizibil === false ? 'opacity-50' : ''}>
                  <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{c.nume}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{c.cif || '—'}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{c.email || '—'}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{c.telefon || '—'}</td>
                  <td className="px-4 py-2 text-gray-500 max-w-xs truncate">{c.adresa || '—'}</td>
                  <td className="px-4 py-2 text-center">
                    <input type="checkbox" checked={c.vizibil !== false} disabled={!pEdit}
                      onChange={() => toggleVizibil(c)} title="Afișează acest client ca datornic"
                      className="rounded disabled:opacity-50" />
                  </td>
                  {(pEdit || pDelete) && (
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {pEdit && (
                          <button onClick={() => { setEditingClient(c); setShowModal(true) }} className="text-gray-400 hover:text-gray-700">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {pDelete && (
                          <button onClick={() => handleDelete(c)} disabled={deleting === c.id} className="text-gray-400 hover:text-red-600 disabled:opacity-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ClientModal
          client={editingClient}
          onClose={() => { setShowModal(false); setEditingClient(null) }}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['clienti'] }); setShowModal(false); setEditingClient(null) }}
        />
      )}
    </div>
  )
}
