import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  Trash2,
  Edit,
  Check,
  X,
  AlertCircle,
  Key,
  Eye
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import UserActivityModal from '../components/UserActivityModal'

export default function UserManagement() {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showDeletedUsers, setShowDeletedUsers] = useState(false)
  const [resetPasswordUser, setResetPasswordUser] = useState(null)
  const [viewingUser, setViewingUser] = useState(null)

  // Fetch active users
  const { data: users, isLoading } = useQuery({
    queryKey: ['users', showDeletedUsers],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', !showDeletedUsers)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: profile?.role === 'admin'
  })

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditingUser(null)
    },
  })

  // Delete user mutation - marks as inactive
  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      console.log('Attempting to delete user:', userId)
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', userId)
        .select()
      
      if (error) {
        console.error('Delete error:', error)
        throw error
      }
      
      console.log('Delete successful:', data)
      return data
    },
    onSuccess: () => {
      console.log('Delete mutation onSuccess triggered')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => {
      console.error('Delete mutation onError:', error)
      alert('Failed to delete user: ' + error.message)
    }
  })

  // Reactivate user mutation
  const reactivateMutation = useMutation({
    mutationFn: async (userId) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: true })
        .eq('id', userId)
        .select()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => {
      alert('Failed to reactivate user: ' + error.message)
    }
  })

  const handleRoleChange = (userId, newRole) => {
    updateRoleMutation.mutate({ userId, newRole })
  }

  const handleDeleteUser = (userData) => {
    if (userData.id === user.id) {
      alert('You cannot delete yourself!')
      return
    }
    if (window.confirm(`Are you sure you want to delete ${userData.full_name || userData.email}?\n\nThis will:\n- Remove user access\n- Keep their data for history\n- Can be restored later`)) {
      deleteUserMutation.mutate(userData.id)
    }
  }

  const handleReactivateUser = (userData) => {
    if (window.confirm(`Reactivate ${userData.full_name || userData.email}?\n\nThis will:\n- Restore user access\n- User can login again with existing password`)) {
      reactivateMutation.mutate(userData.id)
    }
  }

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'manager':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'technician':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getRoleIcon = (role) => {
    return <Shield className="w-4 h-4" />
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">You don't have permission to access user management.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage users and their roles</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="btn-primary mt-4 sm:mt-0 inline-flex items-center"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Invite User
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setShowDeletedUsers(false)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${!showDeletedUsers
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Active Users
                {users && !showDeletedUsers && (
                  <span className="ml-2 bg-primary-100 text-primary-600 py-0.5 px-2.5 rounded-full text-xs font-medium">
                    {users.length}
                  </span>
                )}
              </div>
            </button>
            
            <button
              onClick={() => setShowDeletedUsers(true)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${showDeletedUsers
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center">
                <Trash2 className="w-5 h-5 mr-2" />
                Deleted Users
                {users && showDeletedUsers && (
                  <span className="ml-2 bg-red-100 text-red-600 py-0.5 px-2.5 rounded-full text-xs font-medium">
                    {users.length}
                  </span>
                )}
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Stats - only show for active users */}
      {!showDeletedUsers && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card bg-purple-50 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Admins</p>
                <p className="text-2xl font-bold text-purple-900">
                  {users?.filter(u => u.role === 'admin').length || 0}
                </p>
              </div>
              <Shield className="w-10 h-10 text-purple-600 opacity-50" />
            </div>
          </div>

          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Managers</p>
                <p className="text-2xl font-bold text-blue-900">
                  {users?.filter(u => u.role === 'manager').length || 0}
                </p>
              </div>
              <Users className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </div>

          <div className="card bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Technicians</p>
                <p className="text-2xl font-bold text-green-900">
                  {users?.filter(u => u.role === 'technician').length || 0}
                </p>
              </div>
              <Users className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users?.map((userData) => (
                <tr key={userData.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 font-semibold">
                          {(userData.full_name || userData.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {userData.full_name || 'No name'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {userData.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingUser === userData.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={userData.role}
                          onChange={(e) => handleRoleChange(userData.id, e.target.value)}
                          className="input py-1 px-2 text-sm"
                          disabled={userData.id === user.id}
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="technician">Technician</option>
                        </select>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full border ${getRoleBadge(userData.role)}`}>
                        {getRoleIcon(userData.role)}
                        <span className="capitalize">{userData.role}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(userData.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {showDeletedUsers ? (
                      // Deleted users - show Reactivate button
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleReactivateUser(userData)}
                          disabled={reactivateMutation.isLoading}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                          title="Reactivate user"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Reactivate
                        </button>
                      </div>
                    ) : (
                      // Active users - show View Activity, Edit, Reset Password and Delete
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingUser(userData)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="View user activity"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingUser(userData.id)}
                          disabled={userData.id === user.id}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Edit role"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setResetPasswordUser(userData)}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Reset password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(userData)}
                          disabled={userData.id === user.id || deleteUserMutation.isLoading}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteUserModal onClose={() => setShowInviteModal(false)} />
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <ResetPasswordModal 
          user={resetPasswordUser} 
          onClose={() => setResetPasswordUser(null)} 
        />
      )}

      {/* User Activity Modal */}
      {viewingUser && (
        <UserActivityModal
          userData={viewingUser}
          onClose={() => setViewingUser(null)}
        />
      )}
    </div>
  )
}

function ResetPasswordModal({ user, onClose }) {
  const queryClient = useQueryClient()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewPassword(password)
    setConfirmPassword(password)
    setGeneratedPassword(password)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      // Admin password reset is not available without Service Role Key
      // Show instructions instead
      throw new Error('Password reset must be done through Supabase Dashboard')
    } catch (error) {
      setError('Admin password reset requires Service Role Key configuration.\n\nPlease use Supabase Dashboard:\n1. Go to Authentication → Users\n2. Find user: ' + (user.full_name || user.email) + '\n3. Click "Reset Password"\n4. User will receive reset email')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h3>
              <p className="text-gray-600">New password for {user.full_name || user.email}:</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">New Password:</p>
              <div className="flex items-center gap-2">
                <p className="text-gray-900 font-mono text-sm flex-1 break-all">{generatedPassword}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedPassword)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  title="Copy password"
                >
                  <Mail className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                ⚠️ Share this password securely with the user
              </p>
            </div>

            <button onClick={onClose} className="btn-primary w-full">
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Reset Password</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>User:</strong> {user.full_name || user.email}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-600">
                <p className="font-medium mb-1">{error}</p>
                {error.includes('Service Role') && (
                  <p className="text-xs mt-2">
                    Alternative: Go to Supabase Dashboard → Authentication → Users → 
                    Click user → Reset Password
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New Password <span className="text-red-500">*</span>
              </label>
              <input
                id="newPassword"
                type="text"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                placeholder="Enter new password (min 6 characters)"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                id="confirmPassword"
                type="text"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                placeholder="Confirm new password"
              />
            </div>

            <button
              type="button"
              onClick={generatePassword}
              className="w-full btn-secondary inline-flex items-center justify-center"
            >
              <Key className="w-5 h-5 mr-2" />
              Generate Random Password
            </button>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary inline-flex items-center" disabled={loading}>
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Resetting...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-5 h-5 mr-2" />
                    Reset Password
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function InviteUserModal({ onClose }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'technician',
    password: ''
  })
  const [error, setError] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState('')

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  const inviteMutation = useMutation({
    mutationFn: async (data) => {
      // Use signup instead of admin API
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            invited_by: user.id,
            role: data.role,
            full_name: data.full_name
          }
        }
      })

      if (authError) throw authError

      return { authData, password: data.password }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setGeneratedPassword(result.password)
    },
    onError: (error) => {
      setError(error.message)
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    
    if (!formData.email) {
      setError('Email is required')
      return
    }

    const password = generatePassword()
    inviteMutation.mutate({ ...formData, password })
  }

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(generatedPassword)
  }

  if (generatedPassword) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">User Created!</h3>
              <p className="text-gray-600">Share these credentials with the new user:</p>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Email:</p>
                <p className="text-gray-900 font-mono text-sm break-all">{formData.email}</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Temporary Password:</p>
                <div className="flex items-center gap-2">
                  <p className="text-gray-900 font-mono text-sm flex-1 break-all">{generatedPassword}</p>
                  <button
                    onClick={handleCopyPassword}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    title="Copy password"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-yellow-700 mt-2">
                  ⚠️ Save this password - it won't be shown again!
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  The user should change their password after first login in Settings.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
              <button onClick={onClose} className="btn-primary">
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Invite User</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="full_name"
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="input"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="input"
              >
                <option value="technician">Technician</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                <strong>Technician:</strong> Can view and complete work orders/schedules<br/>
                <strong>Manager:</strong> Can create/edit equipment, schedules, templates<br/>
                <strong>Admin:</strong> Full access including user management
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                A temporary password will be generated automatically. Share it with the new user.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary inline-flex items-center" disabled={inviteMutation.isLoading}>
                {inviteMutation.isLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Creating...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Create User
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
