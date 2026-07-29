import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  addMonths, subMonths, isSameMonth, isSameDay,
} from 'date-fns'
import QRCode from 'qrcode'
import * as XLSX from 'xlsx'
import {
  Users2, Plus, Pencil, Trash2, Search, Save, X, Loader2, Check, XCircle,
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, ClipboardList, BarChart2,
  QrCode, Printer, ShieldOff, Clock, CalendarDays, RotateCcw, Upload, FileDown,
} from 'lucide-react'

const TIPURI_CONCEDIU = ['Odihnă', 'Fără plată', 'Medical', 'Evenimente deosebite']

const STATUS_BADGE = {
  in_asteptare: 'bg-amber-100 text-amber-700',
  aprobat:      'bg-green-100 text-green-700',
  respins:      'bg-red-100 text-red-700',
}
const STATUS_LABEL = {
  in_asteptare: 'În așteptare',
  aprobat: 'Aprobat',
  respins: 'Respins',
}

// Mica "mască" pentru ora scrisă de mână (08:15), fără input type="time" (greu de folosit)
const maskTime = (raw) => {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return digits.slice(0, 2) + ':' + digits.slice(2)
}
const isValidTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

const hoursBetween = (start, end) => {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}
const formatOre = (h) => {
  const totalMin = Math.round(Math.max(0, h) * 60)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  if (hh === 0) return `${mm} min`
  if (mm === 0) return `${hh} ${hh === 1 ? 'oră' : 'ore'}`
  return `${hh} ${hh === 1 ? 'oră' : 'ore'} ${mm} min`
}

