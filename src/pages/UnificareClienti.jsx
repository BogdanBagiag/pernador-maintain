import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../contexts/PermissionsContext'
import { Users, Loader2, ShieldAlert, Search, ArrowRight, Check, AlertTriangle, RefreshCw } from 'lucide-react'

// ═════════════════════════════════════════════════════════════
// Unificare Clienți — instrument de folosit O SINGURĂ DATĂ, care mută datele din
// cele doua tabele vechi si separate (com_clienti, folosit de Comenzi, si
// datorii_clienti, folosit de Datorii Clienți) intr-un singur tabel "clienti".
//
// Clientii cu nume asemanator in cele doua tabele (ex. "Alexa Poiana" in Comenzi
// si "ALEXA POIANA SRL" in Datorii) sunt propusi ca perechi de unificat - dar
// NIMIC nu se uneste automat fara confirmare: adminul revizuieste fiecare pereche
// aici si poate debifa o potrivire gresita inainte de a rula unificarea.
//
// Numele oficial (din contabilitate, tabelul datorii_clienti) este mereu pastrat
// ca nume final la unificare - conform cerintei.
// ═════════════════════════════════════════════════════════════

function normalizeNume(s) {
  return String(s || '')
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(SRL|S\.R\.L\.?|SA|S\.A\.?|PFA|II|SNC|SCS|SCA)\b/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
function numeSimilare(a, b) {
  const na = normalizeNume(a), nb = normalizeNume(b)
  if (!na || !nb) return false
  if (na === nb || na.includes(nb) || nb.includes(na)) return true
  const ta = new Set(na.split(' ')), tb = new Set(nb.split(' '))
  const common = [...ta].filter(t => tb.has(t)).length
  return common / Math.min(ta.size, tb.size) >= 0.8
}

async function fetchAmandoua() {
  const [{ data: comClienti, error: e1 }, { data: datoriiClienti, error: e2 }] = await Promise.all([
    supabase.from('com_clienti').select('*').order('denumire'),
    supabase.from('datorii_clienti').select('*').order('nume'),
  ])
  if (e1) throw e1
  if (e2) throw e2
  return { comClienti: comClienti || [], datoriiClienti: datoriiClienti || [] }
}

// Propune perechi: pentru fiecare client din Comenzi, cauta cel mai apropiat
// nume din Datorii Clienți. Un client din Datorii poate fi tinta mai multor
// clienti din Comenzi (ex. "Alexa Poiana" si "Alexa Poiana SRL" scrise separat
// de operatori, ambele reale acelasi client oficial).
function construiestePropuneri(comClienti, datoriiClienti) {
  const perechi = []
  const comPotrivit = new Set()
  const datoriiPotrivit = new Set()
  for (const c of comClienti) {
    const match = datoriiClienti.find(d => numeSimilare(c.denumire, d.nume))
    if (match) {
      perechi.push({ com: c, datorii: match, checked: true })
      comPotrivit.add(c.id)
      datoriiPotrivit.add(match.id)
    }
  }
  const doarComenzi = comClienti.filter(c => !comPotrivit.has(c.id))
  const doarDatorii = datoriiClienti.filter(d => !datoriiPotrivit.has(d.id))
  return { perechi, doarComenzi, doarDatorii }
}

export default function UnificareClienti() {
  const { isAdmin } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [analizat, setAnalizat] = useState(null) // { perechi, doarComenzi, doarDatorii }
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [rezultat, setRezultat] = useState(null)
  const [editedNume, setEditedNume] = useState({}) // { [comClientId]: nume corectat }

  const numeFinalCom = (c) => (editedNume[c.id]?.trim() || c.denumire)

  const analizeaza = async () => {
    setLoading(true)
    setError('')
    setRezultat(null)
    setEditedNume({})
    try {
      const { comClienti, datoriiClienti } = await fetchAmandoua()
      setAnalizat({ ...construiestePropuneri(comClienti, datoriiClienti), totalCom: comClienti.length, totalDatorii: datoriiClienti.length })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleParcheche = (idx) => {
    setAnalizat(prev => ({
      ...prev,
      perechi: prev.perechi.map((p, i) => i === idx ? { ...p, checked: !p.checked } : p),
    }))
  }

  const ruleazaUnificarea = async () => {
    if (!analizat) return
    if (!confirm('Rulezi unificarea acum? Această acțiune scrie date noi în tabelul "clienti" și actualizează comenzile clienților unificați. Poți rula din nou fără probleme dacă e nevoie.')) return
    setRunning(true)
    setError('')
    try {
      const rows = []
      const actualizariComenzi = [] // { oldId, newId }

      // perechi confirmate -> un singur rand in clienti, sub id-ul din Datorii
      // (numele oficial, din contabilitate, e cel care ramane)
      for (const p of analizat.perechi) {
        if (!p.checked) continue
        rows.push({
          id: p.datorii.id,
          nume: p.datorii.nume,
          cif: p.datorii.cif || null,
          email: p.datorii.email || null,
          telefon: p.datorii.telefon || p.com.telefon || null,
          adresa: p.com.adresa || null,
          vizibil: p.datorii.vizibil !== false,
        })
        actualizariComenzi.push({ oldId: p.com.id, newId: p.datorii.id })
      }

      // perechi respinse (debifate) -> tratate ca 2 clienti separati, distincti
      const respinse = analizat.perechi.filter(p => !p.checked)
      const doarComenzi = [...analizat.doarComenzi, ...respinse.map(p => p.com)]
      const doarDatorii = [...analizat.doarDatorii, ...respinse.map(p => p.datorii)]

      for (const c of doarComenzi) {
        rows.push({ id: c.id, nume: numeFinalCom(c), cif: null, email: null, telefon: c.telefon || null, adresa: c.adresa || null, vizibil: true })
      }
      for (const d of doarDatorii) {
        rows.push({ id: d.id, nume: d.nume, cif: d.cif || null, email: d.email || null, telefon: d.telefon || null, adresa: null, vizibil: d.vizibil !== false })
      }

      setProgress(`Se scriu ${rows.length} clienți în tabelul unificat...`)
      const CHUNK = 200
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK)
        const { error } = await supabase.from('clienti').upsert(chunk, { onConflict: 'id' })
        if (error) throw error
      }

      setProgress(`Se actualizează ${actualizariComenzi.length} legături de comenzi...`)
      for (const { oldId, newId } of actualizariComenzi) {
        const { error } = await supabase.from('com_comenzi').update({ client_id: newId }).eq('client_id', oldId)
        if (error) throw error
      }

      setRezultat({
        total: rows.length,
        unificati: analizat.perechi.filter(p => p.checked).length,
        doarComenzi: doarComenzi.length,
        doarDatorii: doarDatorii.length,
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
      setProgress('')
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Unificare Clienți</h1>
        <div className="max-w-md bg-white rounded-xl border border-gray-200 p-6 text-center">
          <ShieldAlert className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Doar administratorii pot accesa acest instrument.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-600" /> Unificare Clienți
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Instrument de folosit o singură dată: mută clienții din Comenzi și din Datorii Clienți într-un singur tabel comun.
          Numele oficial (din raportul contabilității) e păstrat ca nume final. Nimic nu se unifică fără confirmarea ta.
        </p>
      </div>

      {!rezultat && (
        <button onClick={analizeaza} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Analizează clienții
        </button>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

      {rezultat && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
          <p className="font-semibold text-green-800 flex items-center gap-2"><Check className="w-4 h-4" /> Unificare finalizată</p>
          <p className="text-sm text-green-700">
            {rezultat.total} clienți în total în tabelul unificat · {rezultat.unificati} perechi unificate · {rezultat.doarComenzi} doar din Comenzi · {rezultat.doarDatorii} doar din Datorii Clienți.
          </p>
          <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Ultimul pas (manual): rulează în Supabase SQL editor fișierul <code className="font-mono bg-amber-100 px-1 rounded">clienti_unificat_fk.sql</code> —
              acesta leagă definitiv Comenzi și Datorii Clienți de tabelul nou și arhivează tabelele vechi. Pagina Comenzi și Datorii
              Clienți nu vor folosi datele unificate până nu rulezi acel fișier.
            </p>
          </div>
        </div>
      )}

      {analizat && !rezultat && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {analizat.totalCom} clienți în Comenzi · {analizat.totalDatorii} clienți în Datorii Clienți
            </p>
            <button onClick={analizeaza} disabled={loading} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
              <RefreshCw className="w-3.5 h-3.5" /> Reanalizează
            </button>
          </div>

          {analizat.perechi.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">
                {analizat.perechi.length} perechi propuse — debifează dacă vreo potrivire e greșită
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {analizat.perechi.map((p, idx) => (
                  <label key={idx} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={p.checked} onChange={() => toggleParcheche(idx)} className="rounded flex-shrink-0" />
                    <div className="flex-1 min-w-0 grid grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400 uppercase">Comenzi</p>
                        <p className="text-sm text-gray-700 truncate">{p.com.denumire}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400 uppercase">Datorii Clienți (nume oficial)</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{p.datorii.nume}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </label>
                ))}
              </div>
            </div>
          )}

          {analizat.doarComenzi.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">
                {analizat.doarComenzi.length} clienți doar în Comenzi (fără potrivire) — poți corecta numele înainte de unificare
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {analizat.doarComenzi.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3">
                    <span className="text-xs text-gray-400 w-32 flex-shrink-0 truncate" title={c.denumire}>{c.denumire}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    <input
                      type="text"
                      value={editedNume[c.id] ?? c.denumire}
                      onChange={e => setEditedNume(prev => ({ ...prev, [c.id]: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {analizat.doarDatorii.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">{analizat.doarDatorii.length} clienți doar în Datorii Clienți (fără potrivire, se preiau ca atare)</h2>
              <div className="bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                {analizat.doarDatorii.map(c => <span key={c.id}>{c.nume}</span>)}
              </div>
            </div>
          )}

          <button onClick={ruleazaUnificarea} disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {running ? (progress || 'Se rulează...') : 'Rulează unificarea'}
          </button>
        </div>
      )}
    </div>
  )
}
