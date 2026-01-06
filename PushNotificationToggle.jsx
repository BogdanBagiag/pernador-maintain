import { useState, useEffect } from 'react'
import { Bell, BellOff, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function PushNotificationToggle() {
  const { user } = useAuth()
  const [permission, setPermission] = useState('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // VAPID Public Key - generate with: npx web-push generate-vapid-keys
  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
      checkSubscription()
    }
  }, [user])

  const checkSubscription = async () => {
    if (!user) return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (err) {
      console.error('Check subscription error:', err)
    }
  }

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  const subscribeToPush = async () => {
    if (!user || !VAPID_PUBLIC_KEY) {
      setError('VAPID key lipsește!')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      console.log('🔔 Starting subscription...')
      
      // Check if service worker is supported
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker nu este suportat')
      }
      
      if (!('PushManager' in window)) {
        throw new Error('Push notifications nu sunt suportate')
      }
      
      // Request permission
      console.log('📱 Requesting permission...')
      const result = await Notification.requestPermission()
      setPermission(result)
      console.log('✅ Permission:', result)

      if (result !== 'granted') {
        setError('Permisiune refuzată. Verifică setările browser-ului.')
        setLoading(false)
        return
      }

      // Get service worker registration
      console.log('🔧 Getting service worker...')
      const registration = await navigator.serviceWorker.ready
      console.log('✅ Service worker ready')

      // Subscribe to push
      console.log('📤 Subscribing to push...')
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
      console.log('✅ Subscribed!')

      // Save subscription to database
      console.log('💾 Saving to database...')
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert([{
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
          auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))),
          device_info: {
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        }], {
          onConflict: 'endpoint'
        })

      if (error) throw error

      setIsSubscribed(true)
      setError('✅ Notificări activate!')
      console.log('✅ All done!')
    } catch (err) {
      console.error('❌ Subscribe error:', err)
      setError(`Eroare: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const unsubscribeFromPush = async () => {
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint)
      }

      setIsSubscribed(false)
      alert('Notificări dezactivate.')
    } catch (err) {
      console.error('Unsubscribe error:', err)
      alert('Eroare la dezactivarea notificărilor')
    } finally {
      setLoading(false)
    }
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return null
  }

  return (
    <div className="flex items-center gap-3">
      {isSubscribed ? (
        <button
          onClick={unsubscribeFromPush}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          <BellOff className="w-4 h-4" />
          Dezactivează Notificări
        </button>
      ) : (
        <button
          onClick={subscribeToPush}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Bell className="w-4 h-4" />
          {loading ? 'Se încarcă...' : (permission === 'granted' ? 'Activează' : 'Permite')} Notificări
        </button>
      )}
      
      {isSubscribed && !error && (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <Check className="w-4 h-4" />
          Activ
        </span>
      )}
      
      {error && (
        <div className={`text-sm ${error.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
          {error}
        </div>
      )}
    </div>
  )
}
