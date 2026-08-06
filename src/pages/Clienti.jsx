import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../contexts/PermissionsContext'
import ClientModal from '../components/ClientModal'
import * as XLSX from 'xlsx'
import { Search, Plus, Pencil, Trash2, Users, Download, Upload, X, Loader2 } from 'lucide-react'

// ═════════════════════════════════════════════════════════════
// Clienți — pagina unificată de gestiune a clienților, folosită atât de
// Comenzi cât și de Datorii Clienți (tabelul "clienti" e comun ambelor).
// ═════════════════════════════════════════════════════════════

async function fetchClienti() {
  const { data, error } = await supabase.from('clienti').select('*').order('nume')
  if (error) throw error
  return data || []
}

// ─── Export / Import Excel ─────────────────────────────────────────────────

function handleExport(clienti) {
  const rows = clienti.map(c => ({
    ID: c.id,
    Client: c.nume,
    CIF: c.cif || '',
    Email: c.email || '',
    Telefon: c.telefon || '',
    Adresă: c.adresa || '',
    Observații: c.observatii || '',
    Afișare: c.vizibil === false ? 'NU' : 'DA',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 38 }, { wch: 30 }, { wch: 14 }, { wch: 26 }, { wch: 16 }, { wch: 34 }, { wch: 34 }, { wch: 10 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Clienți')
  const azi = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `clienti_${azi}.xlsx`)
}

function normalizeHeader(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// rows = matrice bruta (sheet_to_json cu header:1) — rows[0] e randul de titluri.
// Coloanele absente din fisier nu ating campul corespunzator la import (se pastreaza
// valoarea existenta); o celula prezenta dar goala sterge campul (il face null).
function parseClientiImport(rows) {
  if (!rows || rows.length < 2) return []
  const headers = (rows[0] || []).map(h => String(h || ''))
  const idxOf = (...names) => headers.findIndex(h => names.includes(normalizeHeader(h)))
  const idxId = idxOf('id')
  const idxNume = idxOf('client', 'nume', 'numeclient')
  const idxCif = idxOf('cif')
  const idxEmail = idxOf('email')
  const idxTelefon = idxOf('telefon', 'tel')
  const idxAdresa = idxOf('adresa')
  const idxObs = idxOf('observatii', 'observatie', 'note')
  const idxAfisare = idxOf('afisare', 'vizibil')
  if (idxNume === -1) throw new Error('Nu am găsit coloana "Client" în fișier.')

  const cellStr = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : s }
  const parseBool = (v) => !['nu', 'no', 'false', '0', 'fals'].includes(normalizeHeader(v))

  const randuri = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.length === 0) continue
    const nume = cellStr(r[idxNume])
    if (!nume) continue

    const rand = { nume }
    const idRaw = idxId !== -1 ? cellStr(r[idxId]) : null
    if (idRaw && UUID_RE.test(idRaw)) rand.id = idRaw
    if (idxCif !== -1) rand.cif = cellStr(r[idxCif])
    if (idxEmail !== -1) rand.email = cellStr(r[idxEmail])
    if (idxTelefon !== -1) rand.telefon = cellStr(r[idxTelefon])
    if (idxAdresa !== -1) rand.adresa = cellStr(r[idxAdresa])
    if (idxObs !== -1) rand.observatii = cellStr(r[idxObs])
    if (idxAfisare !== -1) rand.vizibil = parseBool(r[idxAfisare])
    randuri.push(rand)
  }
  return randuri
}

