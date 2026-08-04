import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../contexts/PermissionsContext'
import { format, differenceInCalendarDays } from 'date-fns'
import * as XLSX from 'xlsx'
import {
  Upload, Search, Mail, Copy, Check, X, Loader2, ChevronDown, ChevronRight,
  Users, Banknote, Pencil, Save, AlertTriangle,
} from 'lucide-react'

// ═════════════════════════════════════════════════════════════
// Datorii Clienți — analiza sumelor restante de la clienți, pe baza
// extraselor "Sume de încasat" importate din contabilitate (.xls/.xlsx).
// ═════════════════════════════════════════════════════════════

const CATEGORII = [
  { key: 'toate',        label: 'Toate' },
  { key: 'in_termen',    label: 'În termen' },
  { key: 'sub_30',       label: 'Sub 30 zile' },
  { key: 'intre_30_90',  label: '30–90 zile' },
  { key: 'intre_90_365', label: '90–365 zile' },
  { key: 'peste_an',     label: 'Peste un an' },
]
const CATEGORIE_BADGE = {
  in_termen:    'bg-gray-100 text-gray-600',
  sub_30:       'bg-amber-100 text-amber-700',
  intre_30_90:  'bg-orange-100 text-orange-700',
  intre_90_365: 'bg-red-100 text-red-700',
  peste_an:     'bg-rose-200 text-rose-800',
}
const CATEGORIE_LABEL = {
  in_termen: 'În termen', sub_30: 'Sub 30 zile', intre_30_90: '30–90 zile',
  intre_90_365: '90–365 zile', peste_an: 'Peste un an',
}

function zileIntarziere(scadenta) {
  if (!scadenta) return 0
  return differenceInCalendarDays(new Date(), new Date(scadenta + 'T00:00:00'))
}
function categorie(zile) {
  if (zile <= 0) return 'in_termen'
  if (zile < 30) return 'sub_30'
  if (zile < 90) return 'intre_30_90'
  if (zile < 365) return 'intre_90_365'
  return 'peste_an'
}
const fmtBani = (n) => (Number(n) || 0).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' lei'
const fmtData = (d) => d ? format(new Date(d + 'T00:00:00'), 'dd.MM.yyyy') : '—'

