import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Globe, Lock, User, Check, AlertCircle, Bell } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import PushNotificationToggle from '../components/PushNotificationToggle'
import TestNotificationButton from '../components/TestNotificationButton'

export default function Settings() {
  const { language, setLanguage, t } = useLanguage()
  const { user, profile } = useAuth()
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameSuccess, setNameSuccess] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [loadingName, setLoadingName] = useState(false)

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess(false)

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setLoadingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (error) throw error

      setPasswordSuccess(true)
      setPasswordData({ newPassword: '', confirmPassword: '' })
      
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (error) {
      setPasswordError(error.message)
    } finally {
      setLoadingPassword(false)
    }
  }

  const handleNameChange = async (e) => {
    e.preventDefault()
    setNameError('')
    setNameSuccess(false)

    if (!fullName.trim()) {
      setNameError('Name cannot be empty')
      return
    }

    setLoadingName(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id)

      if (error) throw error

      setNameSuccess(true)
      setTimeout(() => setNameSuccess(false), 3000)
      
      // Refresh page to update name in sidebar
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      setNameError(error.message)
    } finally {
      setLoadingName(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('settings.title')}</h1>
      
      <div className="space-y-6 max-w-2xl">
        {/* Language Settings */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <Globe className="w-6 h-6 mr-2" />
            {t('settings.language')}
          </h2>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">{t('settings.selectLanguage')}</p>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setLanguage('en')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  language === 'en'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-center">
                  <span className="text-2xl mr-3">🇬🇧</span>
                  <div className="text-left">
                    <p className={`font-semibold ${language === 'en' ? 'text-blue-900' : 'text-gray-900'}`}>
                      {t('settings.english')}
                    </p>
                    <p className="text-sm text-gray-600">English</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setLanguage('ro')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  language === 'ro'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-center">
                  <span className="text-2xl mr-3">🇷🇴</span>
                  <div className="text-left">
                    <p className={`font-semibold ${language === 'ro' ? 'text-blue-900' : 'text-gray-900'}`}>
                      {t('settings.romanian')}
                    </p>
                    <p className="text-sm text-gray-600">Română</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <Bell className="w-6 h-6 mr-2" />
            Notificări Push
          </h2>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Primește notificări instant pentru work orders noi, statusuri actualizate și comentarii.
            </p>
            
            <PushNotificationToggle />
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Testează Notificările:</p>
              <TestNotificationButton />
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                💡 <strong>Info:</strong> Notificările funcționează pe desktop și mobil. 
                Trebuie să permiți notificările în browser-ul tău.
              </p>
            </div>
          </div>
        </div>

        {/* Full Name */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <User className="w-6 h-6 mr-2" />
            Full Name
          </h2>

          {nameSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
              <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-600">Name updated successfully! Page will reload...</p>
            </div>
          )}

          {nameError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{nameError}</p>
            </div>
          )}

          <form onSubmit={handleNameChange} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input"
                placeholder="Enter your full name"
              />
              <p className="text-xs text-gray-500 mt-1">This name will appear in the sidebar and throughout the app</p>
            </div>

            <button
              type="submit"
              disabled={loadingName}
              className="btn-primary inline-flex items-center"
            >
              {loadingName ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Saving...</span>
                </>
              ) : (
                <>
                  <User className="w-5 h-5 mr-2" />
                  Update Name
                </>
              )}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <Lock className="w-6 h-6 mr-2" />
            Change Password
          </h2>

          {passwordSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
              <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-600">Password changed successfully!</p>
            </div>
          )}

          {passwordError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{passwordError}</p>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={6}
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="input"
                placeholder="Enter new password (min 6 characters)"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="input"
                placeholder="Confirm new password"
              />
            </div>

            <button
              type="submit"
              disabled={loadingPassword}
              className="btn-primary inline-flex items-center"
            >
              {loadingPassword ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Changing...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5 mr-2" />
                  Change Password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
