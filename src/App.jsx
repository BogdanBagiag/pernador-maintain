import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { PermissionsProvider, usePermissions } from './contexts/PermissionsContext'
import { ShieldOff } from 'lucide-react'

// Pages
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import EquipmentList from './pages/EquipmentList'
import EquipmentDetail from './pages/EquipmentDetail'
import EquipmentForm from './pages/EquipmentForm'
import WorkOrderList from './pages/WorkOrderList'
import WorkOrderDetail from './pages/WorkOrderDetail'
import WorkOrderForm from './pages/WorkOrderForm'
import MaintenanceSchedules from './pages/MaintenanceSchedules'
import ChecklistTemplates from './pages/ChecklistTemplates'
import ProcedureTemplates from './pages/ProcedureTemplates'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import UserManagement from './pages/UserManagement'
import LocationsList from './pages/LocationsList'
import LocationForm from './pages/LocationForm'
import LocationDetail from './pages/LocationDetail'
import PublicLocationWrapper from './pages/PublicLocationWrapper'
import PublicScanWrapper from './pages/PublicScanWrapper'
import ScanPage from './pages/ScanPage'
import ReportIssue from './pages/ReportIssue'

// Vehicles
import VehicleList from './pages/VehicleList'
import VehicleDetail from './pages/VehicleDetail'
import VehicleForm from './pages/VehicleForm'

// Contracts
import ContractsList from './pages/ContractsList'
import ContractForm from './pages/ContractForm'
import ContractDetail from './pages/ContractDetail'
import ContractSign from './pages/ContractSign'
import ContractTemplateEditor from './pages/ContractTemplateEditor'
import PaymentConditionsPage from './pages/PaymentConditionsPage'

// Components
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Public Route wrapper (redirect to dashboard if already logged in)
function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// Pagina afișată când userul nu are acces la un modul
function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <ShieldOff className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Acces restricționat</h2>
      <p className="text-gray-500 text-sm max-w-sm">
        Nu ai permisiunea să accesezi această secțiune.
        Contactează administratorul pentru a-ți acorda accesul.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
      >
        ← Înapoi la Dashboard
      </Link>
    </div>
  )
}

// Route protejat prin modul din PermissionsContext
// module = cheia din MODULES (ex: 'equipment', 'contracts')
// adminOnly = doar admin are acces (ex: /users)
function ModuleRoute({ module, adminOnly = false, children }) {
  const { canView, isAdmin, loading } = usePermissions()

  if (loading) return <LoadingSpinner />
  if (adminOnly && !isAdmin) return <AccessDenied />
  if (module && !canView(module)) return <AccessDenied />

  return children
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <PermissionsProvider>
          <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />
            
            {/* Public Report Routes (No Auth Required) */}
            <Route path="/report/:equipmentId" element={<ReportIssue />} />
            <Route path="/report-issue" element={<ReportIssue />} />
            
            {/* Legacy route for old location QR codes - redirect to new format */}
            <Route path="/report" element={<ReportIssue />} />
            
            {/* Public Scan Route (No Auth Required) */}
            <Route path="/scan" element={<PublicScanWrapper />} />
            
            {/* Public Location Route - Smart Redirect */}
            <Route path="/locations/:id" element={<PublicLocationWrapper />} />

            {/* Public Contract Signing Route (No Auth Required) */}
            <Route path="/semna-contract/:token" element={<ContractSign />} />

            {/* Protected Routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      {/* Dashboard & Settings — accesibile de oricine autentificat */}
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/settings" element={<Settings />} />

                      {/* Equipment Routes */}
                      <Route path="/equipment" element={<ModuleRoute module="equipment"><EquipmentList /></ModuleRoute>} />
                      <Route path="/equipment/new" element={<ModuleRoute module="equipment"><EquipmentForm /></ModuleRoute>} />
                      <Route path="/equipment/:id" element={<ModuleRoute module="equipment"><EquipmentDetail /></ModuleRoute>} />
                      <Route path="/equipment/:id/edit" element={<ModuleRoute module="equipment"><EquipmentForm /></ModuleRoute>} />

                      {/* Work Order Routes */}
                      <Route path="/work-orders" element={<ModuleRoute module="work_orders"><WorkOrderList /></ModuleRoute>} />
                      <Route path="/work-orders/new" element={<ModuleRoute module="work_orders"><WorkOrderForm /></ModuleRoute>} />
                      <Route path="/work-orders/:id" element={<ModuleRoute module="work_orders"><WorkOrderDetail /></ModuleRoute>} />
                      <Route path="/work-orders/:id/edit" element={<ModuleRoute module="work_orders"><WorkOrderForm /></ModuleRoute>} />

                      {/* Location Routes */}
                      <Route path="/locations" element={<ModuleRoute module="locations"><LocationsList /></ModuleRoute>} />
                      <Route path="/locations/new" element={<ModuleRoute module="locations"><LocationForm /></ModuleRoute>} />
                      <Route path="/locations/:id/edit" element={<ModuleRoute module="locations"><LocationForm /></ModuleRoute>} />

                      {/* Vehicle Routes */}
                      <Route path="/vehicles" element={<ModuleRoute module="vehicles"><VehicleList /></ModuleRoute>} />
                      <Route path="/vehicles/new" element={<ModuleRoute module="vehicles"><VehicleForm /></ModuleRoute>} />
                      <Route path="/vehicles/:id" element={<ModuleRoute module="vehicles"><VehicleDetail /></ModuleRoute>} />
                      <Route path="/vehicles/:id/edit" element={<ModuleRoute module="vehicles"><VehicleForm /></ModuleRoute>} />

                      {/* Contract Routes */}
                      <Route path="/contracte" element={<ModuleRoute module="contracts"><ContractsList /></ModuleRoute>} />
                      <Route path="/contracte/nou" element={<ModuleRoute module="contracts"><ContractForm /></ModuleRoute>} />
                      <Route path="/contracte/conditii-plata" element={<ModuleRoute module="contracts"><PaymentConditionsPage /></ModuleRoute>} />
                      <Route path="/contracte/:id" element={<ModuleRoute module="contracts"><ContractDetail /></ModuleRoute>} />
                      <Route path="/contracte/:id/editeaza" element={<ModuleRoute module="contracts"><ContractForm /></ModuleRoute>} />
                      <Route path="/contracte/sablon" element={<ModuleRoute module="contracts"><ContractTemplateEditor /></ModuleRoute>} />

                      {/* Other Routes */}
                      <Route path="/schedules" element={<ModuleRoute module="schedules"><MaintenanceSchedules /></ModuleRoute>} />
                      <Route path="/checklist-templates" element={<ModuleRoute module="checklists"><ChecklistTemplates /></ModuleRoute>} />
                      <Route path="/procedure-templates" element={<ModuleRoute module="procedures"><ProcedureTemplates /></ModuleRoute>} />
                      <Route path="/reports" element={<ModuleRoute module="reports"><Reports /></ModuleRoute>} />

                      {/* Admin Only */}
                      <Route path="/users" element={<ModuleRoute adminOnly><UserManagement /></ModuleRoute>} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
          </PermissionsProvider>
      </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
