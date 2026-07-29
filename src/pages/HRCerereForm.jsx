import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { differenceInCalendarDays, format } from 'date-fns'
import {
  Users2, CalendarDays, Clock, ChevronLeft, ChevronRight,
  Check, Eraser, Loader2, PartyPopper, Search, X,
} from 'lucide-react'

// Pagina publica de depunere cereri HR - fara autentificare.
// Accesibila prin codul QR afisat in firma. Angajatul isi alege singur numele
// dintr-o lista (nu il scrie), ca datele sa fie corecte in sistem.

const TIPURI_CONCEDIU = ['Odihnă', 'Fără plată', 'Medical', 'Evenimente deosebite']
const SUGESTII_INTERES = ['De serviciu', 'Personal']

const todayStr = () => format(new Date(), 'yyyy-MM-dd')

// Mica "mască" pentru ora scrisă de mână (08:15), fără input type="time" (greu de folosit pe mobil)
const maskTime = (raw) => {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return digits.slice(0, 2) + ':' + digits.slice(2)
}
const isValidTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

export default function HRCerereForm() {
  const [step, setStep] = useState('tip') // tip -> angajat -> detalii -> semnatura -> succes
  const [tipCerere, setTipCerere] = useState(null) // 'concediu' | 'invoire'
  const [angajatId, setAngajatId] = useState(null)
  const [search, setSearch] = useState('')

  const [concediu, setConcediu] = useState({
    tip: TIPURI_CONCEDIU[0],
    data_inceput: todayStr(),
    data_sfarsit: todayStr(),
    observatii: '',
  })
  const [invoire, setInvoire] = useState({
    data: todayStr(),
    ora_inceput: '',
    ora_sfarsit: '',
    interes: '',
  })

  const { data: angajati = [], isLoading: loadingAngajati } = useQuery({
    queryKey: ['hr_angajati_public'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('hr_get_angajati_public')
      if (error) throw error
      return data || []
    },
  })

  const angajat = angajati.find(a => a.id === angajatId)
  const searchReady = search.trim().length >= 2
  const filteredAngajati = searchReady
    ? angajati.filter(a => `${a.nume} ${a.prenume}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
    : []

  const nrZile = Math.max(1, differenceInCalendarDays(new Date(concediu.data_sfarsit), new Date(concediu.data_inceput)) + 1)

  // ── Semnătură pe canvas ──────────────────────────────────────────────────
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const hasSignatureRef = useRef(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    if (step !== 'semnatura') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const ratio = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * ratio
    canvas.height = canvas.clientHeight * ratio
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111827'
    hasSignatureRef.current = false
    setHasSignature(false)
  }, [step])

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const point = e.touches ? e.touches[0] : e
    return { x: point.clientX - rect.left, y: point.clientY - rect.top }
  }

  const startDraw = (e) => {
    e.preventDefault()
    drawingRef.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }
  const moveDraw = (e) => {
    if (!drawingRef.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasSignatureRef.current) { hasSignatureRef.current = true; setHasSignature(true) }
  }
  const endDraw = () => { drawingRef.current = false }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasSignatureRef.current = false
    setHasSignature(false)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = useMutation({
    mutationFn: async () => {
      const semnatura = canvasRef.current.toDataURL('image/png')
      if (tipCerere === 'concediu') {
        const { error } = await supabase.rpc('hr_submit_cerere_concediu', {
          p_angajat_id: angajatId,
          p_tip: concediu.tip,
          p_data_inceput: concediu.data_inceput,
          p_data_sfarsit: concediu.data_sfarsit,
          p_nr_zile: nrZile,
          p_observatii: concediu.observatii || null,
          p_semnatura_base64: semnatura,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.rpc('hr_submit_cerere_invoire', {
          p_angajat_id: angajatId,
          p_data: invoire.data,
          p_ora_inceput: invoire.ora_inceput,
          p_ora_sfarsit: invoire.ora_sfarsit,
          p_interes: invoire.interes || null,
          p_semnatura_base64: semnatura,
        })
        if (error) throw error
      }
    },
    onSuccess: () => setStep('succes'),
  })

  const resetForm = () => {
    setStep('tip')
    setTipCerere(null)
    setAngajatId(null)
    setSearch('')
    setConcediu({ tip: TIPURI_CONCEDIU[0], data_inceput: todayStr(), data_sfarsit: todayStr(), observatii: '' })
    setInvoire({ data: todayStr(), ora_inceput: '', ora_sfarsit: '', interes: '' })
  }

  const handleClose = () => {
    window.close()
    // daca browserul nu permite inchiderea (pagina nu a fost deschisa din script),
    // resetam formularul ca sa fie gata pentru urmatorul angajat de pe acelasi telefon/tableta
    resetForm()
  }

  const STEP_ORDER = ['tip', 'angajat', 'detalii', 'semnatura', 'succes']
  const stepIdx = STEP_ORDER.indexOf(step)

  const canGoNextDetalii = tipCerere === 'concediu'
    ? concediu.data_inceput && concediu.data_sfarsit && concediu.data_sfarsit >= concediu.data_inceput
    : invoire.data && isValidTime(invoire.ora_inceput) && isValidTime(invoire.ora_sfarsit) && invoire.ora_sfarsit > invoire.ora_inceput

  return (
    <div className="min-h-screen bg-gray-50 flex items-start sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-primary-600 px-6 py-5 text-white">
          <div className="flex items-center gap-2">
            <Users2 className="w-5 h-5" />
            <span className="font-bold text-lg">Resurse Umane</span>
          </div>
          <p className="text-primary-100 text-sm mt-0.5">Cerere concediu / învoire</p>
          {step !== 'succes' && (
            <div className="flex gap-1.5 mt-3">
              {STEP_ORDER.slice(0, 4).map((s, i) => (
                <div key={s} className={`h-1 flex-1 rounded-full ${i <= stepIdx ? 'bg-white' : 'bg-white/30'}`} />
              ))}
            </div>
          )}
        </div>

        <div className="p-6">
          {/* Pas 1: tip cerere */}
          {step === 'tip' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-2">Ce dorești să depui?</p>
              <button
                onClick={() => { setTipCerere('concediu'); setStep('angajat') }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors text-left"
              >
                <CalendarDays className="w-6 h-6 text-primary-600 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-gray-900">Cerere de concediu</div>
                  <div className="text-xs text-gray-400">O zi sau o perioadă de zile</div>
                </div>
              </button>
              <button
                onClick={() => { setTipCerere('invoire'); setStep('angajat') }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors text-left"
              >
                <Clock className="w-6 h-6 text-primary-600 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-gray-900">Cerere de învoire</div>
                  <div className="text-xs text-gray-400">Câteva ore, într-o zi anume</div>
                </div>
              </button>
            </div>
          )}

          {/* Pas 2: alege angajat */}
          {step === 'angajat' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Cine ești? Scrie-ți numele:</p>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Ex: Bogdan"
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-0.5">
                {loadingAngajati && searchReady && (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                )}
                {!searchReady && (
                  <p className="text-sm text-gray-400 text-center py-6">Scrie cel puțin 2 litere din nume ca să apară.</p>
                )}
                {searchReady && !loadingAngajati && filteredAngajati.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Niciun angajat găsit.</p>
                )}
                {filteredAngajati.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { setAngajatId(a.id); setStep('detalii') }}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border font-medium text-sm transition-colors ${
                      angajatId === a.id ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {a.nume} {a.prenume}
                  </button>
                ))}
              </div>
              <button onClick={() => setStep('tip')} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 pt-1">
                <ChevronLeft className="w-4 h-4" /> Înapoi
              </button>
            </div>
          )}

          {/* Pas 3: detalii */}
          {step === 'detalii' && tipCerere === 'concediu' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Detalii concediu pentru <b>{angajat?.nume} {angajat?.prenume}</b></p>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Tip concediu</label>
                <select
                  value={concediu.tip}
                  onChange={e => setConcediu({ ...concediu, tip: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  {TIPURI_CONCEDIU.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Din data</label>
                  <input
                    type="date"
                    value={concediu.data_inceput}
                    onChange={e => setConcediu({ ...concediu, data_inceput: e.target.value, data_sfarsit: e.target.value > concediu.data_sfarsit ? e.target.value : concediu.data_sfarsit })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Până în data</label>
                  <input
                    type="date"
                    value={concediu.data_sfarsit}
                    min={concediu.data_inceput}
                    onChange={e => setConcediu({ ...concediu, data_sfarsit: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-600">
                Total: <b className="text-gray-900">{nrZile} {nrZile === 1 ? 'zi' : 'zile'}</b>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Observații (opțional)</label>
                <textarea
                  value={concediu.observatii}
                  onChange={e => setConcediu({ ...concediu, observatii: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                />
              </div>

              <div className="flex justify-between pt-1">
                <button onClick={() => setStep('angajat')} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Înapoi
                </button>
                <button
                  disabled={!canGoNextDetalii}
                  onClick={() => setStep('semnatura')}
                  className="flex items-center gap-1 bg-primary-600 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-primary-700 disabled:opacity-40"
                >
                  Continuă <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 'detalii' && tipCerere === 'invoire' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Detalii învoire pentru <b>{angajat?.nume} {angajat?.prenume}</b></p>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Data</label>
                <input
                  type="date"
                  value={invoire.data}
                  onChange={e => setInvoire({ ...invoire, data: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">De la ora</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="08:15"
                    maxLength={5}
                    value={invoire.ora_inceput}
                    onChange={e => setInvoire({ ...invoire, ora_inceput: maskTime(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Până la ora</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="16:30"
                    maxLength={5}
                    value={invoire.ora_sfarsit}
                    onChange={e => setInvoire({ ...invoire, ora_sfarsit: maskTime(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">În interes de (opțional)</label>
                <div className="flex gap-2 mb-2">
                  {SUGESTII_INTERES.map(s => (
                    <button
                      key={s}
                      onClick={() => setInvoire({ ...invoire, interes: s })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                        invoire.interes === s ? 'bg-primary-100 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input
                  value={invoire.interes}
                  onChange={e => setInvoire({ ...invoire, interes: e.target.value })}
                  placeholder="ex: programare medic"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>

              <div className="flex justify-between pt-1">
                <button onClick={() => setStep('angajat')} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Înapoi
                </button>
                <button
                  disabled={!canGoNextDetalii}
                  onClick={() => setStep('semnatura')}
                  className="flex items-center gap-1 bg-primary-600 text-white px-4 py-2 rounded-xl font-medium text-sm hover:bg-primary-700 disabled:opacity-40"
                >
                  Continuă <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Pas 4: semnătură */}
          {step === 'semnatura' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 text-sm text-gray-600 space-y-1">
                <p><b>{angajat?.nume} {angajat?.prenume}</b></p>
                {tipCerere === 'concediu' ? (
                  <p>{concediu.tip} · {format(new Date(concediu.data_inceput), 'dd.MM.yyyy')} – {format(new Date(concediu.data_sfarsit), 'dd.MM.yyyy')} ({nrZile} {nrZile === 1 ? 'zi' : 'zile'})</p>
                ) : (
                  <p>Învoire {format(new Date(invoire.data), 'dd.MM.yyyy')}, {invoire.ora_inceput}–{invoire.ora_sfarsit}{invoire.interes ? ` · ${invoire.interes}` : ''}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-500">Semnează aici</label>
                  <button onClick={clearSignature} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <Eraser className="w-3.5 h-3.5" /> Șterge
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  style={{ touchAction: 'none' }}
                  className="w-full h-36 rounded-xl border-2 border-dashed border-gray-300 bg-white"
                  onMouseDown={startDraw}
                  onMouseMove={moveDraw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={moveDraw}
                  onTouchEnd={endDraw}
                />
              </div>

              {submit.isError && (
                <p className="text-xs text-red-500 text-center">Eroare: {submit.error?.message}</p>
              )}

              <div className="flex justify-between pt-1">
                <button onClick={() => setStep('detalii')} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Înapoi
                </button>
                <button
                  disabled={!hasSignature || submit.isPending}
                  onClick={() => submit.mutate()}
                  className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-primary-700 disabled:opacity-40"
                >
                  {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Trimite cererea
                </button>
              </div>
            </div>
          )}

          {/* Pas 5: succes */}
          {step === 'succes' && (
            <div className="text-center py-6 space-y-4">
              <PartyPopper className="w-12 h-12 text-primary-500 mx-auto" />
              <p className="font-semibold text-gray-900">Cererea a fost trimisă!</p>
              <p className="text-sm text-gray-400">Va fi analizată de HR.</p>
              <button
                onClick={handleClose}
                className="flex items-center gap-2 mx-auto bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-primary-700"
              >
                <X className="w-4 h-4" /> Închide
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