// 'dd/mm/yyyy' (asa cum vine din extrasul contabil) -> 'yyyy-mm-dd' (pentru Postgres)
function parseRoDate(str) {
  if (!str) return null
  const m = String(str).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function buildMesaj(client, facturi) {
  const linii = facturi.map(f => {
    const zile = zileIntarziere(f.scadenta)
    const zileTxt = zile > 0 ? `întârziată cu ${zile} zile` : 'în termen'
    return `• Factura ${f.nr_document} din ${fmtData(f.data_document)}, scadentă la ${fmtData(f.scadenta)} — rest de plată ${fmtBani(f.rest_de_incasat)} (${zileTxt})`
  }).join('\n')
  const total = facturi.reduce((s, f) => s + Number(f.rest_de_incasat || 0), 0)
  return `Bună ziua,\n\nVă informăm că, la data de ${format(new Date(), 'dd.MM.yyyy')}, aveți următoarele facturi restante către CB WORKSHOP SRL:\n\n${linii}\n\nTotal de plată: ${fmtBani(total)}\n\nVă rugăm să efectuați plata în cel mai scurt timp posibil. Dacă plata a fost deja efectuată, vă rugăm să ne trimiteți dovada.\n\nCu stimă,\nCB WORKSHOP SRL`
}

async function fetchClienti() {
  const { data, error } = await supabase.from('datorii_clienti').select('*').order('nume')
  if (error) throw error
  return data
}
async function fetchFacturi() {
  const { data, error } = await supabase.from('datorii_facturi').select('*').order('scadenta', { ascending: true })
  if (error) throw error
  return data
}

// ─── Parsare fisier "Sume de incasat" ─────────────────────────────────────────
const COLOANE_NECESARE = ['nr document', 'client', 'valoare totala', 'rest de incasat']

function parseSumeIncasat(rows) {
  const headerRowIdx = rows.findIndex(r => Array.isArray(r) && r.some(c => String(c || '').trim().toLowerCase() === 'nr document'))
  if (headerRowIdx === -1) {
    throw new Error('Nu am găsit coloana "Nr document" în fișier. Verifică că e același tip de raport ("Sume de încasat").')
  }
  const headers = rows[headerRowIdx].map(h => String(h || '').trim().toLowerCase())
  const col = (name) => headers.indexOf(name)
  const idx = {
    nrDocument: col('nr document'),
    dataDocument: col('data document'),
    tipDocument: col('tip document'),
    client: col('client'),
    cif: col('cif'),
    moneda: col('moneda'),
    valoareTotala: col('valoare totala'),
    incasat: col('incasat'),
    restDeIncasat: col('rest de incasat'),
    scadenta: col('scadenta'),
  }
  for (const c of COLOANE_NECESARE) {
    const key = { 'nr document': 'nrDocument', 'client': 'client', 'valoare totala': 'valoareTotala', 'rest de incasat': 'restDeIncasat' }[c]
    if (idx[key] === -1) throw new Error(`Lipsește coloana necesară din fișier: "${c}".`)
  }

  const out = []
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || !row[idx.client] || !row[idx.nrDocument]) continue
    if (idx.tipDocument !== -1 && row[idx.tipDocument] && String(row[idx.tipDocument]).trim() !== 'Factura') continue
    out.push({
      nr_document: String(row[idx.nrDocument]).trim(),
      client_nume: String(row[idx.client]).trim(),
      cif: idx.cif !== -1 ? (String(row[idx.cif] || '').trim() || null) : null,
      data_document: idx.dataDocument !== -1 ? parseRoDate(row[idx.dataDocument]) : null,
      scadenta: idx.scadenta !== -1 ? parseRoDate(row[idx.scadenta]) : null,
      moneda: idx.moneda !== -1 ? (String(row[idx.moneda] || '').trim() || 'RON') : 'RON',
      valoare_totala: Number(row[idx.valoareTotala]) || 0,
      incasat: idx.incasat !== -1 ? (Number(row[idx.incasat]) || 0) : 0,
      rest_de_incasat: Number(row[idx.restDeIncasat]) || 0,
    })
  }
  return out
}

// Upsert clienti (fara sa suprascrie email/telefon deja completate) + facturi
// (dupa nr_document, unic) + reconciliere: facturile neachitate care nu mai apar
// in noul extras sunt marcate automat ca achitate (nu mai figureaza la "de incasat").
async function runImport(rows) {
  const clientMap = new Map()
  for (const r of rows) {
    if (!clientMap.has(r.client_nume)) clientMap.set(r.client_nume, { nume: r.client_nume, cif: r.cif })
    else if (r.cif && !clientMap.get(r.client_nume).cif) clientMap.get(r.client_nume).cif = r.cif
  }
  const clientRows = [...clientMap.values()]
  const numeList = clientRows.map(c => c.nume)

  const { data: existingClients, error: eCheck } = await supabase
    .from('datorii_clienti').select('nume').in('nume', numeList)
  if (eCheck) throw eCheck
  const existingSet = new Set((existingClients || []).map(c => c.nume))
  const clientiNoi = clientRows.filter(c => !existingSet.has(c.nume)).length

  const { data: upsertedClients, error: eClienti } = await supabase
    .from('datorii_clienti').upsert(clientRows, { onConflict: 'nume' }).select('id, nume')
  if (eClienti) throw eClienti
  const idByNume = new Map(upsertedClients.map(c => [c.nume, c.id]))

  const facturiRows = rows.map(r => ({
    client_id: idByNume.get(r.client_nume),
    nr_document: r.nr_document,
    data_document: r.data_document,
    scadenta: r.scadenta,
    moneda: r.moneda,
    valoare_totala: r.valoare_totala,
    incasat: r.incasat,
    rest_de_incasat: r.rest_de_incasat,
    achitat: r.rest_de_incasat <= 0,
  })).filter(f => f.client_id)

  const CHUNK = 200
  let facturiProcesate = 0
  for (let i = 0; i < facturiRows.length; i += CHUNK) {
    const chunk = facturiRows.slice(i, i + CHUNK)
    const { error } = await supabase.from('datorii_facturi').upsert(chunk, { onConflict: 'nr_document' })
    if (error) throw error
    facturiProcesate += chunk.length
  }

  const nrDocsInFile = new Set(rows.map(r => r.nr_document))
  const { data: existingUnpaid, error: eExisting } = await supabase
    .from('datorii_facturi').select('id, nr_document').eq('achitat', false)
  if (eExisting) throw eExisting
  const toMarkPaid = (existingUnpaid || []).filter(f => !nrDocsInFile.has(f.nr_document)).map(f => f.id)
  if (toMarkPaid.length > 0) {
    const { error: eMark } = await supabase.from('datorii_facturi')
      .update({ achitat: true, rest_de_incasat: 0 }).in('id', toMarkPaid)
    if (eMark) throw eMark
  }

  return { facturi: facturiProcesate, clientiNoi, marcateAchitate: toMarkPaid.length }
}

