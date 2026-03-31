import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Wrench, Lock, AlertCircle, Check } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validSession, setValidSession] = useState(null) // null = checking, true/false

  useEffect(() => {
    // Supabase pune access_token + type=recovery în URL hash
    // SDK-ul îl preia automat la getSession()
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setValidSession(true)
      } else {
        // Poate fi în hash-ul URL-ului, așteptăm event-ul de la SDK
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY') {
            setValidSession(true)
          } else if (event === 'SIGNED_IN' && session) {
            setValidSession(true)
          }
        })
        // Dacă nu primim nimic în 3 secunde, sesiunea e invalidă
        const timeout = setTimeout(() => {
          setValidSession(false)
        }, 3000)
        return () => {
          subscription.unsubscribe()
          clearTimeout(timeout)
        }
      }
    }
    checkSession()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Parola trebuie să aibă cel puțin 6 caractere')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Parolele nu coincid')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Verificare sesiune în curs
  if (validSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <LoadingSpinner />
      </div>
    )
  }

  // Link invalid sau expirat
  if (validSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Link invalid sau expirat</h3>
          <p className="text-gray-600 mb-6">
            Acest link de resetare parolă nu mai este valid. Solicită un nou link de resetare.
          </p>
          <button onClick={() => navigate('/login')} className="btn-primary w-full">
            Înapoi la Login
          </button>
        </div>
      </div>
    )
  }

  // Succes
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Parolă schimbată!</h3>
          <p className="text-gray-600">
            Parola ta a fost actualizată cu succes. Vei fi redirecționat la login...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4">
            <Wrench className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Setează Parola Nouă</h2>
          <p className="mt-2 text-gray-600">Introdu noua ta parolă mai jos</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                Parolă nouă
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="Minimum 6 caractere"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmă parola
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="Repetă parola"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" /> Se salvează...
                </span>
              ) : (
                'Salvează parola nouă'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
