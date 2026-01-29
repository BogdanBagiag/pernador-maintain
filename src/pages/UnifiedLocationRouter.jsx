import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LocationDetail from './LocationDetail'
import LocationForm from './LocationForm'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'

export default function UnifiedLocationRouter() {
  const { id, action } = useParams() // action will be "edit" or undefined
  const { user, profile, loading } = useAuth()

  console.log('🔀 UnifiedLocationRouter:', { id, action, user: !!user, profile: !!profile, loading })

  // Wait for auth to finish loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // CASE 1: /locations/new - Adding new location (PROTECTED)
  if (id === 'new') {
    if (!user) {
      console.log('🔒 /locations/new requires auth, redirecting to login')
      return <Navigate to="/login" replace />
    }
    console.log('✅ Showing LocationForm (new)')
    return (
      <Layout>
        <LocationForm />
      </Layout>
    )
  }

  // CASE 2: /locations/:id/edit - Editing location (PROTECTED)
  if (action === 'edit') {
    if (!user) {
      console.log('🔒 /locations/:id/edit requires auth, redirecting to login')
      return <Navigate to="/login" replace />
    }
    console.log('✅ Showing LocationForm (edit)')
    return (
      <Layout>
        <LocationForm />
      </Layout>
    )
  }

  // CASE 3: /locations/:id - Viewing location details
  // For authenticated users: show LocationDetail
  // For non-authenticated users: redirect to report form
  
  if (!user) {
    console.log('👤 No user, redirecting to /report-issue?location=' + id)
    return <Navigate to={`/report-issue?location=${id}`} replace />
  }

  // Wait for profile to load
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  console.log('✅ Showing LocationDetail')
  return (
    <Layout>
      <LocationDetail />
    </Layout>
  )
}
