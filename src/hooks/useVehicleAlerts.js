import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Hook pentru a obține numărul de alerte de expirare pentru mașini
 * Returnează numărul total de asigurări și roviniete care expiră în următoarele 30 zile
 */
export function useVehicleAlerts() {
  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-alerts-count'],
    queryFn: async () => {
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      const thirtyDaysISO = thirtyDaysFromNow.toISOString().split('T')[0]

      const today = new Date().toISOString().split('T')[0]

      // Count expiring insurance
      const { count: insuranceCount, error: insuranceError } = await supabase
        .from('vehicle_insurance')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('end_date', today)
        .lte('end_date', thirtyDaysISO)

      if (insuranceError) throw insuranceError

      // Count expiring vignettes
      const { count: vignetteCount, error: vignetteError } = await supabase
        .from('vehicle_vignettes')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('end_date', today)
        .lte('end_date', thirtyDaysISO)

      if (vignetteError) throw vignetteError

      return {
        total: (insuranceCount || 0) + (vignetteCount || 0),
        insurance: insuranceCount || 0,
        vignettes: vignetteCount || 0
      }
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  })

  return {
    alertCount: data?.total || 0,
    insuranceAlerts: data?.insurance || 0,
    vignetteAlerts: data?.vignettes || 0,
    isLoading
  }
}
