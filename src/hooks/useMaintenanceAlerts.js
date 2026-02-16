import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Hook pentru alerte work orders și maintenance schedules
 */
export function useMaintenanceAlerts() {
  const { data, isLoading } = useQuery({
    queryKey: ['maintenance-alerts-count'],
    queryFn: async () => {
      // Count pending/in-progress work orders
      const { count: workOrdersCount, error: woError } = await supabase
        .from('work_orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'in_progress'])

      if (woError) throw woError

      // Count overdue schedules (next_due_date < today)
      const today = new Date().toISOString().split('T')[0]
      
      const { count: schedulesCount, error: schedError } = await supabase
        .from('maintenance_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .lt('next_due_date', today)

      if (schedError) throw schedError

      return {
        total: (workOrdersCount || 0) + (schedulesCount || 0),
        workOrders: workOrdersCount || 0,
        schedules: schedulesCount || 0
      }
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  })

  return {
    totalAlerts: data?.total || 0,
    workOrdersAlerts: data?.workOrders || 0,
    schedulesAlerts: data?.schedules || 0,
    isLoading
  }
}