export default function ResurseUmane() {
  const { canView, canEdit, canDelete } = usePermissions()
  const [tab, setTab] = useState('calendar')
  const [showQR, setShowQR] = useState(false)

  if (!canView('resurse_umane')) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <ShieldOff className="w-14 h-14 text-gray-300" />
      <p className="text-lg font-semibold text-gray-500">Acces restricționat</p>
      <p className="text-sm text-gray-400">Nu ai permisiunea de a vizualiza Resurse Umane.</p>
    </div>
  )

  const pEdit = canEdit('resurse_umane')
  const pDelete = canDelete('resurse_umane')

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users2 className="w-6 h-6 text-primary-600" />
            Resurse Umane
          </h1>
          <p className="text-sm text-gray-500 mt-1">Cereri de concediu, învoiri, angajați și rapoarte</p>
        </div>
        <button
          onClick={() => setShowQR(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
        >
          <QrCode className="w-4 h-4" /> Cod QR formular
        </button>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-4 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {[
            { key: 'calendar', label: 'Calendar',  icon: CalendarIcon },
            { key: 'cereri',   label: 'Cereri',     icon: ClipboardList },
            { key: 'angajati', label: 'Angajați',   icon: Users2 },
            { key: 'rapoarte', label: 'Rapoarte',   icon: BarChart2 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                tab === key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'calendar' && <CalendarTab />}
      {tab === 'cereri'   && <CereriTab pEdit={pEdit} pDelete={pDelete} />}
      {tab === 'angajati' && <AngajatiTab pEdit={pEdit} pDelete={pDelete} />}
      {tab === 'rapoarte' && <RapoarteTab />}

      {showQR && <QRFormModal onClose={() => setShowQR(false)} />}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// CalendarTab — cine e in concediu / invoire in luna curenta
// ═════════════════════════════════════════════════════════════
function CalendarTab() {
  // Aratam luna curenta si urmatoarea, una sub alta - util cand cineva isi ia
  // concediu la sfarsit de luna si continua in luna urmatoare, sa se vada usor.
  const [baseMonth, setBaseMonth] = useState(() => startOfMonth(new Date()))
  const nextMonthDate = addMonths(baseMonth, 1)
  const [hoveredDay, setHoveredDay] = useState(null) // cheie 'yyyy-MM-dd'

  const rangeStartStr = format(startOfMonth(baseMonth), 'yyyy-MM-dd')
  const rangeEndStr = format(endOfMonth(nextMonthDate), 'yyyy-MM-dd')

  const { data: concedii = [] } = useQuery({
    queryKey: ['hr_calendar_concedii', rangeStartStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_cereri_concediu')
        .select('id, data_inceput, data_sfarsit, tip, hr_angajati(nume, prenume)')
        .eq('status', 'aprobat')
        .lte('data_inceput', rangeEndStr)
        .gte('data_sfarsit', rangeStartStr)
      if (error) throw error
      return data
    },
  })

  const { data: invoiri = [] } = useQuery({
    queryKey: ['hr_calendar_invoiri', rangeStartStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_cereri_invoire')
        .select('id, data, ora_inceput, ora_sfarsit, hr_angajati(nume, prenume)')
        .eq('status', 'aprobat')
        .gte('data', rangeStartStr)
        .lte('data', rangeEndStr)
      if (error) throw error
      return data
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setBaseMonth(m => subMonths(m, 1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-xs text-gray-400">Luna curentă și luna următoare · treci cu mouse-ul pe o zi pentru detalii</p>
        <button onClick={() => setBaseMonth(m => addMonths(m, 1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Concediu</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Învoire</span>
      </div>

      <div className="space-y-8">
        <MonthGrid month={baseMonth} concedii={concedii} invoiri={invoiri} hoveredDay={hoveredDay} setHoveredDay={setHoveredDay} />
        <MonthGrid month={nextMonthDate} concedii={concedii} invoiri={invoiri} hoveredDay={hoveredDay} setHoveredDay={setHoveredDay} />
      </div>
    </div>
  )
}

function MonthGrid({ month, concedii, invoiri, hoveredDay, setHoveredDay }) {
  const rangeStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const rangeEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })

  const days = []
  let d = rangeStart
  while (d <= rangeEnd) { days.push(d); d = addDays(d, 1) }

  const concediiForDay = (day) => concedii.filter(c =>
    day >= new Date(c.data_inceput + 'T00:00:00') && day <= new Date(c.data_sfarsit + 'T00:00:00')
  )
  const invoiriForDay = (day) => invoiri.filter(i => isSameDay(day, new Date(i.data + 'T00:00:00')))

  return (
    <div>
      <h3 className="font-semibold text-gray-900 capitalize mb-2">{format(month, 'MMMM yyyy')}</h3>
      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden text-xs">
        {['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'].map(d => (
          <div key={d} className="bg-gray-50 px-2 py-1.5 font-semibold text-gray-500 text-center">{d}</div>
        ))}
        {days.map(day => {
          const inMonth = isSameMonth(day, month)
          const dayConcedii = concediiForDay(day)
          const dayInvoiri = invoiriForDay(day)
          const hasData = dayConcedii.length > 0 || dayInvoiri.length > 0
          const key = format(day, 'yyyy-MM-dd') + '-' + format(month, 'yyyy-MM')
          const isHovered = hoveredDay === key

          return (
            <div
              key={key}
              className={`relative bg-white min-h-[64px] p-1.5 ${!inMonth ? 'opacity-40' : ''} ${hasData ? 'cursor-pointer' : ''}`}
              onMouseEnter={() => hasData && setHoveredDay(key)}
              onMouseLeave={() => setHoveredDay(h => (h === key ? null : h))}
              onClick={() => hasData && setHoveredDay(h => (h === key ? null : key))}
            >
              <div className={`text-[11px] font-medium mb-1 ${isSameDay(day, new Date()) ? 'text-primary-600' : 'text-gray-400'}`}>
                {format(day, 'd')}
              </div>
              {hasData && (
                <div className="flex gap-1">
                  {dayConcedii.length > 0 && (
                    <span className="bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">{dayConcedii.length}</span>
                  )}
                  {dayInvoiri.length > 0 && (
                    <span className="bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">{dayInvoiri.length}</span>
                  )}
                </div>
              )}

              {isHovered && (
                <div className="absolute z-30 top-full left-0 mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-xl p-2.5 space-y-1.5 text-left">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{format(day, 'dd MMMM yyyy')}</p>
                  {dayConcedii.map(c => (
                    <p key={`c-${c.id}`} className="text-xs text-gray-700 flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block mt-1 flex-shrink-0" />
                      <span><b>{c.hr_angajati?.nume} {c.hr_angajati?.prenume}</b> — {c.tip}</span>
                    </p>
                  ))}
                  {dayInvoiri.map(i => (
                    <p key={`i-${i.id}`} className="text-xs text-gray-700 flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block mt-1 flex-shrink-0" />
                      <span><b>{i.hr_angajati?.nume} {i.hr_angajati?.prenume}</b> — {i.ora_inceput?.slice(0,5)}–{i.ora_sfarsit?.slice(0,5)}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// CereriTab — aprobare cereri concediu + invoire (+ recuperari ore)
// ═════════════════════════════════════════════════════════════
function CereriTab({ pEdit, pDelete }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [typeFilter, setTypeFilter] = useState('toate') // toate / concediu / invoire / recuperare
  const [statusFilter, setStatusFilter] = useState('in_asteptare')

  const { data: concedii = [], isLoading: loadingConcedii } = useQuery({
    queryKey: ['hr_cereri_concediu'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_cereri_concediu')
        .select('*, hr_angajati(nume, prenume)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: invoiri = [], isLoading: loadingInvoiri } = useQuery({
    queryKey: ['hr_cereri_invoire'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_cereri_invoire')
        .select('*, hr_angajati(nume, prenume)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: recuperari = [], isLoading: loadingRecuperari } = useQuery({
    queryKey: ['hr_recuperari_toate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_invoire_recuperari')
        .select('*, hr_angajati(nume, prenume)')
        .not('angajat_id', 'is', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const isLoading = loadingConcedii || loadingInvoiri || loadingRecuperari

  const merged = useMemo(() => {
    const c = concedii.map(x => ({ ...x, _tip: 'concediu' }))
    const i = invoiri.map(x => ({ ...x, _tip: 'invoire' }))
    const r = recuperari.map(x => ({ ...x, _tip: 'recuperare' }))
    return [...c, ...i, ...r].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [concedii, invoiri, recuperari])

  const filtered = merged.filter(item =>
    (typeFilter === 'toate' || item._tip === typeFilter) &&
    (statusFilter === 'toate' || item.status === statusFilter)
  )

  const tableFor = (tip) => tip === 'concediu' ? 'hr_cereri_concediu' : tip === 'invoire' ? 'hr_cereri_invoire' : 'hr_invoire_recuperari'
  const queryKeyFor = (tip) => tip === 'concediu' ? ['hr_cereri_concediu'] : tip === 'invoire' ? ['hr_cereri_invoire'] : ['hr_recuperari_toate']

  const decide = useMutation({
    mutationFn: async ({ id, tip, status, motiv_respingere }) => {
      const { error } = await supabase.from(tableFor(tip))
        .update({ status, motiv_respingere: motiv_respingere || null, decis_de: user.id, data_decizie: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: queryKeyFor(variables.tip) }),
  })

  const deleteCerere = useMutation({
    mutationFn: async ({ id, tip }) => {
      const { error } = await supabase.from(tableFor(tip)).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: queryKeyFor(variables.tip) }),
  })

  // clase Tailwind complete (statice), nu interpolate - altfel JIT-ul nu le include in build
  const TIP_BORDER = { concediu: 'border-l-blue-400', invoire: 'border-l-amber-400', recuperare: 'border-l-violet-400' }
  const TIP_TEXT   = { concediu: 'text-blue-400',     invoire: 'text-amber-400',     recuperare: 'text-violet-400' }
  const TIP_ICON = { concediu: CalendarDays, invoire: Clock, recuperare: RotateCcw }
  const TIP_LABEL = { concediu: 'Concedii', invoire: 'Învoiri', recuperare: 'Recuperări' }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {['toate', 'concediu', 'invoire', 'recuperare'].map(key => {
          const Icon = TIP_ICON[key]
          return (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
                typeFilter === key ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />} {key === 'toate' ? 'Toate' : TIP_LABEL[key]}
            </button>
          )
        })}
      </div>

      <FilterBar filter={statusFilter} setFilter={setStatusFilter} />

      <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Concediu</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Învoire</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-400 inline-block" /> Recuperare</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Se încarcă...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Nicio cerere.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const Icon = TIP_ICON[c._tip]
            return (
              <div key={`${c._tip}-${c.id}`} className={`bg-white border border-gray-200 rounded-xl p-4 border-l-4 ${TIP_BORDER[c._tip]}`}>
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div className="min-w-[220px]">
                    <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${TIP_TEXT[c._tip]}`} />
                      {c.hr_angajati?.nume} {c.hr_angajati?.prenume}
                    </p>
                    {c._tip === 'concediu' ? (
                      <p className="text-sm text-gray-500">
                        {c.tip} · {format(new Date(c.data_inceput), 'dd.MM.yyyy')} – {format(new Date(c.data_sfarsit), 'dd.MM.yyyy')} ({c.nr_zile} {c.nr_zile === 1 ? 'zi' : 'zile'})
                      </p>
                    ) : c._tip === 'invoire' ? (
                      <p className="text-sm text-gray-500">
                        {format(new Date(c.data), 'dd.MM.yyyy')}, {c.ora_inceput?.slice(0,5)}–{c.ora_sfarsit?.slice(0,5)}
                        {c.interes ? ` · ${c.interes}` : ''}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Recuperare {format(new Date(c.data), 'dd.MM.yyyy')}, {c.ora_inceput?.slice(0,5)}–{c.ora_sfarsit?.slice(0,5)}
                      </p>
                    )}
                    {c._tip === 'concediu' && c.observatii && <p className="text-xs text-gray-400 mt-0.5">{c.observatii}</p>}
                  </div>
                  <SignaturePreview src={c.semnatura_base64} />
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                  {pEdit && c.status === 'in_asteptare' && (
                    <div className="flex gap-2">
                      <button onClick={() => decide.mutate({ id: c.id, tip: c._tip, status: 'aprobat' })}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                        <Check className="w-3.5 h-3.5" /> Aprobă
                      </button>
                      <button onClick={() => {
                        const motiv = window.prompt('Motiv respingere (opțional):') || ''
                        decide.mutate({ id: c.id, tip: c._tip, status: 'respins', motiv_respingere: motiv })
                      }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">
                        <XCircle className="w-3.5 h-3.5" /> Respinge
                      </button>
                    </div>
                  )}
                  {pDelete && (
                    <button onClick={() => { if (confirm('Ștergi cererea?')) deleteCerere.mutate({ id: c.id, tip: c._tip }) }}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {c.status === 'respins' && c.motiv_respingere && (
                  <p className="text-xs text-red-500 mt-2">Motiv: {c.motiv_respingere}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterBar({ filter, setFilter }) {
  return (
    <div className="flex gap-2 mb-3">
      {['in_asteptare', 'aprobat', 'respins', 'toate'].map(f => (
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={`px-3 py-1 rounded-full text-xs font-medium border ${
            filter === f ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          {f === 'toate' ? 'Toate' : STATUS_LABEL[f]}
        </button>
      ))}
    </div>
  )
}

function SignaturePreview({ src }) {
  const [open, setOpen] = useState(false)
  if (!src) return <span className="text-xs text-gray-300">—</span>
  return (
    <>
      <img src={src} alt="semnătură" onClick={() => setOpen(true)}
        className="h-8 border border-gray-200 rounded bg-white cursor-pointer" />
      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <img src={src} alt="semnătură" className="bg-white rounded-lg p-4 max-w-md w-full" />
        </div>
      )}
    </>
  )
}

// ═════════════════════════════════════════════════════════════
// AngajatiTab
// ═════════════════════════════════════════════════════════════
function AngajatiTab({ pEdit, pDelete }) {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')

  const { data: angajati = [], isLoading } = useQuery({
    queryKey: ['hr_angajati'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hr_angajati').select('*').order('nume')
      if (error) throw error
      return data
    },
  })

  const deleteAngajat = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('hr_angajati').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr_angajati'] }),
    onError: (e) => alert('Eroare: ' + e.message),
  })

  const toggleActiv = useMutation({
    mutationFn: async ({ id, activ }) => {
      const { error } = await supabase.from('hr_angajati').update({ activ }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr_angajati'] }),
  })

  const filtered = angajati.filter(a => `${a.nume} ${a.prenume}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Caută angajat..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-400 w-64"
          />
        </div>
        {pEdit && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
              <Upload className="w-4 h-4" /> Importă Excel
            </button>
            <button onClick={() => { setEditing(null); setShowModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Angajat nou
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nume</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Prenume</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Telefon</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              {(pEdit || pDelete) && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-28">Acțiuni</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Se încarcă...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Niciun angajat găsit.</td></tr>
            ) : filtered.map(a => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.nume}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{a.prenume}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{a.telefon || '—'}</td>
                <td className="px-4 py-3">
                  <button
                    disabled={!pEdit}
                    onClick={() => toggleActiv.mutate({ id: a.id, activ: !a.activ })}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${a.activ ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {a.activ ? 'Activ' : 'Inactiv'}
                  </button>
                </td>
                {(pEdit || pDelete) && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {pEdit && (
                        <button onClick={() => { setEditing(a); setShowModal(true) }}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {pDelete && (
                        <button onClick={() => { if (confirm(`Ștergi angajatul "${a.nume} ${a.prenume}"?`)) deleteAngajat.mutate(a.id) }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
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

      {showModal && (
        <AngajatModal
          angajat={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['hr_angajati'] }); setShowModal(false); setEditing(null) }}
        />
      )}

      {showImport && (
        <ImportAngajatiModal
          onClose={() => setShowImport(false)}
          onImported={() => { queryClient.invalidateQueries({ queryKey: ['hr_angajati'] }); setShowImport(false) }}
        />
      )}
    </>
  )
}

function ImportAngajatiModal({ onClose, onImported }) {
  const [rows, setRows] = useState(null) // [{ nume, prenume, telefon }]
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [fileName, setFileName] = useState('')

  const findCol = (headers, keywords) => {
    const idx = headers.findIndex(h => {
      const clean = (h || '').toString().toLowerCase().trim()
      return keywords.some(k => clean.includes(k))
    })
    return idx
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        if (data.length < 2) { alert('Fișierul trebuie să aibă un rând de titlu și cel puțin un rând de date.'); return }

        const headers = data[0]
        const numeIdx = findCol(headers, ['nume'])
        const prenumeIdx = findCol(headers, ['prenume'])
        const telefonIdx = findCol(headers, ['telefon', 'phone', 'tel'])

        if (numeIdx === -1 || prenumeIdx === -1) {
          alert('Fișierul trebuie să aibă coloane "Nume" și "Prenume".')
          return
        }

        const parsed = data.slice(1)
          .filter(row => row[numeIdx] || row[prenumeIdx])
          .map(row => ({
            nume: (row[numeIdx] || '').toString().trim(),
            prenume: (row[prenumeIdx] || '').toString().trim(),
            telefon: telefonIdx !== -1 ? (row[telefonIdx] || '').toString().trim() : '',
          }))
          .filter(r => r.nume && r.prenume)

        setRows(parsed)
      } catch (err) {
        alert('Eroare la citirea fișierului: ' + err.message)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleImport = async () => {
    if (!rows?.length) return
    setImporting(true)
    let success = 0, failed = 0
    for (const r of rows) {
      const { error } = await supabase.from('hr_angajati').insert({
        nume: r.nume, prenume: r.prenume, telefon: r.telefon || null,
      })
      if (error) failed++
      else success++
    }
    setImporting(false)
    setResult({ success, failed })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Importă angajați din Excel</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {!result && (
            <>
              <p className="text-sm text-gray-500">
                Fișierul trebuie să aibă un rând de titlu cu coloanele <b>Nume</b>, <b>Prenume</b> și, opțional, <b>Telefon</b>.
              </p>
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:bg-gray-50">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-500">{fileName || 'Alege fișier .xlsx / .xls / .csv'}</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              </label>

              {rows && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-gray-500 mb-2">{rows.length} angajați găsiți:</p>
                  <ul className="text-sm text-gray-700 space-y-0.5">
                    {rows.slice(0, 15).map((r, i) => (
                      <li key={i}>{r.nume} {r.prenume} {r.telefon && <span className="text-gray-400">· {r.telefon}</span>}</li>
                    ))}
                    {rows.length > 15 && <li className="text-gray-400">...și încă {rows.length - 15}</li>}
                  </ul>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="text-center py-4 space-y-2">
              <Check className="w-10 h-10 text-green-500 mx-auto" />
              <p className="font-medium text-gray-900">{result.success} angajați importați</p>
              {result.failed > 0 && <p className="text-sm text-red-500">{result.failed} au eșuat</p>}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          {!result ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Anulează</button>
              <button onClick={handleImport} disabled={!rows?.length || importing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Importă {rows?.length ? `(${rows.length})` : ''}
              </button>
            </>
          ) : (
            <button onClick={onImported} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700">Închide</button>
          )}
        </div>
      </div>
    </div>
  )
}

function AngajatModal({ angajat, onClose, onSaved }) {
  const [nume, setNume] = useState(angajat?.nume || '')
  const [prenume, setPrenume] = useState(angajat?.prenume || '')
  const [telefon, setTelefon] = useState(angajat?.telefon || '')
  const [saving, setSaving] = useState(false)
  const isEdit = !!angajat

  const handleSave = async () => {
    if (!nume.trim() || !prenume.trim()) return
    setSaving(true)
    const payload = { nume: nume.trim(), prenume: prenume.trim(), telefon: telefon.trim() || null }
    if (isEdit) {
      await supabase.from('hr_angajati').update(payload).eq('id', angajat.id)
    } else {
      await supabase.from('hr_angajati').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editează Angajat' : 'Angajat Nou'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nume <span className="text-red-400">*</span></label>
            <input type="text" value={nume} onChange={e => setNume(e.target.value)} autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Prenume <span className="text-red-400">*</span></label>
            <input type="text" value={prenume} onChange={e => setPrenume(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Telefon</label>
            <input type="text" value={telefon} onChange={e => setTelefon(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Anulează</button>
          <button onClick={handleSave} disabled={saving || !nume.trim() || !prenume.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Salvează' : 'Adaugă'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// RapoarteTab — istoric per angajat
// ═════════════════════════════════════════════════════════════
function RapoarteTab() {
  const [angajatId, setAngajatId] = useState('')
  const year = new Date().getFullYear()

  const { data: angajati = [] } = useQuery({
    queryKey: ['hr_angajati_active_select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hr_angajati').select('id, nume, prenume').order('nume')
      if (error) throw error
      return data
    },
  })

  const { data: concedii = [] } = useQuery({
    queryKey: ['hr_raport_concedii', angajatId],
    enabled: !!angajatId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_cereri_concediu').select('*').eq('angajat_id', angajatId)
        .order('data_inceput', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: invoiri = [] } = useQuery({
    queryKey: ['hr_raport_invoiri', angajatId],
    enabled: !!angajatId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_cereri_invoire').select('*').eq('angajat_id', angajatId)
        .order('data', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: recuperari = [] } = useQuery({
    queryKey: ['hr_raport_recuperari', angajatId],
    enabled: !!angajatId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_invoire_recuperari').select('*').eq('angajat_id', angajatId)
        .order('data', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const totalZileConcediuAnul = useMemo(() =>
    concedii.filter(c => c.status === 'aprobat' && new Date(c.data_inceput).getFullYear() === year)
      .reduce((sum, c) => sum + (c.nr_zile || 0), 0)
  , [concedii, year])

  const totalInvoiriAprobate = invoiri.filter(i => i.status === 'aprobat').length

  const oreDatorate = useMemo(() =>
    invoiri.filter(i => i.status === 'aprobat').reduce((sum, i) => sum + hoursBetween(i.ora_inceput, i.ora_sfarsit), 0)
  , [invoiri])
  const oreRecuperate = useMemo(() =>
    recuperari.filter(r => r.status === 'aprobat').reduce((sum, r) => sum + hoursBetween(r.ora_inceput, r.ora_sfarsit), 0)
  , [recuperari])
  const soldOre = oreDatorate - oreRecuperate

  return (
    <div>
      <div className="mb-4 max-w-xs">
        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Angajat</label>
        <select value={angajatId} onChange={e => setAngajatId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400">
          <option value="">Alege un angajat...</option>
          {angajati.map(a => <option key={a.id} value={a.id}>{a.nume} {a.prenume}</option>)}
        </select>
      </div>

      {!angajatId ? (
        <p className="text-sm text-gray-400 py-8 text-center">Alege un angajat pentru a vedea raportul.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5 max-w-2xl">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400">Zile concediu aprobate ({year})</p>
              <p className="text-2xl font-bold text-gray-900">{totalZileConcediuAnul}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400">Învoiri aprobate (total)</p>
              <p className="text-2xl font-bold text-gray-900">{totalInvoiriAprobate}</p>
            </div>
            <div className={`border rounded-xl p-4 ${soldOre > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
              <p className="text-xs text-gray-400">Ore de recuperat rămase</p>
              <p className={`text-2xl font-bold ${soldOre > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{formatOre(soldOre)}</p>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 mb-2">Concedii</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Perioadă</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Tip</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Zile</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {concedii.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Nicio cerere de concediu.</td></tr>
                ) : concedii.map(c => (
                  <tr key={c.id}>
                    <td className="px-4 py-2">{format(new Date(c.data_inceput), 'dd.MM.yyyy')} – {format(new Date(c.data_sfarsit), 'dd.MM.yyyy')}</td>
                    <td className="px-4 py-2">{c.tip}</td>
                    <td className="px-4 py-2">{c.nr_zile}</td>
                    <td className="px-4 py-2"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 mb-2">Învoiri</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Data</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Interval</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Interes</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoiri.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Nicio cerere de învoire.</td></tr>
                ) : invoiri.map(i => (
                  <tr key={i.id}>
                    <td className="px-4 py-2">{format(new Date(i.data), 'dd.MM.yyyy')}</td>
                    <td className="px-4 py-2">{i.ora_inceput?.slice(0,5)}–{i.ora_sfarsit?.slice(0,5)}</td>
                    <td className="px-4 py-2">{i.interes || '—'}</td>
                    <td className="px-4 py-2"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[i.status]}`}>{STATUS_LABEL[i.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 mb-2">Recuperări ore</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Data</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Interval</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Ore</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recuperari.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Nicio recuperare înregistrată.</td></tr>
                ) : recuperari.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">{format(new Date(r.data), 'dd.MM.yyyy')}</td>
                    <td className="px-4 py-2">{r.ora_inceput?.slice(0,5)}–{r.ora_sfarsit?.slice(0,5)}</td>
                    <td className="px-4 py-2">{formatOre(hoursBetween(r.ora_inceput, r.ora_sfarsit))}</td>
                    <td className="px-4 py-2"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PdfExportSection angajatId={angajatId} angajati={angajati} />
    </div>
  )
}

const COMPANIE = 'SC CB WORKSHOP SRL'

function renderFormPage(item) {
  if (item._tip === 'concediu') {
    return <ConcediuFormPage cerere={item.cerere} clipStart={item.clipStart} clipEnd={item.clipEnd} clipDays={item.clipDays} isPartial={item.isPartial} />
  }
  if (item._tip === 'invoire') {
    return <InvoireFormPage cerere={item.cerere} />
  }
  return <RecuperareFormPage cerere={item.cerere} />
}

// Incarcare jsPDF + html2canvas din CDN, doar cand e nevoie (fara dependenta noua in package.json).
// Folosim html2canvas ca sa "fotografiem" exact acelasi formular frumos (HTML/CSS) care se
// vede si la Printează PDF, in loc sa desenam manual textul in PDF (arata mult mai slab).
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = resolve
    script.onerror = () => reject(new Error('Nu s-a putut încărca o librărie necesară (verifică conexiunea la internet).'))
    document.head.appendChild(script)
  })
}
let jsPDFPromise = null
function loadJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF)
  if (!jsPDFPromise) jsPDFPromise = loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js').then(() => window.jspdf.jsPDF)
  return jsPDFPromise
}
let html2canvasPromise = null
function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas)
  if (!html2canvasPromise) html2canvasPromise = loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js').then(() => window.html2canvas)
  return html2canvasPromise
}

// ═════════════════════════════════════════════════════════════
// PdfExportSection — genereaza formulare A5, cate o foaie per cerere,
// pentru un angajat sau toata firma, pe o luna. Doua optiuni:
// Printeaza (deschide dialogul de print) sau Salveaza (descarca .pdf direct)
// ═════════════════════════════════════════════════════════════
function PdfExportSection({ angajatId, angajati }) {
  const [scope, setScope] = useState('angajat') // angajat / firma
  const [luna, setLuna] = useState(format(new Date(), 'yyyy-MM'))
  const [printItems, setPrintItems] = useState(null)
  const [pdfMode, setPdfMode] = useState(null) // 'print' | 'save'
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const pageRefs = useRef({})

  const fetchItems = async () => {
    if (scope === 'angajat' && !angajatId) { alert('Alege întâi un angajat mai sus.'); return null }

    const monthStart = `${luna}-01`
    const monthEndDate = endOfMonth(new Date(`${luna}-01T00:00:00`))
    const monthEnd = format(monthEndDate, 'yyyy-MM-dd')

    let concQuery = supabase.from('hr_cereri_concediu')
      .select('*, hr_angajati(nume, prenume), profiles(full_name)')
      .lte('data_inceput', monthEnd).gte('data_sfarsit', monthStart)
    let invQuery = supabase.from('hr_cereri_invoire')
      .select('*, hr_angajati(nume, prenume), profiles(full_name)')
      .gte('data', monthStart).lte('data', monthEnd)
    let recQuery = supabase.from('hr_invoire_recuperari')
      .select('*, hr_angajati(nume, prenume), profiles(full_name)')
      .not('angajat_id', 'is', null)
      .gte('data', monthStart).lte('data', monthEnd)

    if (scope === 'angajat') {
      concQuery = concQuery.eq('angajat_id', angajatId)
      invQuery = invQuery.eq('angajat_id', angajatId)
      recQuery = recQuery.eq('angajat_id', angajatId)
    }

    const [{ data: concedii, error: e1 }, { data: invoiri, error: e2 }, { data: recuperari, error: e3 }] = await Promise.all([concQuery, invQuery, recQuery])
    if (e1 || e2 || e3) { alert('Eroare: ' + (e1?.message || e2?.message || e3?.message)); return null }

    if ((concedii?.length || 0) === 0 && (invoiri?.length || 0) === 0 && (recuperari?.length || 0) === 0) {
      alert('Nu există cereri în luna selectată.')
      return null
    }

    return [
      ...(concedii || []).map(c => {
        const clipStart = new Date(Math.max(new Date(c.data_inceput), new Date(monthStart)))
        const clipEnd = new Date(Math.min(new Date(c.data_sfarsit), monthEndDate))
        const clipDays = Math.round((clipEnd - clipStart) / 86400000) + 1
        const isPartial = format(clipStart, 'yyyy-MM-dd') !== c.data_inceput || format(clipEnd, 'yyyy-MM-dd') !== c.data_sfarsit
        return { _tip: 'concediu', cerere: c, clipStart, clipEnd, clipDays, isPartial }
      }),
      ...(invoiri || []).map(i => ({ _tip: 'invoire', cerere: i })),
      ...(recuperari || []).map(r => ({ _tip: 'recuperare', cerere: r })),
    ]
  }

  const handlePrint = async () => {
    setGenerating(true)
    const items = await fetchItems()
    setGenerating(false)
    if (!items) return
    setPrintItems(items)
    setPdfMode('print')
  }

  const handleSave = async () => {
    setSaving(true)
    const items = await fetchItems()
    if (!items) { setSaving(false); return }
    pageRefs.current = {}
    setPrintItems(items)
    setPdfMode('save')
    // efectiv se continua in useEffect de mai jos, dupa ce s-au randat paginile
  }

  useEffect(() => {
    if (!printItems || !printItems.length) return

    if (pdfMode === 'print') {
      const t = setTimeout(() => window.print(), 150)
      return () => clearTimeout(t)
    }

    if (pdfMode === 'save') {
      let cancelled = false
      ;(async () => {
        try {
          const [jsPDF, html2canvas] = await Promise.all([loadJsPDF(), loadHtml2Canvas()])
          // asteapta un tick ca sa fie sigur ca DOM-ul paginilor e randat
          await new Promise(r => setTimeout(r, 100))
          const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' })
          for (let idx = 0; idx < printItems.length; idx++) {
            const node = pageRefs.current[idx]
            if (!node) continue
            const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
            const imgData = canvas.toDataURL('image/jpeg', 0.95)
            if (idx > 0) doc.addPage('a5', 'portrait')
            doc.addImage(imgData, 'JPEG', 0, 0, 148, 210)
          }
          if (!cancelled) doc.save(`cereri_HR_${luna}.pdf`)
        } catch (e) {
          if (!cancelled) alert('Eroare la generarea PDF: ' + e.message)
        } finally {
          if (!cancelled) { setSaving(false); setPdfMode(null); setPrintItems(null) }
        }
      })()
      return () => { cancelled = true }
    }
  }, [printItems, pdfMode, luna])

  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <FileDown className="w-4 h-4 text-primary-600" /> Export formulare PDF
      </h3>
      <div className="flex flex-wrap items-end gap-3 mb-2">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Pentru cine</label>
          <select value={scope} onChange={e => setScope(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400">
            <option value="angajat">Angajatul selectat mai sus</option>
            <option value="firma">Toată firma</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Luna</label>
          <input type="month" value={luna} onChange={e => setLuna(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
        <button onClick={handlePrint} disabled={generating || saving}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 disabled:opacity-50">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          Printează PDF
        </button>
        <button onClick={handleSave} disabled={generating || saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Salvează PDF
        </button>
      </div>
      <p className="text-xs text-gray-400">
        "Printează PDF" deschide fereastra de printare (alegi o imprimantă sau "Salvează ca PDF"). "Salvează PDF" descarcă direct un fișier .pdf pe acest calculator.
        O cerere de concediu care trece dintr-o lună în alta apare cu 2 foi separate, câte una pentru fiecare lună exportată.
      </p>

      {printItems && printItems.length > 0 && pdfMode === 'print' && (
        <>
          <style>{`
            @media print {
              body > *:not(#hr-forms-print-area) { display: none !important; }
              #hr-forms-print-area { display: block !important; }
              @page { size: A5 portrait; margin: 10mm; }
            }
            @media screen {
              #hr-forms-print-area { display: none; }
            }
          `}</style>
          {createPortal(
            <div id="hr-forms-print-area">
              {printItems.map((item, idx) => (
                <div key={idx} style={idx < printItems.length - 1 ? { pageBreakAfter: 'always', breakAfter: 'page' } : undefined}>
                  {renderFormPage(item)}
                </div>
              ))}
            </div>,
            document.body
          )}
        </>
      )}

      {/* Pentru Salvează PDF: randam aceleasi formulare in afara ecranului (nu display:none,
          ca sa aiba dimensiuni reale), le "fotografiem" cu html2canvas si le punem in jsPDF -
          asa iese identic cu ce se vede la Printează PDF, nu un PDF desenat manual, mai urat. */}
      {printItems && printItems.length > 0 && pdfMode === 'save' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: '-9999px', zIndex: -1 }}>
          {printItems.map((item, idx) => (
            <div key={idx} ref={el => { pageRefs.current[idx] = el }} style={{ width: '148mm', background: '#fff' }}>
              {renderFormPage(item)}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

function ConcediuFormPage({ cerere: c, clipStart, clipEnd, clipDays, isPartial }) {
  const FF = 'Georgia, "Times New Roman", serif'
  return (
    <div style={{ fontFamily: FF, fontSize: '11pt', color: '#111', lineHeight: 1.6, padding: '4mm' }}>
      <h2 style={{ textAlign: 'center', fontSize: '14pt', marginBottom: '8mm', letterSpacing: '0.5px' }}>CERERE DE CONCEDIU</h2>
      <p>
        Subsemnatul(a), <b>{c.hr_angajati?.nume} {c.hr_angajati?.prenume}</b>, angajat al {COMPANIE} prin prezenta vă rog
        să-mi aprobați efectuarea unui număr de <b>{clipDays}</b> {clipDays === 1 ? 'zi' : 'zile'} de concediu
        de <b>{c.tip}</b> în perioada (zi.lună.an) <b>{format(clipStart, 'dd.MM.yyyy')}</b> și <b>{format(clipEnd, 'dd.MM.yyyy')}</b>.
      </p>
      {isPartial && (
        <p style={{ fontSize: '8pt', color: '#888' }}>
          * Cererea inițială acoperă {c.nr_zile} {c.nr_zile === 1 ? 'zi' : 'zile'} în total, din {format(new Date(c.data_inceput), 'dd.MM.yyyy')} până în {format(new Date(c.data_sfarsit), 'dd.MM.yyyy')}; această foaie acoperă doar partea din luna selectată.
        </p>
      )}
      {c.observatii && <p style={{ fontSize: '9pt', color: '#555' }}>Observații: {c.observatii}</p>}
      <p style={{ marginTop: '6mm' }}>Vă mulțumesc!</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10mm' }}>
        <span>Data {format(new Date(c.created_at), 'dd.MM.yyyy')}</span>
        <span style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '8pt', color: '#888' }}>Semnătură angajat</div>
          {c.semnatura_base64 ? <img src={c.semnatura_base64} alt="semnătură" style={{ height: '16mm' }} /> : '.....................'}
        </span>
      </div>

      <div style={{ marginTop: '10mm' }}>
        {c.status === 'aprobat' ? (
          <p><b>Aprobat</b>{c.profiles?.full_name ? ` de ${c.profiles.full_name}` : ''}, la {format(new Date(c.data_decizie), 'dd.MM.yyyy HH:mm')}.</p>
        ) : c.status === 'respins' ? (
          <p style={{ color: '#b91c1c' }}><b>Respins</b>{c.motiv_respingere ? ` — motiv: ${c.motiv_respingere}` : ''}, la {format(new Date(c.data_decizie), 'dd.MM.yyyy HH:mm')}.</p>
        ) : (
          <p>De acord ................................. <span style={{ fontSize: '8pt', color: '#888' }}>(semnătura angajator/manager)</span></p>
        )}
      </div>

      <p style={{ fontSize: '7.5pt', color: '#aaa', marginTop: '8mm' }}>
        * se trece tipul de concediu: de odihnă, fără plată, pentru evenimente deosebite etc.
      </p>
    </div>
  )
}

function InvoireFormPage({ cerere: c }) {
  const FF = 'Georgia, "Times New Roman", serif'
  return (
    <div style={{ fontFamily: FF, fontSize: '11pt', color: '#111', lineHeight: 1.6, padding: '4mm' }}>
      <h2 style={{ textAlign: 'center', fontSize: '14pt', marginBottom: '8mm', letterSpacing: '0.5px' }}>CERERE DE ÎNVOIRE</h2>
      <p>
        Subsemnatul(a), <b>{c.hr_angajati?.nume} {c.hr_angajati?.prenume}</b>, angajat al {COMPANIE} prin prezenta vă rog
        să-mi aprobați cererea de învoire în ziua <b>{format(new Date(c.data), 'dd.MM.yyyy')}</b> în intervalul
        orar <b>{c.ora_inceput?.slice(0,5)}</b> și <b>{c.ora_sfarsit?.slice(0,5)}</b>
        {c.interes ? <> în interes* <b>{c.interes}</b></> : ''}.
      </p>
      <p style={{ fontSize: '8pt', color: '#888' }}>* în interes: de serviciu, personal, etc.</p>
      <p style={{ marginTop: '6mm' }}>Vă mulțumesc!</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10mm' }}>
        <span>Data {format(new Date(c.created_at), 'dd.MM.yyyy')}</span>
        <span style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '8pt', color: '#888' }}>Semnătură</div>
          {c.semnatura_base64 ? <img src={c.semnatura_base64} alt="semnătură" style={{ height: '16mm' }} /> : '.....................'}
        </span>
      </div>

      <div style={{ marginTop: '8mm' }}>
        {c.status === 'aprobat' ? (
          <p><b>Aprobat</b>{c.profiles?.full_name ? ` de ${c.profiles.full_name}` : ''}, la {format(new Date(c.data_decizie), 'dd.MM.yyyy HH:mm')}.</p>
        ) : c.status === 'respins' ? (
          <p style={{ color: '#b91c1c' }}><b>Respins</b>{c.motiv_respingere ? ` — motiv: ${c.motiv_respingere}` : ''}, la {format(new Date(c.data_decizie), 'dd.MM.yyyy HH:mm')}.</p>
        ) : (
          <p>De acord ................................. <span style={{ fontSize: '8pt', color: '#888' }}>(semnătură angajator/manager)</span></p>
        )}
      </div>
    </div>
  )
}

function RecuperareFormPage({ cerere: c }) {
  const FF = 'Georgia, "Times New Roman", serif'
  const ore = hoursBetween(c.ora_inceput, c.ora_sfarsit)
  return (
    <div style={{ fontFamily: FF, fontSize: '11pt', color: '#111', lineHeight: 1.6, padding: '4mm' }}>
      <h2 style={{ textAlign: 'center', fontSize: '14pt', marginBottom: '8mm', letterSpacing: '0.5px' }}>RECUPERARE ORE DE ÎNVOIRE</h2>
      <p>
        Subsemnatul(a), <b>{c.hr_angajati?.nume} {c.hr_angajati?.prenume}</b>, angajat al {COMPANIE}, am recuperat ore de învoire
        în ziua <b>{format(new Date(c.data), 'dd.MM.yyyy')}</b>, între orele <b>{c.ora_inceput?.slice(0,5)}</b> și <b>{c.ora_sfarsit?.slice(0,5)}</b>
        {' '}(<b>{formatOre(ore)}</b>).
      </p>
      <p style={{ marginTop: '6mm' }}>Vă mulțumesc!</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10mm' }}>
        <span>Data {format(new Date(c.created_at), 'dd.MM.yyyy')}</span>
        <span style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '8pt', color: '#888' }}>Semnătură</div>
          {c.semnatura_base64 ? <img src={c.semnatura_base64} alt="semnătură" style={{ height: '16mm' }} /> : '.....................'}
        </span>
      </div>

      <div style={{ marginTop: '8mm' }}>
        {c.status === 'aprobat' ? (
          <p><b>Aprobat</b>{c.profiles?.full_name ? ` de ${c.profiles.full_name}` : ''}, la {format(new Date(c.data_decizie), 'dd.MM.yyyy HH:mm')}.</p>
        ) : c.status === 'respins' ? (
          <p style={{ color: '#b91c1c' }}><b>Respins</b>{c.motiv_respingere ? ` — motiv: ${c.motiv_respingere}` : ''}, la {format(new Date(c.data_decizie), 'dd.MM.yyyy HH:mm')}.</p>
        ) : (
          <p>De acord ................................. <span style={{ fontSize: '8pt', color: '#888' }}>(semnătură angajator/manager)</span></p>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// QRFormModal — cod QR de printat, pentru afisat in firma
// ═════════════════════════════════════════════════════════════
function QRFormModal({ onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const formUrl = `${window.location.origin}/hr/cerere`

  useEffect(() => {
    QRCode.toDataURL(formUrl, { width: 400, margin: 1, color: { dark: '#111111', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [formUrl])

  const handlePrint = () => window.print()

  return (
    <>
      <style>{`
        @media print {
          body > *:not(#hr-qr-print-area) { display: none !important; }
          #hr-qr-print-area { display: flex !important; }
          @page { size: A4 portrait; margin: 15mm; }
        }
        @media screen {
          #hr-qr-print-area { display: none; }
        }
      `}</style>

      {createPortal(
        <div id="hr-qr-print-area" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: 'Arial, Helvetica, sans-serif', textAlign: 'center' }}>
          <h1 style={{ fontSize: '22pt', marginBottom: '4mm' }}>Cerere de concediu / învoire</h1>
          <p style={{ fontSize: '12pt', color: '#555', marginBottom: '10mm' }}>Scanează codul QR pentru a depune o cerere</p>
          {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: '80mm', height: '80mm' }} />}
          <p style={{ fontSize: '10pt', color: '#999', marginTop: '10mm' }}>{formUrl}</p>
        </div>,
        document.body
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-bold text-gray-900">Cod QR formular</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-6 py-6 flex flex-col items-center gap-3">
            {qrDataUrl ? <img src={qrDataUrl} alt="QR" className="w-48 h-48" /> : <Loader2 className="w-8 h-8 animate-spin text-gray-300" />}
            <p className="text-xs text-gray-400 text-center">Printează și afișează acest cod în firmă, pentru ca angajații să poată depune cereri.</p>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">Închide</button>
            <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
              <Printer className="w-4 h-4" /> Printează A4
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
