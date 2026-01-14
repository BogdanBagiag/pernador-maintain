import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  MapPin,
  QrCode,
  CheckSquare,
  FileText,
  Users,
  HelpCircle,
  Package,
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'nav.scanQR', href: '/scan', icon: QrCode },
  { name: 'nav.equipment', href: '/equipment', icon: Wrench },
  { name: 'nav.locations', href: '/locations', icon: MapPin },
  { name: 'nav.workOrders', href: '/work-orders', icon: ClipboardList },
  { name: 'nav.schedules', href: '/schedules', icon: Calendar },
  { name: 'nav.checklists', href: '/checklist-templates', icon: CheckSquare },
  { name: 'nav.procedures', href: '/procedure-templates', icon: FileText },
  { name: 'nav.reports', href: '/reports', icon: BarChart3 },
  { name: 'nav.partsInventory', href: '/parts-inventory', icon: Package, managerAccess: true },
  { name: 'nav.manual', href: '/manual', icon: HelpCircle },
  { name: 'nav.users', href: '/users', icon: Users, adminOnly: true },
  { name: 'nav.settings', href: '/settings', icon: Settings },
]

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const { t } = useLanguage()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Debug logging
  console.log('Layout - User:', user?.email)
  console.log('Layout - Profile:', profile)
  console.log('Layout - Profile Role:', profile?.role)
  console.log('Layout - Is Admin?:', profile?.role === 'admin')

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error.message)
    } finally {
      // Redirectăm întotdeauna către login, chiar dacă apare o eroare
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <Wrench className="w-8 h-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">Pernador</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation
              .filter(item => {
                if (item.adminOnly) return profile?.role === 'admin'
                if (item.managerAccess) return profile?.role === 'admin' || profile?.role === 'manager'
                return true
              })
              .map((item) => {
              const isActive = location.pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {t(item.name)}
                </Link>
              )
            })}
          </nav>

          {/* User info and logout */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {profile?.full_name || user?.email}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {profile?.role || 'User'}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 flex items-center h-16 bg-white border-b border-gray-200 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="px-4 text-gray-500 hover:text-gray-700"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/dashboard" className="flex items-center space-x-2">
            <Wrench className="w-6 h-6 text-primary-600" />
            <span className="text-lg font-bold text-gray-900">Pernador</span>
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
