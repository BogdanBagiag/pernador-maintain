import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'

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
import ScanPage from './pages/ScanPage'
import ReportIssue from './pages/ReportIssue'

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
                      <Route path="/locations/:id" element={<LocationDetail />} />
                      <Route path="/locations/:id/edit" element={<LocationForm />} />
                      
                      {/* Scan Route */}
                      <Route path="/scan" element={<ScanPage />} />
                      
                      {/* Other Routes */}
                      <Route path="/schedules" element={<MaintenanceSchedules />} />
                      <Route path="/checklist-templates" element={<ChecklistTemplates />} />
                      <Route path="/procedure-templates" element={<ProcedureTemplates />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/users" element={<UserManagement />} />
                      <Route path="/settings" element={<Settings />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
