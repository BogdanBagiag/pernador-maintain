import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { X, Package, Edit, TrendingDown, Calendar, DollarSign, MapPin, User, Wrench } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'

export default function PartDetailModal({ part, onClose, onEdit }) {
  // Fetch usage history for this part
  const { data: usageHistory, isLoading } = useQuery({
    queryKey: ['part-usage-history', part.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_usage')
        .select(`
          *,
          work_order:work_orders(id, title, status),
          equipment:equipment(id, name),
          user:profiles!parts_usage_used_by_fkey(full_name)
        `)
        .eq('part_id', part.id)
        .order('used_at', { ascending: false })
        .limit(10)
      
      if (error) throw error
      return data
    },
  })

  // Fetch equipment names for compatibility
  const { data: compatibleEquipment } = useQuery({
    queryKey: ['compatible-equipment', part.id],
    queryFn: async () => {
      if (!part.compatible_equipment || part.compatible_equipment.length === 0) {
        return []
      }
      const { data, error } = await supabase
        .from('equipment')
        .select('id, name, model, serial_number')
        .in('id', part.compatible_equipment)
      
      if (error) throw error
      return data
    },
    enabled: part.compatible_equipment && part.compatible_equipment.length > 0
  })

  const getStockStatus = () => {
    if (part.quantity_in_stock === 0) {
      return { color: 'red', label: 'Epuizat', icon: TrendingDown }
    } else if (part.quantity_in_stock <= part.min_quantity) {
      return { color: 'yellow', label: 'Stoc scăzut', icon: TrendingDown }
    } else {
      return { color: 'green', label: 'În stoc', icon: Package }
    }
  }

  const status = getStockStatus()
  const StatusIcon = status.icon

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center flex-1 min-w-0">
            <Package className="w-6 h-6 text-primary-600 mr-3 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 truncate">{part.name}</h2>
              {part.part_number && (
                <p className="text-sm text-gray-500 font-mono">{part.part_number}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {onEdit && (
              <button
                onClick={() => onEdit(part)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Editează"
              >
                <Edit className="w-5 h-5 text-blue-600" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Details */}
            <div className="space-y-6">
              {/* Stock Status Card */}
              <div className={`p-4 rounded-lg bg-${status.color}-50 border border-${status.color}-200`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Status Stoc</p>
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`w-5 h-5 text-${status.color}-600`} />
                      <span className={`text-lg font-semibold text-${status.color}-900`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold text-${status.color}-900`}>
                      {part.quantity_in_stock}
                    </p>
                    <p className="text-sm text-gray-600">{part.unit_of_measure}</p>
                    {part.min_quantity > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Min: {part.min_quantity} {part.unit_of_measure}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Informații</h3>
                
                {part.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Descriere</label>
                    <p className="text-sm text-gray-900 mt-1">{part.description}</p>
                  </div>
                )}

                {part.category && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Categorie</label>
                    <p className="text-sm text-gray-900 mt-1 capitalize">{part.category}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Preț Unitar</label>
                    <p className="text-sm text-gray-900 mt-1 font-semibold">
                      {part.unit_price.toFixed(2)} RON
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Valoare Totală</label>
                    <p className="text-sm text-gray-900 mt-1 font-semibold">
                      {(part.quantity_in_stock * part.unit_price).toFixed(2)} RON
                    </p>
                  </div>
                </div>

                {part.storage_location && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      Locație Depozitare
                    </label>
                    <p className="text-sm text-gray-900 mt-1">{part.storage_location}</p>
                  </div>
                )}
              </div>

              {/* Supplier Info */}
              {(part.supplier || part.supplier_contact) && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">Furnizor</h3>
                  {part.supplier && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Nume</label>
                      <p className="text-sm text-gray-900 mt-1">{part.supplier}</p>
                    </div>
                  )}
                  {part.supplier_contact && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Contact</label>
                      <p className="text-sm text-gray-900 mt-1">{part.supplier_contact}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Compatible Equipment */}
              {compatibleEquipment && compatibleEquipment.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Wrench className="w-5 h-5 mr-2" />
                    Echipamente Compatibile
                  </h3>
                  <div className="space-y-2">
                    {compatibleEquipment.map(eq => (
                      <div
                        key={eq.id}
                        className="p-3 rounded-lg bg-blue-50 border border-blue-200"
                      >
                        <p className="font-medium text-gray-900">{eq.name}</p>
                        <div className="flex gap-3 mt-1 text-sm text-gray-600">
                          {eq.model && (
                            <span>Model: <span className="font-medium">{eq.model}</span></span>
                          )}
                          {eq.serial_number && (
                            <span>Serie: <span className="font-mono font-medium">{eq.serial_number}</span></span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {part.notes && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">Note</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{part.notes}</p>
                </div>
              )}
            </div>

            {/* Right Column - Usage History */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Istoric Utilizări
              </h3>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : usageHistory && usageHistory.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {usageHistory.map((usage) => (
                    <div
                      key={usage.id}
                      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          {usage.work_order && (
                            <p className="text-sm font-medium text-gray-900 truncate">
                              WO: {usage.work_order.title}
                            </p>
                          )}
                          {usage.equipment && (
                            <p className="text-xs text-gray-500">
                              {usage.equipment.name}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {usage.quantity_used} {part.unit_of_measure}
                          </p>
                          <p className="text-xs text-gray-600">
                            {usage.total_cost.toFixed(2)} RON
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-gray-500">
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
                      </div>

                      {usage.notes && (
                        <p className="text-xs text-gray-600 mt-2 italic">{usage.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Nicio utilizare înregistrată</p>
                </div>
              )}

              {/* Usage Statistics */}
              {usageHistory && usageHistory.length > 0 && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Total Utilizat</p>
                      <p className="text-lg font-bold text-gray-900">
                        {usageHistory.reduce((sum, u) => sum + u.quantity_used, 0)} {part.unit_of_measure}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Cost Total</p>
                      <p className="text-lg font-bold text-gray-900">
                        {usageHistory.reduce((sum, u) => sum + u.total_cost, 0).toFixed(2)} RON
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Închide
          </button>
          {onEdit && (
            <button
              onClick={() => onEdit(part)}
              className="btn-primary inline-flex items-center"
            >
              <Edit className="w-4 h-4 mr-2" />
              Editează Piesa
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
