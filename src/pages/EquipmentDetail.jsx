import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Edit, MapPin, Calendar, Hash, Building, Trash2, Package } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import QRCodeGenerator from '../components/QRCodeGenerator'

export default function EquipmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  // Check permissions
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'
  const canDelete = profile?.role === 'admin'

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] })
      navigate('/equipment')
    },
  })

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this equipment? This action cannot be undone.')) {
      deleteMutation.mutate()
    }
  }

  // Fetch equipment with location
  const { data: equipment, isLoading } = useQuery({
    queryKey: ['equipment', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select(`
          *,
          location:locations(id, name, building, floor, room, address)
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
  })

  // Fetch work orders for this equipment
  const { data: workOrders } = useQuery({
    queryKey: ['equipment-work-orders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('equipment_id', id)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) throw error
      return data
    },
  })

  // Fetch compatible parts from inventory
  const { data: compatibleParts } = useQuery({
    queryKey: ['equipment-compatible-parts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_parts')
        .select('*')
        .eq('is_active', true)
      
      if (error) throw error
      
      // Filter parts that have this equipment in compatible_equipment array
      return data?.filter(part => 
        part.compatible_equipment && 
        part.compatible_equipment.includes(id)
      ) || []
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!equipment) {
    return (
      <div className="card text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Equipment not found
        </h3>
        <button onClick={() => navigate('/equipment')} className="btn-primary">
          Back to Equipment
        </button>
      </div>
    )
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'operational':
        return 'badge-success'
      case 'maintenance':
        return 'badge-warning'
      case 'broken':
        return 'badge-danger'
      case 'retired':
        return 'badge-info'
      default:
        return 'badge-info'
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/equipment')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Equipment
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{equipment.name}</h1>
            <div className="flex items-center mt-2">
              <span className={`badge ${getStatusColor(equipment.status)} capitalize`}>
                {equipment.status}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            {canEdit && (
              <Link
                to={`/equipment/${id}/edit`}
                className="btn-primary inline-flex items-center"
              >
                <Edit className="w-5 h-5 mr-2" />
                Edit
              </Link>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isLoading}
                className="btn-secondary text-red-600 hover:bg-red-50 border-red-300 inline-flex items-center disabled:opacity-50"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Details</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {equipment.manufacturer && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Brand
                  </label>
                  <p className="text-gray-900">{equipment.manufacturer}</p>
                </div>
              )}

              {equipment.model && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Model
                  </label>
                  <p className="text-gray-900">{equipment.model}</p>
                </div>
              )}

              {equipment.serial_number && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <Hash className="w-4 h-4 inline mr-1" />
                    Serial Number
                  </label>
                  <p className="text-gray-900 font-mono">{equipment.serial_number}</p>
                </div>
              )}

              {equipment.purchase_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Purchase Date
                  </label>
                  <p className="text-gray-900">
                    {new Date(equipment.purchase_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {equipment.description && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Description
                </label>
                <p className="text-gray-900 whitespace-pre-wrap">{equipment.description}</p>
              </div>
            )}
          </div>

          {/* Location Card */}
          {equipment.location && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Location</h2>
              
              <div className="space-y-3">
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{equipment.location.name}</p>
                    {equipment.location.building && (
                      <p className="text-sm text-gray-600 flex items-center mt-1">
                        <Building className="w-4 h-4 mr-1" />
                        {equipment.location.building}
                      </p>
                    )}
                    {(equipment.location.floor || equipment.location.room) && (
                      <p className="text-sm text-gray-600 mt-1">
                        {equipment.location.floor && `Floor: ${equipment.location.floor}`}
                        {equipment.location.floor && equipment.location.room && ' â€¢ '}
                        {equipment.location.room && `Room: ${equipment.location.room}`}
                      </p>
                    )}
                    {equipment.location.address && (
                      <p className="text-sm text-gray-500 mt-2">
                        {equipment.location.address}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Work Orders */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Recent Work Orders</h2>
              <Link
                to={`/work-orders/new?equipment=${id}`}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Create Work Order
              </Link>
            </div>
            
            {!workOrders || workOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No work orders yet
              </p>
            ) : (
              <div className="space-y-3">
                {workOrders.map((wo) => (
                  <Link
                    key={wo.id}
                    to={`/work-orders/${wo.id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{wo.title}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(wo.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`badge badge-${
                        wo.status === 'completed' ? 'success' :
                        wo.status === 'in_progress' ? 'warning' :
                        'info'
                      } capitalize`}>
                        {wo.status.replace('_', ' ')}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Compatible Parts from Inventory */}
          {compatibleParts && compatibleParts.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Package className="w-5 h-5 mr-2 text-primary-600" />
                  Piese din Inventar
                </h2>
                <Link
                  to="/parts-inventory"
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  Vezi Inventar
                </Link>
              </div>
              
              <div className="space-y-3">
                {compatibleParts.map((part) => (
                  <div
                    key={part.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{part.name}</p>
                        {part.part_number && (
                          <p className="text-xs text-gray-500 font-mono mt-1">{part.part_number}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-sm text-gray-600">
                            Stoc: <span className={`font-semibold ${
                              part.quantity_in_stock <= part.min_quantity ? 'text-yellow-600' : 'text-gray-900'
                            }`}>
                              {part.quantity_in_stock} {part.unit_of_measure}
                            </span>
                          </span>
                          <span className="text-sm text-gray-600">
                            {part.unit_price.toFixed(2)} RON/{part.unit_of_measure}
                          </span>
                        </div>
                      </div>
                      {part.quantity_in_stock <= part.min_quantity && (
                        <span className="badge badge-warning text-xs">
                          Stoc Scăzut
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - QR Code */}
        <div className="lg:col-span-1">
          <QRCodeGenerator 
            equipmentId={equipment.id} 
            equipmentName={equipment.name}
          />
          
          <div className="card mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                to={`/work-orders/new?equipment=${id}`}
                className="btn-primary w-full"
              >
                Create Work Order
              </Link>
              <Link
                to={`/equipment/${id}/edit`}
                className="btn-secondary w-full"
              >
                Edit Equipment
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
