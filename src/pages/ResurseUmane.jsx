import { useState, useEffect, useMemo } from 'react'
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
import {
  Users2, Plus, Pencil, Trash2, Search, Save, X, Loader2, Check, XCircle,
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, ClipboardList, BarChart2,
  QrCode, Printer, ShieldOff, Clock, CalendarDays, RotateCcw,
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
  const [month, setMonth] = useState(() => startOfMonth(new Date()))

  const rangeStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const rangeEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const monthStartStr = format(startOfMonth(month), 'yyyy-MM-dd')
  const monthEndStr = format(endOfMonth(month), 'yyyy-MM-dd')

  const { data: concedii = [] } = useQuery({
    queryKey: ['hr_calendar_concedii', monthStartStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_cereri_concediu')
        .select('id, data_inceput, data_sfarsit, tip, hr_angajati(nume, prenume)')
        .eq('status', 'aprobat')
        .lte('data_inceput', monthEndStr)
        .gte('data_sfarsit', monthStartStr)
      if (error) throw error
      return data
    },
  })

  const { data: invoiri = [] } = useQuery({
    queryKey: ['hr_calendar_invoiri', monthStartStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_cereri_invoire')
        .select('id, data, ora_inceput, ora_sfarsit, hr_angajati(nume, prenume)')
        .eq('status', 'aprobat')
        .gte('data', monthStartStr)
        .lte('data', monthEndStr)
      if (error) throw error
      return data
    },
  })

  const days = []
  let d = rangeStart
  while (d <= rangeEnd) { days.push(d); d = addDays(d, 1) }

  const concediiForDay = (day) => concedii.filter(c =>
    day >= new Date(c.data_inceput + 'T00:00:00') && day <= new Date(c.data_sfarsit + 'T00:00:00')
  )
  const invoiriForDay = (day) => invoiri.filter(i => isSameDay(day, new Date(i.data + 'T00:00:00')))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth(m => subMonths(m, 1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="font-semibold text-gray-900 capitalize">{format(month, 'MMMM yyyy')}</h2>
        <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-3 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Concediu</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Învoire</span>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden text-xs">
        {['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'].map(d => (
          <div key={d} className="bg-gray-50 px-2 py-1.5 font-semibold text-gray-500 text-center">{d}</div>
        ))}
        {days.map(day => {
          const inMonth = isSameMonth(day, month)
          const dayConcedii = concediiForDay(day)
          const dayInvoiri = invoiriForDay(day)
          return (
            <div key={day.toISOString()} className={`bg-white min-h-[84px] p-1.5 ${!inMonth ? 'opacity-40' : ''}`}>
              <div className={`text-[11px] font-medium mb-1 ${isSameDay(day, new Date()) ? 'text-primary-600' : 'text-gray-400'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayConcedii.slice(0, 3).map(c => (
                  <div key={c.id} title={c.tip} className="truncate bg-blue-50 text-blue-700 rounded px-1 py-0.5 text-[10px] font-medium">
                    {c.hr_angajati?.nume} {c.hr_angajati?.prenume?.[0]}.
                  </div>
                ))}
                {dayInvoiri.slice(0, 2).map(i => (
                  <div key={i.id} title={`${i.ora_inceput}-${i.ora_sfarsit}`} className="truncate bg-amber-50 text-amber-700 rounded px-1 py-0.5 text-[10px] font-medium">
                    {i.hr_angajati?.nume} {i.hr_angajati?.prenume?.[0]}.
                  </div>
                ))}
              </div>
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
  const [subTab, setSubTab] = useState('concediu')

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {[
          { key: 'concediu', label: 'Cereri de concediu', icon: CalendarDays },
          { key: 'invoire', label: 'Cereri de învoire', icon: Clock },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${
              subTab === key ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {subTab === 'concediu' && <CereriConcediuList pEdit={pEdit} pDelete={pDelete} />}
      {subTab === 'invoire' && <CereriInvoireList pEdit={pEdit} pDelete={pDelete} />}
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

function CereriConcediuList({ pEdit, pDelete }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [filter, setFilter] = useState('in_asteptare')

  const { data: cereri = [], isLoading } = useQuery({
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

  const decide = useMutation({
    mutationFn: async ({ id, status, motiv_respingere }) => {
      const { error } = await supabase.from('hr_cereri_concediu')
        .update({ status, motiv_respingere: motiv_respingere || null, decis_de: user.id, data_decizie: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr_cereri_concediu'] }),
  })

  const deleteCerere = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('hr_cereri_concediu').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr_cereri_concediu'] }),
  })

  const filtered = filter === 'toate' ? cereri : cereri.filter(c => c.status === filter)

  return (
    <div>
      <FilterBar filter={filter} setFilter={setFilter} />
      {isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Se încarcă...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Nicio cerere.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3 justify-between">
              <div className="min-w-[220px]">
                <p className="font-semibold text-gray-900">{c.hr_angajati?.nume} {c.hr_angajati?.prenume}</p>
                <p className="text-sm text-gray-500">
                  {c.tip} · {format(new Date(c.data_inceput), 'dd.MM.yyyy')} – {format(new Date(c.data_sfarsit), 'dd.MM.yyyy')} ({c.nr_zile} {c.nr_zile === 1 ? 'zi' : 'zile'})
                </p>
                {c.observatii && <p className="text-xs text-gray-400 mt-0.5">{c.observatii}</p>}
              </div>
              <SignaturePreview src={c.semnatura_base64} />
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
              {pEdit && c.status === 'in_asteptare' && (
                <div className="flex gap-2">
                  <button onClick={() => decide.mutate({ id: c.id, status: 'aprobat' })}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                    <Check className="w-3.5 h-3.5" /> Aprobă
                  </button>
                  <button onClick={() => {
                    const motiv = window.prompt('Motiv respingere (opțional):') || ''
                    decide.mutate({ id: c.id, status: 'respins', motiv_respingere: motiv })
                  }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">
                    <XCircle className="w-3.5 h-3.5" /> Respinge
                  </button>
                </div>
              )}
              {c.status === 'respins' && c.motiv_respingere && (
                <p className="text-xs text-red-500 w-full">Motiv: {c.motiv_respingere}</p>
              )}
              {pDelete && (
                <button onClick={() => { if (confirm('Ștergi cererea?')) deleteCerere.mutate(c.id) }}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CereriInvoireList({ pEdit, pDelete }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [filter, setFilter] = useState('in_asteptare')
  const [expanded, setExpanded] = useState(null)

  const { data: cereri = [], isLoading } = useQuery({
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

  const decide = useMutation({
    mutationFn: async ({ id, status, motiv_respingere }) => {
      const { error } = await supabase.from('hr_cereri_invoire')
        .update({ status, motiv_respingere: motiv_respingere || null, decis_de: user.id, data_decizie: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr_cereri_invoire'] }),
  })

  const deleteCerere = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('hr_cereri_invoire').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr_cereri_invoire'] }),
  })

  const toggleRecuperatComplet = useMutation({
    mutationFn: async ({ id, val }) => {
      const { error } = await supabase.from('hr_cereri_invoire').update({ ore_recuperate_complet: val }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr_cereri_invoire'] }),
  })

  const filtered = filter === 'toate' ? cereri : cereri.filter(c => c.status === filter)

  return (
    <div>
      <FilterBar filter={filter} setFilter={setFilter} />
      {isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Se încarcă...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Nicio cerere.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="min-w-[220px]">
                  <p className="font-semibold text-gray-900">{c.hr_angajati?.nume} {c.hr_angajati?.prenume}</p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(c.data), 'dd.MM.yyyy')}, {c.ora_inceput?.slice(0,5)}–{c.ora_sfarsit?.slice(0,5)}
                    {c.interes ? ` · ${c.interes}` : ''}
                  </p>
                </div>
                <SignaturePreview src={c.semnatura_base64} />
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                {pEdit && c.status === 'in_asteptare' && (
                  <div className="flex gap-2">
                    <button onClick={() => decide.mutate({ id: c.id, status: 'aprobat' })}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                      <Check className="w-3.5 h-3.5" /> Aprobă
                    </button>
                    <button onClick={() => {
                      const motiv = window.prompt('Motiv respingere (opțional):') || ''
                      decide.mutate({ id: c.id, status: 'respins', motiv_respingere: motiv })
                    }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">
                      <XCircle className="w-3.5 h-3.5" /> Respinge
                    </button>
                  </div>
                )}
                {c.status === 'aprobat' && (
                  <button onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="text-xs text-primary-600 hover:underline font-medium flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> Recuperare ore
                  </button>
                )}
                {pDelete && (
                  <button onClick={() => { if (confirm('Ștergi cererea?')) deleteCerere.mutate(c.id) }}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {c.status === 'respins' && c.motiv_respingere && (
                <p className="text-xs text-red-500 mt-2">Motiv: {c.motiv_respingere}</p>
              )}
              {expanded === c.id && (
                <RecuperariPanel invoire={c} pEdit={pEdit} onToggleComplet={(val) => toggleRecuperatComplet.mutate({ id: c.id, val })} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RecuperariPanel({ invoire, pEdit, onToggleComplet }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ data: format(new Date(), 'yyyy-MM-dd'), ora_inceput: '', ora_sfarsit: '' })

  const { data: recuperari = [], isLoading } = useQuery({
    queryKey: ['hr_invoire_recuperari', invoire.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_invoire_recuperari')
        .select('*')
        .eq('invoire_id', invoire.id)
        .order('data')
      if (error) throw error
      return data
    },
  })

  const addRecuperare = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('hr_invoire_recuperari').insert({
        invoire_id: invoire.id, data: form.data, ora_inceput: form.ora_inceput, ora_sfarsit: form.ora_sfarsit,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr_invoire_recuperari', invoire.id] })
      setAdding(false)
      setForm({ data: format(new Date(), 'yyyy-MM-dd'), ora_inceput: '', ora_sfarsit: '' })
    },
  })

  const decideRecuperare = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase.from('hr_invoire_recuperari')
        .update({ status, decis_de: user.id, data_decizie: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr_invoire_recuperari', invoire.id] }),
  })

  const deleteRecuperare = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('hr_invoire_recuperari').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr_invoire_recuperari', invoire.id] }),
  })

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 bg-gray-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-xl">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase">Recuperare ore</p>
        {pEdit && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input type="checkbox" checked={invoire.ore_recuperate_complet} onChange={e => onToggleComplet(e.target.checked)} />
            Recuperare completă
          </label>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400">Se încarcă...</p>
      ) : recuperari.length === 0 && !adding ? (
        <p className="text-xs text-gray-400">Nicio sesiune de recuperare adăugată.</p>
      ) : (
        <div className="space-y-1.5">
          {recuperari.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5">
              <span className="flex-1">{format(new Date(r.data), 'dd.MM.yyyy')}, {r.ora_inceput?.slice(0,5)}–{r.ora_sfarsit?.slice(0,5)}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              {pEdit && r.status === 'in_asteptare' && (
                <>
                  <button onClick={() => decideRecuperare.mutate({ id: r.id, status: 'aprobat' })} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => decideRecuperare.mutate({ id: r.id, status: 'respins' })} className="p-1 text-red-500 hover:bg-red-50 rounded"><XCircle className="w-3.5 h-3.5" /></button>
                </>
              )}
              {pEdit && (
                <button onClick={() => deleteRecuperare.mutate(r.id)} className="p-1 text-gray-300 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {pEdit && (
        adding ? (
          <div className="flex flex-wrap items-end gap-2 mt-2 bg-white border border-gray-200 rounded-lg p-2.5">
            <div>
              <label className="text-[10px] text-gray-400 block">Data</label>
              <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })}
                className="border border-gray-200 rounded px-2 py-1 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block">De la</label>
              <input type="time" value={form.ora_inceput} onChange={e => setForm({ ...form, ora_inceput: e.target.value })}
                className="border border-gray-200 rounded px-2 py-1 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block">Până la</label>
              <input type="time" value={form.ora_sfarsit} onChange={e => setForm({ ...form, ora_sfarsit: e.target.value })}
                className="border border-gray-200 rounded px-2 py-1 text-xs" />
            </div>
            <button disabled={!form.ora_inceput || !form.ora_sfarsit || addRecuperare.isPending}
              onClick={() => addRecuperare.mutate()}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium disabled:opacity-40">
              Salvează
            </button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500">Anulează</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="mt-2 flex items-center gap-1 text-xs text-primary-600 font-medium hover:underline">
            <Plus className="w-3.5 h-3.5" /> Adaugă sesiune de recuperare
          </button>
        )
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// AngajatiTab
// ═════════════════════════════════════════════════════════════
function AngajatiTab({ pEdit, pDelete }) {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
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
          <button onClick={() => { setEditing(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Angajat nou
          </button>
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
    </>
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

  const totalZileConcediuAnul = useMemo(() =>
    concedii.filter(c => c.status === 'aprobat' && new Date(c.data_inceput).getFullYear() === year)
      .reduce((sum, c) => sum + (c.nr_zile || 0), 0)
  , [concedii, year])

  const totalInvoiriAprobate = invoiri.filter(i => i.status === 'aprobat').length

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
          <div className="grid grid-cols-2 gap-3 mb-5 max-w-md">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400">Zile concediu aprobate ({year})</p>
              <p className="text-2xl font-bold text-gray-900">{totalZileConcediuAnul}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400">Învoiri aprobate (total)</p>
              <p className="text-2xl font-bold text-gray-900">{totalInvoiriAprobate}</p>
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
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
        </>
      )}
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