// ═════════════════════════════════════════════════════════════
export default function DatoriiClienti() {
  const { canView, canEdit } = usePermissions()
  const pView = canView('datorii_clienti')
  const pEdit = canEdit('datorii_clienti')
  const [tab, setTab] = useState('datorii')
  const [showImport, setShowImport] = useState(false)

  if (!pView) return (
    <div className="text-center py-16">
      <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-400">Nu ai permisiunea de a vizualiza Datoriile Clienți.</p>
    </div>
  )

  return (
    <div className="max-w-full mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary-600" /> Datorii Clienți
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Situația sumelor de încasat de la clienți, pe baza extraselor contabile importate</p>
        </div>
        {pEdit && (
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
            <Upload className="w-4 h-4" /> Import Excel
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <TabButton active={tab === 'datorii'} onClick={() => setTab('datorii')} icon={Banknote} label="Datorii" />
        <TabButton active={tab === 'clienti'} onClick={() => setTab('clienti')} icon={Users} label="Clienți" />
      </div>

      {tab === 'datorii' ? <DatoriiTab pEdit={pEdit} /> : <ClientiTab pEdit={pEdit} />}

      {showImport && <ImportDatoriiModal onClose={() => setShowImport(false)} />}
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
        active ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  )
}

function SumarCard({ label, value, accent }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${accent || 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// DatoriiTab — lista clientilor cu facturi, filtre, selectie + notificare
// ═════════════════════════════════════════════════════════════
function DatoriiTab({ pEdit }) {
  const queryClient = useQueryClient()
  const { data: clienti = [] } = useQuery({ queryKey: ['datorii_clienti'], queryFn: fetchClienti })
  const { data: facturi = [], isLoading } = useQuery({ queryKey: ['datorii_facturi'], queryFn: fetchFacturi })

  const [search, setSearch] = useState('')
  const [categorieFilter, setCategorieFilter] = useState('toate')
  const [doarRestante, setDoarRestante] = useState(true)
  const [expanded, setExpanded] = useState(() => new Set())
  const [selection, setSelection] = useState({ clientId: null, ids: new Set() })
  const [notificareTarget, setNotificareTarget] = useState(null)

  const clientiById = useMemo(() => new Map(clienti.map(c => [c.id, c])), [clienti])

  const facturiCalc = useMemo(() => facturi.map(f => {
    const zile = zileIntarziere(f.scadenta)
    return { ...f, _zile: zile, _categorie: categorie(zile) }
  }), [facturi])

  const sumar = useMemo(() => {
    const restante = facturiCalc.filter(f => !f.achitat && Number(f.rest_de_incasat) > 0)
    const totalRestant = restante.reduce((s, f) => s + Number(f.rest_de_incasat || 0), 0)
    const clientiRestanti = new Set(restante.map(f => f.client_id)).size
    const celMaiVechi = restante.reduce((max, f) => Math.max(max, f._zile), 0)
    return { totalRestant, countFacturi: restante.length, clientiRestanti, celMaiVechi }
  }, [facturiCalc])

  const facturiFiltrate = useMemo(() => facturiCalc.filter(f => {
    if (doarRestante && (f.achitat || Number(f.rest_de_incasat) <= 0)) return false
    if (categorieFilter !== 'toate' && f._categorie !== categorieFilter) return false
    return true
  }), [facturiCalc, doarRestante, categorieFilter])

  const grupuri = useMemo(() => {
    const map = new Map()
    for (const f of facturiFiltrate) {
      if (!map.has(f.client_id)) map.set(f.client_id, [])
      map.get(f.client_id).push(f)
    }
    let list = [...map.entries()].map(([clientId, fs]) => ({
      client: clientiById.get(clientId),
      facturi: fs.sort((a, b) => b._zile - a._zile),
      totalRestant: fs.reduce((s, f) => !f.achitat ? s + Number(f.rest_de_incasat || 0) : s, 0),
    })).filter(g => g.client)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(g => g.client.nume.toLowerCase().includes(q))
    }
    return list.sort((a, b) => b.totalRestant - a.totalRestant)
  }, [facturiFiltrate, clientiById, search])

  const toggleExpand = (clientId) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(clientId) ? next.delete(clientId) : next.add(clientId)
    return next
  })

  const toggleSelect = (clientId, facturaId) => {
    setSelection(prev => {
      if (prev.clientId !== clientId) return { clientId, ids: new Set([facturaId]) }
      const next = new Set(prev.ids)
      next.has(facturaId) ? next.delete(facturaId) : next.add(facturaId)
      return { clientId, ids: next }
    })
  }

  const toggleAchitat = useMutation({
    mutationFn: async ({ id, achitat }) => {
      const patch = achitat ? { achitat: true, rest_de_incasat: 0 } : { achitat: false }
      const { error } = await supabase.from('datorii_facturi').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['datorii_facturi'] }),
  })

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        <SumarCard label="Total restant" value={fmtBani(sumar.totalRestant)} accent="text-red-600" />
        <SumarCard label="Facturi restante" value={sumar.countFacturi} />
        <SumarCard label="Clienți cu restanțe" value={sumar.clientiRestanti} />
        <SumarCard label="Cea mai veche restanță" value={sumar.celMaiVechi > 0 ? `${sumar.celMaiVechi} zile` : '—'} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Caută client..."
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-400 w-56" />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORII.map(c => (
            <button key={c.key} onClick={() => setCategorieFilter(c.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                categorieFilter === c.key ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {c.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 ml-auto">
          <input type="checkbox" checked={doarRestante} onChange={e => setDoarRestante(e.target.checked)} className="rounded" />
          Doar cu restanțe
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Se încarcă...</p>
      ) : grupuri.length === 0 ? (
        <p className="text-sm text-gray-400 py-12 text-center">
          {facturi.length === 0 ? 'Nicio factură importată încă. Folosește "Import Excel" pentru a începe.' : 'Nicio factură nu corespunde filtrelor alese.'}
        </p>
      ) : (
        <div className="space-y-2">
          {grupuri.map(g => (
            <ClientCard
              key={g.client.id}
              client={g.client}
              facturi={g.facturi}
              totalRestant={g.totalRestant}
              expanded={expanded.has(g.client.id)}
              onToggleExpand={() => toggleExpand(g.client.id)}
              selection={selection.clientId === g.client.id ? selection.ids : new Set()}
              onToggleSelect={(fid) => toggleSelect(g.client.id, fid)}
              onNotify={(facturiSelectate) => setNotificareTarget({ client: g.client, facturi: facturiSelectate })}
              onToggleAchitat={(id, achitat) => toggleAchitat.mutate({ id, achitat })}
              pEdit={pEdit}
            />
          ))}
        </div>
      )}

      {notificareTarget && (
        <NotificareModal client={notificareTarget.client} facturi={notificareTarget.facturi} onClose={() => setNotificareTarget(null)} />
      )}
    </div>
  )
}

