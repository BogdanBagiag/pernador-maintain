import { useAuth } from '../contexts/AuthContext'
import ScanPage from './ScanPage'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'

export default function PublicScanWrapper() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // If authenticated, show with Layout (menu)
  if (user) {
    return (
      <Layout>
        <ScanPage />
      </Layout>
    )
  }

  // If not authenticated, show without Layout (public access)
  return <ScanPage />
}
