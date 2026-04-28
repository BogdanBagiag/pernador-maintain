import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { supabase } from '../lib/supabase'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Wrench, ClipboardList, Calendar, BarChart3,
  Settings, LogOut, Menu, X, MapPin, QrCode, CheckSquare,
  FileText, Users, Car, Package, BookOpen, LayoutGrid,
  ScrollText, ChevronDown, BookMarked, RotateCcw, Megaphone, ShoppingCart,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications'

// ── Structura navigației grupate ─────────────────────────────
const STANDALONE = [
  { name: 'Dashboard',  href: '/dashboard', icon: LayoutDashboard },
  { name: 'To Do',      href: '/todo',       icon: LayoutGrid,  moduleKey: 'todo' },
]

const GROUPS = [
  {
    key: 'operational',
    label: 'Operațional',
    items: [
      { name: 'Scanare QR',              href: '/scan',                 icon: QrCode,        moduleKey: 'qr_scan' },
      { name: 'Reparații de efectuat',   href: '/work-orders',          icon: ClipboardList, moduleKey: 'work_orders' },
      { name: 'Mentenanță preventivă',   href: '/schedules',            icon: Calendar,      moduleKey: 'schedules' },
      { name: 'Liste de verificare',     href: '/checklist-templates',  icon: CheckSquare,   moduleKey: 'checklists' },
      { name: 'Proceduri',               href: '/procedure-templates',  icon: FileText,      moduleKey: 'procedures' },
      { name: 'Inventar piese',          href: '/parts-inventory',      icon: Package,       moduleKey: 'parts_inventory' },
      { name: 'Raport',                  href: '/reports',              icon: BarChart3,     moduleKey: 'reports' },
    ],
  },
  {
    key: 'assets',
    label: 'Active',
    items: [
      { name: 'Echipamente', href: '/equipment', icon: Wrench, moduleKey: 'equipment' },
      { name: 'Locații',     href: '/locations', icon: MapPin,  moduleKey: 'locations' },
      { name: 'Mașini',      href: '/vehicles',  icon: Car,     moduleKey: 'vehicles' },
    ],
  },
  {
    key: 'documents',
    label: 'Documente',
    items: [
      { name: 'Contracte',           href: '/contracte',          icon: ScrollText,  moduleKey: 'contracts' },
      { name: 'Registru Încasări',   href: '/registru-incasari',  icon: BookMarked,  moduleKey: 'registru_incasari' },
      { name: 'Retururi',            href: '/retururi',           icon: RotateCcw,   moduleKey: 'retururi' },
      { name: 'Reclamații',          href: '/reclamatii',         icon: Megaphone,      moduleKey: 'reclamatii' },
      { name: 'Comenzi',             href: '/comenzi',            icon: ShoppingCart,   moduleKey: 'comenzi' },
      { name: 'Manual de utilizare', href: '/manual',             icon: BookOpen },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    items: [
      { name: 'Setări',      href: '/settings', icon: Settings },
      { name: 'Utilizatori', href: '/users',    icon: Users,    adminOnly: true },
    ],
  },
]

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const { t } = useLanguage()
  const { visibleModules, isAdmin } = usePermissions()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Notificări realtime pentru module (comenzi, reclamații, retururi, work orders)
  useRealtimeNotifications()

  // Determină ce grup conține ruta activă
  const activeGroup = GROUPS.find((g) =>
    g.items.some((item) => location.pathname.startsWith(item.href))
  )?.key

  // Stare collapse per grup — implicit deschis dacă conține ruta activă
  const [openGroups, setOpenGroups] = useState(() => {
    const saved = localStorage.getItem('kan_nav_groups')
    if (saved) {
      try { return JSON.parse(saved) } catch {}
    }
    // Default: toate închise, cel activ deschis
    return GROUPS.reduce((acc, g) => {
      acc[g.key] = activeGroup === g.key
      return acc
    }, {})
  })

  // Deschide automat grupul rutei active la navigare
  useEffect(() => {
    if (activeGroup) {
      setOpenGroups((prev) => {
        if (prev[activeGroup]) return prev
        const next = { ...prev, [activeGroup]: true }
        localStorage.setItem('kan_nav_groups', JSON.stringify(next))
        return next
      })
    }
  }, [activeGroup])

  const toggleGroup = (key) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem('kan_nav_groups', JSON.stringify(next))
      return next
    })
  }

  // ── Badges navigație ─────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]

  const { data: retururiNeachitate = 0 } = useQuery({
    queryKey: ['badge_retururi'],
    queryFn: async () => {
      const { count } = await supabase
        .from('retururi').select('id', { count: 'exact', head: true }).is('data_plata', null)
      return count || 0
    },
    enabled: !!user, refetchInterval: 60_000, staleTime: 30_000,
  })

  const { data: workOrdersOpen = 0 } = useQuery({
    queryKey: ['badge_work_orders'],
    queryFn: async () => {
      const { count } = await supabase
        .from('work_orders').select('id', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress'])
      return count || 0
    },
    enabled: !!user, refetchInterval: 60_000, staleTime: 30_000,
  })

  const { data: schedulesOverdue = 0 } = useQuery({
    queryKey: ['badge_schedules'],
    queryFn: async () => {
      const { count } = await supabase
        .from('maintenance_schedules').select('id', { count: 'exact', head: true })
        .lte('next_due_date', today).eq('is_active', true)
      return count || 0
    },
    enabled: !!user, refetchInterval: 60_000, staleTime: 30_000,
  })

  const { data: vehiclesExpired = 0 } = useQuery({
    queryKey: ['badge_vehicles'],
    queryFn: async () => {
      const [itp, ins, vig] = await Promise.all([
        supabase.from('vehicle_itp').select('vehicle_id').eq('is_active', true).lt('expiry_date', today),
        supabase.from('vehicle_insurances').select('vehicle_id').eq('is_active', true).lt('end_date', today),
        supabase.from('vehicle_vignettes').select('vehicle_id').eq('is_active', true).lt('end_date', today),
      ])
      const ids = new Set([
        ...(itp.data  || []).map(r => r.vehicle_id),
        ...(ins.data  || []).map(r => r.vehicle_id),
        ...(vig.data  || []).map(r => r.vehicle_id),
      ])
      return ids.size
    },
    enabled: !!user, refetchInterval: 60_000, staleTime: 30_000,
  })

  const { data: tasksDueToday = 0 } = useQuery({
    queryKey: ['badge_tasks_today'],
    queryFn: async () => {
      const { count } = await supabase
        .from('kan_tasks').select('id', { count: 'exact', head: true })
        .eq('due_date', today).eq('completed', false)
      return count || 0
    },
    enabled: !!user, refetchInterval: 60_000, staleTime: 30_000,
  })

  const { data: reclamatiiNerezolvate = 0 } = useQuery({
    queryKey: ['badge_reclamatii'],
    queryFn: async () => {
      const { count } = await supabase
        .from('reclamatii').select('id', { count: 'exact', head: true }).is('data_rezolvare', null)
      return count || 0
    },
    enabled: !!user, refetchInterval: 60_000, staleTime: 30_000,
  })

  const { data: comenziNoi = 0 } = useQuery({
    queryKey: ['badge_comenzi'],
    queryFn: async () => {
      const { count } = await supabase
        .from('com_comenzi').select('id', { count: 'exact', head: true }).eq('status', 'noi')
      return count || 0
    },
    enabled: !!user, refetchInterval: 60_000, staleTime: 30_000,
  })

  // Badge per href și per grup
  const ITEM_BADGES = {
    '/retururi':    retururiNeachitate,
    '/work-orders': workOrdersOpen,
    '/schedules':   schedulesOverdue,
    '/vehicles':    vehiclesExpired,
    '/todo':        tasksDueToday,
    '/reclamatii':  reclamatiiNerezolvate,
    '/comenzi':     comenziNoi,
  }
  const GROUP_BADGES = {
    operational: workOrdersOpen + schedulesOverdue,
    assets:      vehiclesExpired,
    documents:   retururiNeachitate + reclamatiiNerezolvate + comenziNoi,
  }

  const isItemVisible = (item) => {
    if (!item.moduleKey && !item.adminOnly) return true
    if (item.adminOnly) return isAdmin
    return visibleModules.some((m) => m.key === item.moduleKey)
  }

  const isGroupVisible = (group) =>
    group.items.some(isItemVisible)

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error.message)
    }
  }

  const NavLink = ({ item, badge = 0 }) => {
    const isActive = location.pathname.startsWith(item.href)
    return (
      <Link
        to={item.href}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <item.icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{item.name}</span>
        {badge > 0 && (
          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    )
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-gray-200 flex-shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2">
          <Wrench className="w-7 h-7 text-primary-600" />
          <span className="text-lg font-bold text-gray-900">Pernador</span>
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">

        {/* Standalone items */}
        {STANDALONE.filter(isItemVisible).map((item) => (
          <NavLink key={item.href} item={item} badge={ITEM_BADGES[item.href] || 0} />
        ))}

        {/* Divider */}
        <div className="pt-2" />

        {/* Grouped items */}
        {GROUPS.filter(isGroupVisible).map((group) => {
          const isOpen = openGroups[group.key]
          const hasActive = group.items.some((i) => location.pathname.startsWith(i.href))

          return (
            <div key={group.key}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors ${
                  hasActive
                    ? 'text-primary-600'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  {group.label}
                  {(GROUP_BADGES[group.key] || 0) > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                      {GROUP_BADGES[group.key] > 99 ? '99+' : GROUP_BADGES[group.key]}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Group items */}
              {isOpen && (
                <div className="mt-0.5 ml-2 pl-2 border-l border-gray-200 space-y-0.5">
                  {group.items.filter(isItemVisible).map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      badge={ITEM_BADGES[item.href] || 0}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* User info & logout */}
      <div className="p-3 border-t border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3 px-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold flex-shrink-0">
            {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {profile?.full_name || user?.email}
            </p>
            <p className="text-xs text-gray-400 capitalize">{profile?.role || 'User'}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-60 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </div>

      {/* Main content */}
      <div className="lg:pl-60">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 flex items-center h-14 bg-white border-b border-gray-200 px-4 gap-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary-600" />
            <span className="text-base font-bold text-gray-900">Pernador</span>
          </Link>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
