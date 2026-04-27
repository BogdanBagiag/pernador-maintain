import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { PermissionsProvider } from './contexts/PermissionsContext'

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
import KanbanPage  from './pages/KanbanPage'
import KanbanBoard from './pages/KanbanBoard'
import VehicleList from './pages/VehicleList'
import VehicleForm from './pages/VehicleForm'
import VehicleDetail from './pages/VehicleDetail'
import PartsInventory from './pages/PartsInventory'
import ContractsList from './pages/ContractsList'
import ContractForm from './pages/ContractForm'
import ContractDetail from './pages/ContractDetail'
import ContractSign from './pages/ContractSign'
import ContractTemplateEditor from './pages/ContractTemplateEditor'
import RegistruIncasari from './pages/RegistruIncasari'
import Retururi from './pages/Retururi'
import Reclamatii from './pages/Reclamatii'
import Comenzi from './pages/Comenzi'

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PermissionsProvider>
        <LanguageProvider>
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


            {/* Protected Routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      
                      {/* Equipment Routes */}
                      <Route path="/equipment" element={<EquipmentList />} />
                      <Route path="/equipment/new" element={<EquipmentForm />} />
                      <Route path="/equipment/:id" element={<EquipmentDetail />} />
                      <Route path="/equipment/:id/edit" element={<EquipmentForm />} />
                      
                      {/* Work Order Routes */}
                      <Route path="/work-orders" element={<WorkOrderList />} />
                      <Route path="/work-orders/new" element={<WorkOrderForm />} />
                      <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
                      <Route path="/work-orders/:id/edit" element={<WorkOrderForm />} />
                      
                      {/* Location Routes */}
                      <Route path="/locations" element={<LocationsList />} />
                      <Route path="/locations/new" element={<LocationForm />} />
                      <Route path="/locations/:id/edit" element={<LocationForm />} />
                      
                      {/* Contract Routes */}
                      <Route path="/contracte" element={<ContractsList />} />
                      <Route path="/contracte/new" element={<ContractForm />} />
                      <Route path="/contracte/:id" element={<ContractDetail />} />
                      <Route path="/contracte/:id/edit" element={<ContractForm />} />
                      <Route path="/contracte/:id/sign" element={<ContractSign />} />
                      <Route path="/contracte/template/:id" element={<ContractTemplateEditor />} />

                      {/* Vehicle Routes */}
                      <Route path="/vehicles" element={<VehicleList />} />
                      <Route path="/vehicles/new" element={<VehicleForm />} />
                      <Route path="/vehicles/:id" element={<VehicleDetail />} />
                      <Route path="/vehicles/:id/edit" element={<VehicleForm />} />

                      {/* Other Routes */}
                      <Route path="/schedules" element={<MaintenanceSchedules />} />
                      <Route path="/checklist-templates" element={<ChecklistTemplates />} />
                      <Route path="/procedure-templates" element={<ProcedureTemplates />} />
                      <Route path="/parts-inventory" element={<PartsInventory />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/registru-incasari" element={<RegistruIncasari />} />
                      <Route path="/retururi" element={<Retururi />} />
                      <Route path="/reclamatii" element={<Reclamatii />} />
                      <Route path="/comenzi" element={<Comenzi />} />
                      <Route path="/users" element={<UserManagement />} />
                      <Route path="/settings" element={<Settings />} />

                      {/* Kanban / To Do Routes */}
                      <Route path="/todo" element={<KanbanPage />} />
                      <Route path="/todo/:boardId" element={<KanbanBoard />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </LanguageProvider>
        </PermissionsProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
