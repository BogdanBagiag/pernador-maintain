import { useState } from 'react'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../contexts/PermissionsContext'
import { Download, Loader2, AlertCircle, ShieldAlert } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Module de backup — fiecare grup corespunde unei zone din aplicatie
// si contine unul sau mai multe tabele Supabase. Fiecare tabel devine
// o foaie (sheet) separata in fisierul Excel generat.
// ─────────────────────────────────────────────────────────────
const BACKUP_GROUPS = [
  {
    key: 'vehicles', label: 'Mașini', tables: [
      { name: 'vehicles',           sheet: 'Masini' },
      { name: 'vehicle_insurances', sheet: 'Asigurari' },
      { name: 'vehicle_vignettes',  sheet: 'Rovinieta' },
      { name: 'vehicle_itp',        sheet: 'ITP' },
      { name: 'vehicle_revisions',  sheet: 'Revizii' },
      { name: 'vehicle_repairs',    sheet: 'Reparatii Masini' },
      { name: 'vehicle_documents',  sheet: 'Documente Masini' },
    ],
  },
  {
    key: 'equipment', label: 'Echipamente', tables: [
      { name: 'equipment',             sheet: 'Echipamente' },
      { name: 'equipment_inspections', sheet: 'Inspectii Echipamente' },
    ],
  },
  {
    key: 'locations', label: 'Locații', tables: [
      { name: 'locations', sheet: 'Locatii' },
    ],
  },
  {
    key: 'properties', label: 'Proprietăți în chirie', tables: [
      { name: 'rental_properties', sheet: 'Proprietati' },
      { name: 'property_tenants',  sheet: 'Chiriasi' },
      { name: 'property_utilities', sheet: 'Utilitati' },
      { name: 'utility_readings',  sheet: 'Citiri Utilitati' },
    ],
  },
  {
    key: 'comenzi', label: 'Comenzi', tables: [
      { name: 'com_comenzi',  sheet: 'Comenzi' },
      { name: 'com_clienti',  sheet: 'Clienti Comenzi' },
      { name: 'com_linii',    sheet: 'Linii Comanda' },
      { name: 'com_produse',  sheet: 'Produse Comenzi' },
      { name: 'com_dimensiuni', sheet: 'Dimensiuni' },
      { name: 'com_optiuni',  sheet: 'Optiuni Comenzi' },
    ],
  },
  {
    key: 'work_orders', label: 'Reparații de efectuat', tables: [
      { name: 'work_orders', sheet: 'Reparatii' },
    ],
  },
  {
    key: 'schedules', label: 'Mentenanță preventivă', tables: [
      { name: 'maintenance_schedules', sheet: 'Mentenanta' },
      { name: 'schedule_completions',  sheet: 'Mentenanta Finalizari' },
    ],
  },
  {
    key: 'checklists', label: 'Liste de verificare', tables: [
      { name: 'checklist_templates', sheet: 'Checklisturi' },
    ],
  },
  {
    key: 'procedures', label: 'Proceduri', tables: [
      { name: 'procedure_templates', sheet: 'Proceduri' },
    ],
  },
  {
    key: 'parts', label: 'Inventar piese', tables: [
      { name: 'inventory_parts', sheet: 'Piese' },
      { name: 'parts_usage',     sheet: 'Piese Utilizare' },
    ],
  },
  {
    key: 'contracts', label: 'Contracte', tables: [
      { name: 'contracts',                    sheet: 'Contracte' },
      { name: 'contract_templates',           sheet: 'Sabloane Contracte' },
      { name: 'payment_condition_templates',  sheet: 'Conditii Plata' },
    ],
  },
  {
    key: 'registru', label: 'Registru Încasări', tables: [
      { name: 'registru_incasari',       sheet: 'Registru Incasari' },
      { name: 'registru_fel_operatiune', sheet: 'Fel Operatiune' },
    ],
  },
  {
    key: 'retururi', label: 'Retururi', tables: [
      { name: 'retururi',            sheet: 'Retururi' },
      { name: 'retururi_activitate', sheet: 'Retururi Activitate' },
    ],
  },
  {
    key: 'reclamatii', label: 'Reclamații', tables: [
      { name: 'reclamatii', sheet: 'Reclamatii' },
    ],
  },
]

// ── Helpers formatare Excel ────────────────────────────────────
const humanizeKey = (key) => key
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase())

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/

