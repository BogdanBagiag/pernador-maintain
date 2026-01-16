import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { AlertTriangle, Clock, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function WorkOrderRemindersCard() {
  // Fetch unresolved work orders with reminder info
  const { data: stats } = useQuery({
    queryKey: ['work-order-reminder-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_order_reminder_stats')
        .select('*')
      
      if (error) throw error
      return data
    },
    refetchInterval: 60000, // Refresh every minute
  })

  // Calculate statistics
  const unresolvedCount = stats?.length || 0
  const withReminders = stats?.filter(s => s.reminder_count > 0).length || 0
  const escalatedToManager = stats?.filter(s => 
    s.last_reminder_level === 'escalation_manager' || 
    s.last_reminder_level === 'escalation_admin'
  ).length || 0
  const escalatedToAdmin = stats?.filter(s => 
    s.last_reminder_level === 'escalation_admin'
  ).length || 0
  const needsAttention = stats?.filter(s => {
    const age = Date.now() - new Date(s.created_at).getTime()
    const ageHours = age / (1000 * 60 * 60)
    
    if (s.priority === 'critical' && ageHours >= 1) return true
    if (s.priority === 'high' && ageHours >= 4) return true
    if (s.priority === 'medium' && ageHours >= 24) return true
    if (s.priority === 'low' && ageHours >= 48) return true
    return false
  }).length || 0

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-orange-600" />
          Control Reminder-uri Work Orders
        </h3>
        <Link 
          to="/work-orders?filter=unresolved" 
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Vezi toate →
        </Link>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Nerezonvate</p>
              <p className="text-2xl font-bold text-gray-900">{unresolvedCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700">Necesită Atenție</p>
              <p className="text-2xl font-bold text-orange-900">{needsAttention}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">Cu Reminder-uri</p>
              <p className="text-2xl font-bold text-blue-900">{withReminders}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700">Escaladate</p>
              <p className="text-2xl font-bold text-red-900">{escalatedToAdmin}</p>
            </div>
            <Users className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Priority Breakdown */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-3">Breakdown pe Prioritate:</p>
        <div className="space-y-2">
          {['critical', 'high', 'medium', 'low'].map(priority => {
            const count = stats?.filter(s => s.priority === priority).length || 0
            const label = {
              critical: 'Critic',
              high: 'Ridicat',
              medium: 'Mediu',
              low: 'Scăzut'
            }[priority]
            const color = {
              critical: 'bg-red-500',
              high: 'bg-orange-500',
              medium: 'bg-yellow-500',
              low: 'bg-blue-500'
            }[priority]

            if (count === 0) return null

            return (
              <div key={priority} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full ${color} mr-2`} />
                  <span className="text-gray-700">{label}</span>
                </div>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Info about reminder intervals */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>ℹ️ Sistem Automat:</strong> Reminder-urile se trimit automat în funcție de prioritate și timp rămas.
        </p>
      </div>
    </div>
  )
}
