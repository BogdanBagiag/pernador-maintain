import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../contexts/PermissionsContext'
import { useAuth } from '../contexts/AuthContext'
import { callClaude } from '../utils/claudeApi'
import {
  ShoppingCart, ClipboardList, Calendar, RotateCcw, Megaphone,
  Car, MapPin, Home, Wrench, Sparkles, Loader2, AlertCircle,
  CheckCircle2, ListChecks,
} from 'lucide-react'

const todayMidnight = () => new Date(new Date().toDateString())
const addDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
const isoDate = (date) => date.toISOString().split('T')[0]

// Clasifica un item dupa data lui (scadenta/expirare) fata de azi
const classifyByDate = (dateStr) => {
  const d = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr)
  const today = todayMidnight()
  const days = Math.round((d - today) / (1000 * 60 * 60 * 24))
  return { urgency: days < 0 ? 'overdue' : days === 0 ? 'today' : 'soon', days }
}

const URGENCY_RANK = { overdue: 0, today: 1, soon: 2 }
const URGENCY_STYLE = {
  overdue: { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  today:   { dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  soon:    { dot: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
}

const urgencyLabel = ({ urgency, days }) => {
  if (urgency === 'overdue') return `Întârziat ${Math.abs(days)} ${Math.abs(days) === 1 ? 'zi' : 'zile'}`
  if (urgency === 'today') return 'Azi'
  return `În ${days} ${days === 1 ? 'zi' : 'zile'}`
}

export default function TodayPriorityPanel() {
  const { canView, isAdmin } = usePermissions()
  const { profile } = useAuth()
  // Vizibil daca esti admin, daca itemul nu are pe nimeni asignat, sau daca esti chiar tu asignatul
  const visibleToUser = (assigneeId) => isAdmin || !assigneeId || assigneeId === profile?.id
  const visibleToUserByName = (name) => isAdmin || !name || name === profile?.full_name
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const today = todayMidnight()
  const todayIso = isoDate(today)
  const in2days  = isoDate(addDays(today, 2))
  const in7days  = isoDate(addDays(today, 7))
  const in14days = isoDate(addDays(today, 14))
  const staleReturns3 = isoDate(addDays(today, -3))
  const staleReclamatii2 = isoDate(addDays(today, -2))

  // 1. Comenzi cu termen de livrare depasit sau in urmatoarele 2 zile
  const { data: comenzi = [] } = useQuery({
    queryKey: ['today-panel-comenzi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('com_comenzi')
        .select('id, data_livrare, status, com_clienti(denumire)')
        .in('status', ['noi', 'in_lucru'])
        .lte('data_livrare', in2days)
        .order('data_livrare', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: canView('comenzi'),
  })

  // 2. Reparatii deschise, critice sau cu data programata deja trecuta
  const { data: workOrders = [] } = useQuery({
    queryKey: ['today-panel-work-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select('id, title, priority, scheduled_date, status, assigned_to, equipment:equipment(name)')
        .in('status', ['open', 'in_progress'])
        .order('scheduled_date', { ascending: true })
      if (error) throw error
      return (data || []).filter((wo) =>
        wo.priority === 'critical' || (wo.scheduled_date && wo.scheduled_date.slice(0, 10) <= todayIso)
      )
    },
    enabled: canView('work_orders'),
  })

  // 3. Mentenanta preventiva restanta sau in urmatoarele 7 zile
  const { data: schedules = [] } = useQuery({
    queryKey: ['today-panel-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select('id, title, description, next_due_date, assigned_to, equipment:equipment(name)')
        .eq('is_active', true)
        .lte('next_due_date', in7days)
        .order('next_due_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: canView('schedules'),
  })

  // 4. Retururi neachitate de mai mult de 3 zile
  const { data: retururi = [] } = useQuery({
    queryKey: ['today-panel-retururi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retururi')
        .select('id, nume_client, valoare, data_cerere, responsabil_id')
        .is('data_plata', null)
        .lte('data_cerere', staleReturns3)
        .order('data_cerere', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: canView('retururi'),
  })

  // 5. Reclamatii nerezolvate de mai mult de 2 zile
  const { data: reclamatii = [] } = useQuery({
    queryKey: ['today-panel-reclamatii'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reclamatii')
        .select('id, nume_client, data_reclamatie, responsabil')
        .is('data_rezolvare', null)
        .lte('data_reclamatie', staleReclamatii2)
        .order('data_reclamatie', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: canView('reclamatii'),
  })

  // 6. Documente masini (ITP, asigurari, rovinieta) expirate sau in urmatoarele 14 zile
  const { data: vehiclesLookup = [] } = useQuery({
    queryKey: ['today-panel-vehicles-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('id, brand, model, registration_number')
      if (error) throw error
      return data
    },
    enabled: canView('vehicles'),
  })
  const { data: vehicleItp = [] } = useQuery({
    queryKey: ['today-panel-vehicle-itp'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicle_itp').select('id, vehicle_id, expiry_date').eq('is_active', true).lte('expiry_date', in14days)
      if (error) throw error
      return data
    },
    enabled: canView('vehicles'),
  })
  const { data: vehicleInsurances = [] } = useQuery({
    queryKey: ['today-panel-vehicle-insurances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicle_insurances').select('id, vehicle_id, insurance_type, end_date').eq('is_active', true).lte('end_date', in14days)
      if (error) throw error
      return data
    },
    enabled: canView('vehicles'),
  })
  const { data: vehicleVignettes = [] } = useQuery({
    queryKey: ['today-panel-vehicle-vignettes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicle_vignettes').select('id, vehicle_id, end_date').eq('is_active', true).lte('end_date', in14days)
      if (error) throw error
      return data
    },
    enabled: canView('vehicles'),
  })

  // 7. Inspectii + asigurari locatii, expirate sau in urmatoarele 14 zile
  const { data: locationsLookup = [] } = useQuery({
    queryKey: ['today-panel-locations-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('locations').select('id, name')
      if (error) throw error
      return data
    },
    enabled: canView('locations'),
  })
  const { data: locationInspections = [] } = useQuery({
    queryKey: ['today-panel-location-inspections'],
    queryFn: async () => {
      const { data, error } = await supabase.from('location_inspections').select('id, location_id, tip, data_expirare').lte('data_expirare', in14days)
      if (error) throw error
      return data
    },
    enabled: canView('locations'),
  })
  const { data: locationInsurances = [] } = useQuery({
    queryKey: ['today-panel-location-insurances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('location_insurances').select('id, location_id, tip, data_expirare').lte('data_expirare', in14days)
      if (error) throw error
      return data
    },
    enabled: canView('locations'),
  })

  // 8. Asigurari + contracte chiriasi proprietati, expirate sau in urmatoarele 14 zile
  const { data: propertiesLookup = [] } = useQuery({
    queryKey: ['today-panel-properties-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rental_properties').select('id, name')
      if (error) throw error
      return data
    },
    enabled: canView('properties'),
  })
  const { data: propertyInsurances = [] } = useQuery({
    queryKey: ['today-panel-property-insurances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('property_insurances').select('id, property_id, tip, data_expirare').lte('data_expirare', in14days)
      if (error) throw error
      return data
    },
    enabled: canView('properties'),
  })
  const { data: propertyTenants = [] } = useQuery({
    queryKey: ['today-panel-property-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_tenants')
        .select('id, property_id, name, contract_end_date')
        .eq('is_active', true)
        .not('contract_end_date', 'is', null)
        .lte('contract_end_date', in14days)
      if (error) throw error
      return data
    },
    enabled: canView('properties'),
  })

  // 9. Inspectii periodice echipamente, expirate sau in urmatoarele 14 zile
  const { data: equipmentList = [] } = useQuery({
    queryKey: ['today-panel-equipment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('id, name, inspection_required, last_inspection_date, inspection_frequency_months, location:locations(name)')
        .eq('inspection_required', true)
      if (error) throw error
      return data
    },
    enabled: canView('equipment'),
  })

  // ── Combina toate sursele intr-o lista unica, normalizata ──────────────
  const items = useMemo(() => {
    const list = []

    comenzi.forEach((c) => {
      const { urgency, days } = classifyByDate(c.data_livrare)
      list.push({
        id: `comanda-${c.id}`, module: 'Comenzi', icon: ShoppingCart,
        title: c.com_clienti?.denumire || 'Client necunoscut',
        detail: 'Termen de livrare', urgency, days, href: '/comenzi',
      })
    })

    workOrders.forEach((wo) => {
      if (!visibleToUser(wo.assigned_to)) return
      const overdue = wo.scheduled_date && wo.scheduled_date.slice(0, 10) < todayIso
      const { urgency, days } = wo.scheduled_date ? classifyByDate(wo.scheduled_date) : { urgency: 'today', days: 0 }
      list.push({
        id: `wo-${wo.id}`, module: 'Reparații', icon: ClipboardList,
        title: wo.title, detail: wo.equipment?.name || (wo.priority === 'critical' ? 'Prioritate critică' : ''),
        urgency: wo.priority === 'critical' && !overdue ? 'today' : urgency, days, href: '/work-orders',
      })
    })

    schedules.forEach((s) => {
      if (!visibleToUser(s.assigned_to)) return
      const { urgency, days } = classifyByDate(s.next_due_date)
      list.push({
        id: `sch-${s.id}`, module: 'Mentenanță', icon: Calendar,
        title: s.equipment?.name || s.title || 'Echipament', detail: s.title || s.description || 'Mentenanță programată',
        urgency, days, href: '/schedules',
      })
    })

    retururi.forEach((r) => {
      if (!visibleToUser(r.responsabil_id)) return
      const { days } = classifyByDate(r.data_cerere)
      list.push({
        id: `ret-${r.id}`, module: 'Retururi', icon: RotateCcw,
        title: r.nume_client || 'Client necunoscut', detail: `Neachitat de ${Math.abs(days)} zile${r.valoare ? ` · ${r.valoare} Lei` : ''}`,
        urgency: 'overdue', days, href: '/retururi',
      })
    })

    reclamatii.forEach((r) => {
      if (!visibleToUserByName(r.responsabil)) return
      const { days } = classifyByDate(r.data_reclamatie)
      list.push({
        id: `rec-${r.id}`, module: 'Reclamații', icon: Megaphone,
        title: r.nume_client || 'Client necunoscut', detail: `Nerezolvată de ${Math.abs(days)} zile`,
        urgency: 'overdue', days, href: '/reclamatii',
      })
    })

    const vehicleLabel = (vehicleId) => {
      const v = vehiclesLookup.find((x) => x.id === vehicleId)
      return v ? `${v.brand} ${v.model} (${v.registration_number})` : 'Mașină'
    }
    vehicleItp.forEach((v) => {
      const { urgency, days } = classifyByDate(v.expiry_date)
      list.push({ id: `itp-${v.id}`, module: 'Mașini', icon: Car, title: vehicleLabel(v.vehicle_id), detail: 'ITP', urgency, days, href: '/vehicles' })
    })
    vehicleInsurances.forEach((v) => {
      const { urgency, days } = classifyByDate(v.end_date)
      list.push({ id: `vins-${v.id}`, module: 'Mașini', icon: Car, title: vehicleLabel(v.vehicle_id), detail: (v.insurance_type || 'Asigurare').toUpperCase(), urgency, days, href: '/vehicles' })
    })
    vehicleVignettes.forEach((v) => {
      const { urgency, days } = classifyByDate(v.end_date)
      list.push({ id: `vig-${v.id}`, module: 'Mașini', icon: Car, title: vehicleLabel(v.vehicle_id), detail: 'Rovinietă', urgency, days, href: '/vehicles' })
    })

    const locationLabel = (locationId) => locationsLookup.find((x) => x.id === locationId)?.name || 'Locație'
    locationInspections.forEach((i) => {
      const { urgency, days } = classifyByDate(i.data_expirare)
      list.push({ id: `linsp-${i.id}`, module: 'Locații', icon: MapPin, title: locationLabel(i.location_id), detail: i.tip, urgency, days, href: `/locations/${i.location_id}` })
    })
    locationInsurances.forEach((i) => {
      const { urgency, days } = classifyByDate(i.data_expirare)
      list.push({ id: `lins-${i.id}`, module: 'Locații', icon: MapPin, title: locationLabel(i.location_id), detail: i.tip, urgency, days, href: `/locations/${i.location_id}` })
    })

    const propertyLabel = (propertyId) => propertiesLookup.find((x) => x.id === propertyId)?.name || 'Proprietate'
    propertyInsurances.forEach((i) => {
      const { urgency, days } = classifyByDate(i.data_expirare)
      list.push({ id: `pins-${i.id}`, module: 'Proprietăți', icon: Home, title: propertyLabel(i.property_id), detail: i.tip, urgency, days, href: '/properties' })
    })
    propertyTenants.forEach((t) => {
      const { urgency, days } = classifyByDate(t.contract_end_date)
      list.push({ id: `pten-${t.id}`, module: 'Proprietăți', icon: Home, title: propertyLabel(t.property_id), detail: `Contract chiriaș: ${t.name}`, urgency, days, href: '/properties' })
    })

    equipmentList.forEach((eq) => {
      if (!eq.last_inspection_date || !eq.inspection_frequency_months) return
      const next = new Date(eq.last_inspection_date)
      next.setMonth(next.getMonth() + parseInt(eq.inspection_frequency_months))
      if (next > addDays(today, 14)) return
      const { urgency, days } = classifyByDate(isoDate(next))
      list.push({ id: `eq-${eq.id}`, module: 'Echipamente', icon: Wrench, title: eq.name, detail: eq.location?.name ? `Inspecție · ${eq.location.name}` : 'Inspecție periodică', urgency, days, href: `/equipment/${eq.id}` })
    })

    return list.sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || a.days - b.days)
  }, [
    comenzi, workOrders, schedules, retururi, reclamatii,
    vehiclesLookup, vehicleItp, vehicleInsurances, vehicleVignettes,
    locationsLookup, locationInspections, locationInsurances,
    propertiesLookup, propertyInsurances, propertyTenants,
    equipmentList, isAdmin, profile?.id, profile?.full_name,
  ])

  const overdueCount = items.filter((i) => i.urgency === 'overdue').length
  const todayCount = items.filter((i) => i.urgency === 'today').length

  const handleAiSummary = async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const system = `Ești asistentul operațional al unei firme care gestionează echipamente, mașini, locații, proprietăți în chirie și comenzi. Primești o listă de elemente care necesită atenție azi (întârziate, scadente azi, sau apropiate). Scrie un rezumat SCURT (maxim 4-5 propoziții), în română, practic și direct - fără introduceri, fără liste lungi, concentrat pe ce e cel mai urgent și ce ar trebui făcut primul azi. Poți grupa pe module dacă ajută la claritate.`
      const userMessage = `Elemente (${items.length}):\n` + items
        .slice(0, 40)
        .map((i) => `- [${i.module}] ${i.title} — ${i.detail} — ${urgencyLabel(i)}`)
        .join('\n')
      const text = await callClaude({ systemPrompt: system, userMessage, maxTokens: 500 })
      setAiSummary(text.trim())
    } catch (e) {
      setAiError(e.message || 'Eroare la generarea rezumatului.')
    } finally {
      setAiLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">Ce contează azi</h2>
        </div>
        <p className="text-sm text-gray-500">Nimic urgent momentan — totul e în regulă.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">Ce contează azi</h2>
          {overdueCount > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{overdueCount} întârziate</span>
          )}
          {todayCount > 0 && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">{todayCount} azi</span>
          )}
        </div>
        <button
          onClick={handleAiSummary}
          disabled={aiLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-50"
        >
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {aiLoading ? 'Se generează...' : aiSummary ? 'Regenerează rezumat AI' : 'Rezumat AI'}
        </button>
      </div>

      {aiError && (
        <div className="mx-6 mt-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {aiError}
        </div>
      )}
      {aiSummary && (
        <div className="mx-6 mt-4 bg-primary-50 border border-primary-100 rounded-lg px-4 py-3 flex gap-2">
          <Sparkles className="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-800 whitespace-pre-line">{aiSummary}</p>
        </div>
      )}

      <div className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
        {items.map((item) => {
          const style = URGENCY_STYLE[item.urgency]
          const Icon = item.icon
          return (
            <Link key={item.id} to={item.href} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
              <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                <p className="text-xs text-gray-500 truncate">{item.module} · {item.detail}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${style.bg} ${style.text} border ${style.border}`}>
                {urgencyLabel(item)}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
