import { useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LocationDetail from './LocationDetail'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'

export default function PublicLocationWrapper() {
  const { id } = useParams()
  const { user, profile, loading } = useAuth()

  console.log('📍 PublicLocationWrapper:', { id, user: !!user, profile: !!profile, loading })

  // Wait for auth to finish loading (both user and profile)
  if (loading) {
    console.log('⏳ Auth loading...')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // If not authenticated, redirect to public report form
  if (!user) {
    console.log('👤 No user, redirecting to /report-issue?location=' + id)
    return <Navigate to={`/report-issue?location=${id}`} replace />
  }

  // If authenticated but profile not loaded yet, show loading
  if (!profile) {
    console.log('⏳ User exists but profile loading...')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // If authenticated with profile loaded, show normal location details page WITH Layout
  console.log('✅ Showing LocationDetail')
  return (
    <Layout>
      <LocationDetail />
    </Layout>
  )
}
