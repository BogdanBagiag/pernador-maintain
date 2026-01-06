import { useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LocationDetail from './LocationDetail'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'

export default function PublicLocationWrapper() {
  const { id } = useParams()
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // If not authenticated, redirect to public report form
  if (!user) {
    return <Navigate to={`/report-issue?location=${id}`} replace />
  }

  // If authenticated, show normal location details page WITH Layout
  return (
    <Layout>
      <LocationDetail />
    </Layout>
  )
}