// Randurile cu ID valid se actualizeaza dupa id (nu pot crea duplicate); cele fara
// ID se cauta/creeaza dupa nume exact (upsert onConflict:'nume', ca la restul
// importurilor din aplicatie). Dedupe inainte de upsert, ca sa nu apara aceeasi
// cheie de doua ori in acelasi batch (ar da eroare Postgres).
async function runClientImport(randuri) {
  const cuId = new Map()
  const faraId = new Map()
  for (const r of randuri) {
    const { id, ...payload } = r
    if (id) cuId.set(id, { id, ...payload })
    else faraId.set(payload.nume.toLowerCase(), payload)
  }

  const CHUNK = 200
  let actualizati = 0
  let dupaNume = 0
  const erori = []

  const rowsCuId = [...cuId.values()]
  for (let i = 0; i < rowsCuId.length; i += CHUNK) {
    const chunk = rowsCuId.slice(i, i + CHUNK)
    const { error } = await supabase.from('clienti').upsert(chunk, { onConflict: 'id' })
    if (error) erori.push(error.message)
    else actualizati += chunk.length
  }

  const rowsFaraId = [...faraId.values()]
  for (let i = 0; i < rowsFaraId.length; i += CHUNK) {
    const chunk = rowsFaraId.slice(i, i + CHUNK)
    const { error } = await supabase.from('clienti').upsert(chunk, { onConflict: 'nume' })
    if (error) erori.push(error.message)
    else dupaNume += chunk.length
  }

  return { actualizati, dupaNume, total: randuri.length, erori }
}

function ClientImportModal({ onClose }) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleFile = (e) => {
    setFile(e.target.files?.[0] || null)
    setResult(null)
    setError(null)
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    setError(null)
    try {
      const rawRows = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const wb = XLSX.read(e.target.result, { type: 'binary' })
            const sheet = wb.Sheets[wb.SheetNames[0]]
            resolve(XLSX.utils.sheet_to_json(sheet, { header: 1 }))
          } catch (err) { reject(err) }
        }
        reader.onerror = () => reject(new Error('Nu am putut citi fișierul.'))
        reader.readAsBinaryString(file)
      })

      const randuri = parseClientiImport(rawRows)
      if (randuri.length === 0) throw new Error('Nu am găsit niciun client valid în fișier (verifică să existe coloana "Client").')

      const res = await runClientImport(randuri)
      setResult(res)
      queryClient.invalidateQueries({ queryKey: ['clienti'] })
    } catch (err) {
      setError(err.message || 'Eroare la import.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Import Excel — Clienți</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-500">
            Importă fișierul exportat anterior, cu datele completate. Rândurile care păstrează coloana <strong>ID</strong> nemodificată
            actualizează clientul respectiv (inclusiv dacă i-ai schimbat numele). Rândurile fără ID se caută după numele din coloana
            Client — dacă există deja un client cu acel nume, i se actualizează datele; altfel se adaugă ca client nou. O coloană
            lipsă din fișier nu modifică acel câmp; o celulă goală dintr-o coloană prezentă îl șterge.
          </p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-sm" />

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
          {result && (
            <div className="text-sm bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
              <p className="text-green-700 font-medium">Import finalizat — {result.total} rânduri procesate.</p>
              <p className="text-gray-600">{result.actualizati} actualizați după ID · {result.dupaNume} adăugați/actualizați după nume.</p>
              {result.erori.length > 0 && (
                <p className="text-red-600">{result.erori.length} erori: {result.erori.join('; ')}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 p-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            {result ? 'Închide' : 'Anulează'}
          </button>
          {!result && (
            <button onClick={handleImport} disabled={!file || importing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Importă
            </button>
          )}
        </div>
      </div>
    </div>
  )
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
  const [showImport, setShowImport] = useState(false)
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
    return (
      <div className="text-center py-16">
        <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Nu ai permisiunea de a vizualiza Clienții.</p>
      </div>
    )
  }

  return (
    <div className="max-w-full mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600" /> Clienți
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Baza unificată de clienți, folosită de Comenzi și Datorii Clienți</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => handleExport(clienti)} disabled={clienti.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-600 disabled:opacity-50 whitespace-nowrap">
            <Download className="w-4 h-4" /> Exportă Excel
          </button>
          {pEdit && (
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-600 whitespace-nowrap">
              <Upload className="w-4 h-4" /> Importă Excel
            </button>
          )}
          {pEdit && (
            <button onClick={() => { setEditingClient(null); setShowModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium whitespace-nowrap">
              <Plus className="w-4 h-4" /> Client nou
            </button>
          )}
        </div>
      </div>

      <div className="relative max-w-xs w-full">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Caută client..."
          className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-400 w-full" />
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

      {showImport && <ClientImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
