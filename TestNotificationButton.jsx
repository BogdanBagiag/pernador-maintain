import { useState } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function TestNotificationButton() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const sendTestNotification = async () => {
    if (!user) return
    
    setLoading(true)
    setResult('')
    
    try {
      // Get session for authorization
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Nu ești autentificat')
      }

      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          title: '🔔 Test Notificare',
          body: 'Notificările funcționează perfect! 🎉',
          url: '/dashboard',
          tag: 'test-notification'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (error) throw error
      
      // Show local notification after edge function success
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        await registration.showNotification('🔔 Test Notificare', {
          body: 'Notificările funcționează perfect! 🎉',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: { url: '/dashboard' },
          requireInteraction: false
        })
      }
      
      setResult('✅ Notificare trimisă! Verifică telefonul/desktop.')
      setTimeout(() => setResult(''), 5000)
    } catch (err) {
      setResult('❌ Eroare: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={sendTestNotification}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
      >
        <Send className="w-4 h-4" />
        {loading ? 'Se trimite...' : 'Trimite Notificare Test'}
      </button>
      
      {result && (
        <p className={`text-sm ${result.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
          {result}
        </p>
      )}
    </div>
  )
}
