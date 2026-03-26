import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Globe, Lock, User, Check, AlertCircle, Bell, Clock, Save } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import PushNotificationToggle from '../components/PushNotificationToggle'

export default function Settings() {
  const { language, setLanguage, t } = useLanguage()
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
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
  const [reminderSuccess, setReminderSuccess] = useState(false)

  // Fetch reminder settings
  const { data: reminderSettings, isLoading: loadingReminders } = useQuery({
    queryKey: ['reminder-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminder_settings')
        .select('*')
        .order('priority')
      if (error) throw error
      return data
    },
    enabled: profile?.role === 'admin' // Doar admins pot vedea
  })

  // Local state pentru editing
  const [editedSettings, setEditedSettings] = useState({})

  // Update local state când se încarcă datele
  useState(() => {
    if (reminderSettings) {
      const settings = {}
      reminderSettings.forEach(s => {
        settings[s.priority] = {
          first_reminder_hours: s.first_reminder_hours,
          escalate_manager_hours: s.escalate_manager_hours,
          escalate_admin_hours: s.escalate_admin_hours
        }
      })
      setEditedSettings(settings)
    }
  }, [reminderSettings])

  // Mutation pentru salvare reminder settings
  const saveRemindersMutation = useMutation({
    mutationFn: async (settings) => {
      const updates = Object.entries(settings).map(([priority, values]) => 
        supabase
          .from('reminder_settings')
          .update({
            first_reminder_hours: parseFloat(values.first_reminder_hours),
            escalate_manager_hours: parseFloat(values.escalate_manager_hours),
            escalate_admin_hours: values.escalate_admin_hours ? parseFloat(values.escalate_admin_hours) : null
          })
          .eq('priority', priority)
      )
      
      await Promise.all(updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-settings'] })
      setReminderSuccess(true)
      setTimeout(() => setReminderSuccess(false), 3000)
    }
  })

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

  const handleReminderChange = (priority, field, value) => {
    setEditedSettings(prev => ({
      ...prev,
      [priority]: {
        ...prev[priority],
        [field]: value
      }
    }))
  }

  const handleSaveReminders = (e) => {
    e.preventDefault()
    saveRemindersMutation.mutate(editedSettings)
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
            
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                💡 <strong>Info:</strong> Notificările funcționează pe desktop și mobil. 
                Trebuie să permiți notificările în browser-ul tău.
              </p>
            </div>
          </div>
        </div>

        {/* Reminder Settings - Only for Admins */}
        {profile?.role === 'admin' && (
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Clock className="w-6 h-6 mr-2" />
              Intervale Reminder-uri Work Orders
            </h2>

            {reminderSuccess && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
                <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-600">Setări salvate cu succes!</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>ℹ️ Info:</strong> Setează când se trimit reminder-urile automate pentru work orders nerezonvate.
                Valorile sunt în ore de la crearea work order-ului.
              </p>
            </div>

            {loadingReminders ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <form onSubmit={handleSaveReminders} className="space-y-6">
                {/* Critical Priority */}
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-center mb-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 mr-2" />
                    <h3 className="font-semibold text-red-900">CRITICAL (Critic)</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Prima Notificare (ore)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={editedSettings.critical?.first_reminder_hours || 1}
                        onChange={(e) => handleReminderChange('critical', 'first_reminder_hours', e.target.value)}
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Escalare Manager (ore)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        value={editedSettings.critical?.escalate_manager_hours || 2}
                        onChange={(e) => handleReminderChange('critical', 'escalate_manager_hours', e.target.value)}
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Escalare Admin (ore)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        value={editedSettings.critical?.escalate_admin_hours || 4}
                        onChange={(e) => handleReminderChange('critical', 'escalate_admin_hours', e.target.value)}
                        className="input text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* High Priority */}
                <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                  <div className="flex items-center mb-3">
                    <div className="w-3 h-3 rounded-full bg-orange-500 mr-2" />
                    <h3 className="font-semibold text-orange-900">HIGH (Ridicat)</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Prima Notificare (ore)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={editedSettings.high?.first_reminder_hours || 4}
                        onChange={(e) => handleReminderChange('high', 'first_reminder_hours', e.target.value)}
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Escalare Manager (ore)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="2"
                        value={editedSettings.high?.escalate_manager_hours || 8}
                        onChange={(e) => handleReminderChange('high', 'escalate_manager_hours', e.target.value)}
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Escalare Admin (ore)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="4"
                        value={editedSettings.high?.escalate_admin_hours || 24}
                        onChange={(e) => handleReminderChange('high', 'escalate_admin_hours', e.target.value)}
                        className="input text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Medium Priority */}
                <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                  <div className="flex items-center mb-3">
                    <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
                    <h3 className="font-semibold text-yellow-900">MEDIUM (Mediu)</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Prima Notificare (ore)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={editedSettings.medium?.first_reminder_hours || 24}
                        onChange={(e) => handleReminderChange('medium', 'first_reminder_hours', e.target.value)}
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Escalare Manager (ore)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="12"
                        value={editedSettings.medium?.escalate_manager_hours || 48}
                        onChange={(e) => handleReminderChange('medium', 'escalate_manager_hours', e.target.value)}
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Escalare Admin (ore)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="24"
                        value={editedSettings.medium?.escalate_admin_hours || 72}
                        onChange={(e) => handleReminderChange('medium', 'escalate_admin_hours', e.target.value)}
                        className="input text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Low Priority */}
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                  <div className="flex items-center mb-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
                    <h3 className="font-semibold text-blue-900">LOW (Scăzut)</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Prima Notificare (ore)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={editedSettings.low?.first_reminder_hours || 48}
                        onChange={(e) => handleReminderChange('low', 'first_reminder_hours', e.target.value)}
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Escalare Manager (ore)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="24"
                        value={editedSettings.low?.escalate_manager_hours || 96}
                        onChange={(e) => handleReminderChange('low', 'escalate_manager_hours', e.target.value)}
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Escalare Admin (ore)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={editedSettings.low?.escalate_admin_hours || ''}
                        onChange={(e) => handleReminderChange('low', 'escalate_admin_hours', e.target.value)}
                        className="input text-sm"
                        placeholder="Opțional"
                      />
                      <p className="text-xs text-gray-500 mt-1">Lasă gol pentru a dezactiva</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <button
                    type="submit"
                    disabled={saveRemindersMutation.isLoading}
                    className="btn-primary inline-flex items-center"
                  >
                    {saveRemindersMutation.isLoading ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span className="ml-2">Se salvează...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5 mr-2" />
                        Salvează Setări
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

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
