import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { 
  Package, 
  Plus, 
  Search, 
  Filter,
  AlertTriangle,
  Edit,
  Trash2,
  TrendingDown,
  TrendingUp,
  Archive,
  ExternalLink
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import PartFormModal from '../components/PartFormModal'
import PartDetailModal from '../components/PartDetailModal'

export default function PartsInventory() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all') // all, low, out
  const [showPartModal, setShowPartModal] = useState(false)
  const [editingPart, setEditingPart] = useState(null)
  const [selectedPart, setSelectedPart] = useState(null)

  const canManage = profile?.role === 'admin' || profile?.role === 'manager'

  // Fetch parts
  const { data: parts, isLoading } = useQuery({
    queryKey: ['inventory-parts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_parts')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })

  // Delete mutation (using RPC function to bypass RLS)
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .rpc('soft_delete_inventory_part', { part_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory-parts'])
    },
  })

  // Get unique categories
  const categories = parts
    ? [...new Set(parts.map(p => p.category).filter(Boolean))]
    : []

  // Filter parts
  const filteredParts = parts?.filter(part => {
    const matchesSearch = part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         part.part_number?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = categoryFilter === 'all' || part.category === categoryFilter
    
    let matchesStock = true
    if (stockFilter === 'low') {
      matchesStock = part.quantity_in_stock <= part.min_quantity && part.quantity_in_stock > 0
    } else if (stockFilter === 'out') {
      matchesStock = part.quantity_in_stock === 0
    }
    
    return matchesSearch && matchesCategory && matchesStock
  })

  // Calculate stats
  const stats = {
    total: parts?.length || 0,
    lowStock: parts?.filter(p => p.quantity_in_stock <= p.min_quantity && p.quantity_in_stock > 0).length || 0,
    outOfStock: parts?.filter(p => p.quantity_in_stock === 0).length || 0,
    totalValue: parts?.reduce((sum, p) => sum + (p.quantity_in_stock * p.unit_price), 0) || 0
  }

  const handleEdit = (part) => {
    setEditingPart(part)
    setShowPartModal(true)
  }

  const handleDelete = (id) => {
    if (confirm('Sigur vrei să ștergi această piesă din inventar?')) {
      deleteMutation.mutate(id)
    }
  }

  const getStockStatus = (part) => {
    if (part.quantity_in_stock === 0) {
      return { color: 'red', label: 'Epuizat', icon: AlertTriangle }
    } else if (part.quantity_in_stock <= part.min_quantity) {
      return { color: 'yellow', label: 'Stoc scăzut', icon: TrendingDown }
    } else {
      return { color: 'green', label: 'În stoc', icon: TrendingUp }
    }
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
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Inventar Piese</h1>
          <p className="text-gray-600">Gestionează piesele de rezervă și consumabilele</p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setEditingPart(null)
              setShowPartModal(true)
            }}
            className="btn-primary inline-flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Adaugă Piesă
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card hover:shadow-lg transition-shadow cursor-pointer"
             onClick={() => setStockFilter('all')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Piese</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </div>

        <div className="card hover:shadow-lg transition-shadow cursor-pointer"
             onClick={() => setStockFilter('low')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Stoc Scăzut</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.lowStock}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-yellow-500 opacity-50" />
          </div>
        </div>

        <div className="card hover:shadow-lg transition-shadow cursor-pointer"
             onClick={() => setStockFilter('out')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Epuizate</p>
              <p className="text-2xl font-bold text-red-700">{stats.outOfStock}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </div>

        <div className="card hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Valoare Totală</p>
              <p className="text-2xl font-bold text-green-700">
                {stats.totalValue.toFixed(2)} RON
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Caută după nume sau cod piesă..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="w-full lg:w-64">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input w-full"
            >
              <option value="all">Toate categoriile</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Filter */}
          <div className="w-full lg:w-48">
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="input w-full"
            >
              <option value="all">Toate stocurile</option>
              <option value="low">Stoc scăzut</option>
              <option value="out">Epuizate</option>
            </select>
          </div>
        </div>
      </div>

      {/* Parts List */}
      <div className="card">
        {filteredParts && filteredParts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">Nu s-au găsit piese</p>
            <p className="text-gray-400">Încearcă să ajustezi filtrele sau adaugă piese noi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Piesă
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cod
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Categorie
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stoc
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Preț Unitar
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Valoare
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredParts?.map((part) => {
                  const status = getStockStatus(part)
                  const StatusIcon = status.icon
                  
                  return (
                    <tr key={part.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedPart(part)}
                          className="text-left hover:text-primary-600"
                        >
                          <div className="font-medium text-gray-900">{part.name}</div>
                          {part.description && (
                            <div className="text-sm text-gray-500 line-clamp-1">
                              {part.description}
                            </div>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900 font-mono">
                          {part.part_number || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {part.category || 'Necategorizat'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <span className={`font-semibold ${
                            part.quantity_in_stock === 0 ? 'text-red-600' :
                            part.quantity_in_stock <= part.min_quantity ? 'text-yellow-600' :
                            'text-gray-900'
                          }`}>
                            {part.quantity_in_stock}
                          </span>
                          <span className="text-gray-500 ml-1">
                            {part.unit_of_measure}
                          </span>
                          {part.min_quantity > 0 && (
                            <div className="text-xs text-gray-400">
                              Min: {part.min_quantity}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          bg-${status.color}-100 text-${status.color}-800`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900">
                          {part.unit_price.toFixed(2)} RON
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {(part.quantity_in_stock * part.unit_price).toFixed(2)} RON
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedPart(part)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Vezi detalii"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-600" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => handleEdit(part)}
                                className="p-1 hover:bg-gray-100 rounded"
                                title="Editează"
                              >
                                <Edit className="w-4 h-4 text-blue-600" />
                              </button>
                              <button
                                onClick={() => handleDelete(part.id)}
                                className="p-1 hover:bg-gray-100 rounded"
                                title="Șterge"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showPartModal && (
        <PartFormModal
          part={editingPart}
          onClose={() => {
            setShowPartModal(false)
            setEditingPart(null)
          }}
        />
      )}

      {selectedPart && (
        <PartDetailModal
          part={selectedPart}
          onClose={() => setSelectedPart(null)}
          onEdit={canManage ? handleEdit : null}
        />
      )}
    </div>
  )
}