function ClientCard({ client, facturi, totalRestant, expanded, onToggleExpand, selection, onToggleSelect, onNotify, onToggleAchitat, pEdit }) {
  const countRestante = facturi.filter(f => !f.achitat && Number(f.rest_de_incasat) > 0).length
  const selectedFacturi = facturi.filter(f => selection.has(f.id))

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={onToggleExpand} className="w-full flex items-center justify-between gap-3 p-4 hover:bg-gray-50 text-left">
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{client.nume}</p>
            <p className="text-xs text-gray-400">{client.cif ? `CIF ${client.cif}` : ''}{client.cif ? ' · ' : ''}{client.email || 'fără email'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {countRestante > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">{countRestante} restante</span>
          )}
          <span className="font-bold text-gray-900">{fmtBani(totalRestant)}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Nr. factură</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Emisă</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Scadentă</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Rest de plată</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Întârziere</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  {pEdit && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturi.map(f => (
                  <tr key={f.id} className={f.achitat ? 'opacity-50' : ''}>
                    <td className="px-3 py-2">
                      {!f.achitat && Number(f.rest_de_incasat) > 0 && (
                        <input type="checkbox" checked={selection.has(f.id)} onChange={() => onToggleSelect(f.id)} className="rounded" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{f.nr_document}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtData(f.data_document)}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtData(f.scadenta)}</td>
                    <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{fmtBani(f.rest_de_incasat)}</td>
                    <td className="px-3 py-2">
                      {f.achitat ? <span className="text-xs text-gray-400">—</span> : (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${CATEGORIE_BADGE[f._categorie]}`}>{CATEGORIE_LABEL[f._categorie]}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {f.achitat ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Achitat</span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Neachitat</span>
                      )}
                    </td>
                    {pEdit && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={() => onToggleAchitat(f.id, !f.achitat)} className="text-xs text-gray-400 hover:text-gray-700 underline">
                          {f.achitat ? 'Marchează neachitat' : 'Marchează achitat'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedFacturi.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-primary-50 border-t border-primary-100">
              <p className="text-sm text-primary-800">
                {selectedFacturi.length} facturi selectate · {fmtBani(selectedFacturi.reduce((s, f) => s + Number(f.rest_de_incasat || 0), 0))}
              </p>
              <button onClick={() => onNotify(selectedFacturi)}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
                <Mail className="w-4 h-4" /> Trimite înștiințare
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// NotificareModal — compune si trimite/copiaza instiintarea de plata
// ═════════════════════════════════════════════════════════════
function NotificareModal({ client, facturi, onClose }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState(client.email || '')
  const [savingEmail, setSavingEmail] = useState(false)
  const [savedJustNow, setSavedJustNow] = useState(false)
  const [subject, setSubject] = useState(`Înștiințare de plată – facturi restante ${client.nume}`)
  const [body, setBody] = useState(() => buildMesaj(client, facturi))
  const [copied, setCopied] = useState(false)

  const currentEmail = client.email || (savedJustNow ? email : '')

  const saveEmail = async () => {
    if (!email.trim()) return
    setSavingEmail(true)
    const { error } = await supabase.from('datorii_clienti').update({ email: email.trim() }).eq('id', client.id)
    setSavingEmail(false)
    if (error) { alert('Eroare: ' + error.message); return }
    queryClient.invalidateQueries({ queryKey: ['datorii_clienti'] })
    setSavedJustNow(true)
  }

  const handleEmail = () => {
    const target = currentEmail || email.trim()
    if (!target) return
    const url = `mailto:${encodeURIComponent(target)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = url
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('Nu am putut copia automat — selectează manual textul din căsuța de mesaj.')
    }
  }

  const hasEmail = !!currentEmail

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Înștiințare de plată — {client.nume}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-400">
            {facturi.length} facturi selectate · total {fmtBani(facturi.reduce((s, f) => s + Number(f.rest_de_incasat || 0), 0))}
          </p>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Email client</label>
            <div className="flex gap-2">
              <input
                value={currentEmail || email}
                onChange={e => setEmail(e.target.value)}
                disabled={!!client.email}
                type="email" placeholder="email@exemplu.ro"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-gray-50 disabled:text-gray-500"
              />
              {!client.email && !savedJustNow && (
                <button onClick={saveEmail} disabled={savingEmail || !email.trim()}
                  className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvează'}
                </button>
              )}
            </div>
            {!client.email && (
              <p className="text-[11px] text-gray-400 mt-1">
                {savedJustNow ? 'Salvat — se ține minte pentru trimiterile viitoare.' : 'Emailul se salvează în baza de clienți, o singură dată.'}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Subiect (email)</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Mesaj (editabil)</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={12}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400 font-mono" />
          </div>
        </div>

        <div className="flex items-center gap-2 p-4 border-t border-gray-100">
          <button onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiat!' : 'Copiază (WhatsApp)'}
          </button>
          <button onClick={handleEmail} disabled={!hasEmail}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
            <Mail className="w-4 h-4" /> Deschide email
          </button>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// ClientiTab — baza de clienti (nume/CIF stabile din import, email/telefon editabile)
// ═════════════════════════════════════════════════════════════
function ClientiTab({ pEdit }) {
  const queryClient = useQueryClient()
  const { data: clienti = [], isLoading } = useQuery({ queryKey: ['datorii_clienti'], queryFn: fetchClienti })
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editEmail, setEditEmail] = useState('')
  const [editTelefon, setEditTelefon] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = clienti.filter(c => !search.trim() || c.nume.toLowerCase().includes(search.trim().toLowerCase()))

  const startEdit = (c) => { setEditingId(c.id); setEditEmail(c.email || ''); setEditTelefon(c.telefon || '') }
  const cancelEdit = () => setEditingId(null)
  const save = async (id) => {
    setSaving(true)
    const { error } = await supabase.from('datorii_clienti')
      .update({ email: editEmail.trim() || null, telefon: editTelefon.trim() || null })
      .eq('id', id)
    setSaving(false)
    if (error) { alert('Eroare: ' + error.message); return }
    queryClient.invalidateQueries({ queryKey: ['datorii_clienti'] })
    setEditingId(null)
  }

  return (
    <div>
      <div className="relative mb-3 max-w-xs mt-4">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Caută client..."
          className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-400 w-full" />
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Se încarcă...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Niciun client. Clienții apar automat aici după primul import de facturi.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Client</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">CIF</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Telefon</th>
                {pEdit && <th className="px-4 py-2 w-20"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{c.nume}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{c.cif || '—'}</td>
                  <td className="px-4 py-2">
                    {editingId === c.id ? (
                      <input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" placeholder="email@exemplu.ro"
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-400 w-48" />
                    ) : (c.email || <span className="text-gray-300">—</span>)}
                  </td>
                  <td className="px-4 py-2">
                    {editingId === c.id ? (
                      <input value={editTelefon} onChange={e => setEditTelefon(e.target.value)} placeholder="07xx xxx xxx"
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary-400 w-36" />
                    ) : (c.telefon || <span className="text-gray-300">—</span>)}
                  </td>
                  {pEdit && (
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {editingId === c.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => save(c.id)} disabled={saving} className="text-green-600 hover:text-green-700"><Save className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(c)} className="text-gray-400 hover:text-gray-700"><Pencil className="w-4 h-4" /></button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// ImportDatoriiModal — import fisier .xls "Sume de incasat"
// ═════════════════════════════════════════════════════════════
function ImportDatoriiModal({ onClose }) {
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
      const rows = await new Promise((resolve, reject) => {
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

      const parsed = parseSumeIncasat(rows)
      if (parsed.length === 0) throw new Error('Nu am găsit nicio factură validă în fișier.')

      const res = await runImport(parsed)
      setResult(res)
      queryClient.invalidateQueries({ queryKey: ['datorii_clienti'] })
      queryClient.invalidateQueries({ queryKey: ['datorii_facturi'] })
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
          <h3 className="font-semibold text-gray-900">Import Excel — Sume de încasat</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-500">
            Importă fișierul .xls exportat din contabilitate ("Sume de încasat"). Clienții noi apar automat în tab-ul Clienți,
            facturile existente se actualizează, iar cele care nu mai apar în fișier (pentru că s-au achitat) sunt marcate automat ca achitate.
          </p>
          <input type="file" accept=".xls,.xlsx,.csv" onChange={handleFile}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-sm" />

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

          {result && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 space-y-0.5">
              <p className="font-medium">Import reușit.</p>
              <p>{result.facturi} facturi procesate · {result.clientiNoi} clienți noi · {result.marcateAchitate} marcate automat ca achitate.</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 p-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            {result ? 'Închide' : 'Anulează'}
          </button>
          {!result && (
            <button onClick={handleImport} disabled={!file || importing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Importă
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
