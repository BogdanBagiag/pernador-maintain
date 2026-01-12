import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Package, Calendar, User, DollarSign } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'

export default function WorkOrderParts({ workOrderId }) {
  // Fetch parts used in this work order
  const { data: partsUsed, isLoading } = useQuery({
    queryKey: ['work-order-parts', workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_usage')
        .select(`
          *,
          part:inventory_parts(name, part_number, unit_of_measure),
          user:profiles!parts_usage_used_by_fkey(full_name)
        `)
        .eq('work_order_id', workOrderId)
        .order('used_at', { ascending: false })
      
      if (error) throw error
      return data
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (!partsUsed || partsUsed.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>Nu au fost folosite piese din inventar</p>
      </div>
    )
  }

  const totalCost = partsUsed.reduce((sum, usage) => sum + usage.total_cost, 0)

  return (
    <div className="space-y-4">
      {/* Parts List */}
      <div className="grid gap-3">
        {partsUsed.map((usage) => (
          <div
            key={usage.id}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400" />
                  <h4 className="font-medium text-gray-900">{usage.part.name}</h4>
                </div>
                {usage.part.part_number && (
                  <p className="text-xs text-gray-500 font-mono ml-6">{usage.part.part_number}</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">
                  {usage.quantity_used} {usage.part.unit_of_measure}
                </p>
                <p className="text-sm text-gray-600">
                  {usage.unit_cost?.toFixed(2)} RON/{usage.part.unit_of_measure}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 ml-6">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{new Date(usage.used_at).toLocaleDateString('ro-RO')}</span>
              </div>
              {usage.user && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{usage.user.full_name}</span>
                </div>
              )}
              <div className="flex items-center gap-1 ml-auto">
                <DollarSign className="w-3 h-3" />
                <span className="font-semibold text-gray-900">
                  {usage.total_cost.toFixed(2)} RON
                </span>
              </div>
            </div>

            {usage.notes && (
              <div className="mt-2 ml-6 text-sm text-gray-600 italic">
                {usage.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">Cost Total Piese:</span>
          <span className="text-lg font-bold text-primary-600">
            {totalCost.toFixed(2)} RON
          </span>
        </div>
      </div>
    </div>
  )
}