const formatCellValue = (v) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Da' : 'Nu'
  if (typeof v === 'string' && ISO_DATE_RE.test(v)) {
    const d = new Date(v)
    if (!isNaN(d.getTime())) {
      return v.length > 10 ? format(d, 'dd.MM.yyyy HH:mm') : format(d, 'dd.MM.yyyy')
    }
  }
  if (Array.isArray(v) || typeof v === 'object') return JSON.stringify(v)
  return v
}

const rowsToSheet = (rows) => {
  if (!rows || rows.length === 0) {
    return XLSX.utils.aoa_to_sheet([['Nicio înregistrare']])
  }
  const pretty = rows.map((row) => {
    const out = {}
    Object.entries(row).forEach(([k, v]) => { out[humanizeKey(k)] = formatCellValue(v) })
    return out
  })
  const ws = XLSX.utils.json_to_sheet(pretty)
  const headers = Object.keys(pretty[0])
  ws['!cols'] = headers.map((h) => {
    const maxLen = Math.max(h.length, ...pretty.map((r) => String(r[h] ?? '').length))
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) }
  })
  return ws
}

const sanitizeSheetName = (name, used) => {
  const base = name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Sheet'
  let final = base
  let i = 2
  while (used.has(final)) {
    final = `${base.slice(0, 28)} ${i}`
    i++
  }
  used.add(final)
  return final
}

// ═════════════════════════════════════════════════════════════
export default function Backup() {
  const { isAdmin } = usePermissions()
  const [selected, setSelected] = useState(() =>
    BACKUP_GROUPS.reduce((acc, g) => { acc[g.key] = true; return acc }, {})
  )
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  const toggleGroup = (key) => setSelected((s) => ({ ...s, [key]: !s[key] }))
  const toggleAll = (value) => setSelected(
    BACKUP_GROUPS.reduce((acc, g) => { acc[g.key] = value; return acc }, {})
  )
  const selectedCount = Object.values(selected).filter(Boolean).length

  const handleBackup = async () => {
    setError('')
    setLoading(true)
    try {
      const groups = BACKUP_GROUPS.filter((g) => selected[g.key])
      const wb = XLSX.utils.book_new()
      const usedNames = new Set()

      for (const group of groups) {
        for (const table of group.tables) {
          setProgress(`Se descarcă: ${table.sheet}...`)
          const { data, error: qErr } = await supabase.from(table.name).select('*')
          const sheetName = sanitizeSheetName(table.sheet, usedNames)
          if (qErr) {
            const ws = XLSX.utils.aoa_to_sheet([[`Eroare la citire: ${qErr.message}`]])
            XLSX.utils.book_append_sheet(wb, ws, sheetName)
            continue
          }
          XLSX.utils.book_append_sheet(wb, rowsToSheet(data), sheetName)
        }
      }

      const fileName = `backup_pernador_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`
      XLSX.writeFile(wb, fileName)
    } catch (e) {
      setError('Eroare la generarea backup-ului: ' + e.message)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Backup</h1>
        <div className="max-w-md bg-white rounded-xl border border-gray-200 p-6 text-center">
          <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Acces permis doar administratorilor.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Backup</h1>
      <p className="text-sm text-gray-500 mb-8">
        Descarcă un fișier Excel cu datele aplicației, organizate pe foi separate — câte una pentru fiecare tabel (ex: la Mașini: date generale, asigurări, rovinietă, ITP, revizii, reparații).
      </p>

      <div className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">
              Module incluse ({selectedCount}/{BACKUP_GROUPS.length})
            </h3>
            <div className="flex gap-2 text-xs">
              <button onClick={() => toggleAll(true)} className="text-primary-600 hover:underline">Bifează tot</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => toggleAll(false)} className="text-primary-600 hover:underline">Debifează tot</button>
            </div>
          </div>
          <div className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
            {BACKUP_GROUPS.map((g) => (
              <label key={g.key} className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={!!selected[g.key]}
                  onChange={() => toggleGroup(g.key)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-400"
                />
                <span className="flex-1 text-gray-800">{g.label}</span>
                <span className="text-xs text-gray-400">
                  {g.tables.length} {g.tables.length === 1 ? 'tabel' : 'tabele'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div>
          <button
            onClick={handleBackup}
            disabled={loading || selectedCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {loading ? (progress || 'Se generează...') : 'Descarcă backup Excel'}
          </button>
          <p className="text-xs text-gray-400 mt-2">
            Fișierul se descarcă local, pe acest calculator. Aplicația nu păstrează o copie a backup-ului.
          </p>
        </div>
      </div>
    </div>
  )
}
