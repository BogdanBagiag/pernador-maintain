import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { X, Plus, Minus, Save, AlertTriangle, Package, Search } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'

export default function PartsUsageModal({ workOrderId, equipmentId, onClose, onSave }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedParts, setSelectedParts] = useState([]) // { partId, quantity, unitCost }
  const [error, setError] = useState('')

  // Fetch available parts (optionally filtered by equipment)
  const { data: parts, isLoading } = useQuery({
    queryKey: ['inventory-parts-available', equipmentId],
    queryFn: async () => {
      let query = supabase
        .from('inventory_parts')
        .select('*')
        .eq('is_active', true)
        .gt('quantity_in_stock', 0)

      const { data, error } = await query.order('name')
      
      if (error) throw error

      // Filter by compatible equipment if equipmentId provided
      if (equipmentId) {
        return data.filter(part => 
          part.compatible_equipment && 
          part.compatible_equipment.length > 0 &&
          part.compatible_equipment.includes(equipmentId)
        )
      }

      return data
    },
  })

  const handleAddPart = (part) => {
    const existing = selectedParts.find(p => p.partId === part.id)
    if (existing) {
      // Increase quantity by 1
      const currentQty = typeof existing.quantity === 'string' 
        ? parseFloat(existing.quantity.replace(',', '.')) || 0 
        : existing.quantity
      const newQty = Math.round((currentQty + 1) * 100) / 100
      
      setSelectedParts(prev =>
        prev.map(p =>
          p.partId === part.id
            ? { ...p, quantity: Math.min(newQty, part.quantity_in_stock) }
            : p
        )
      )
    } else {
      // Add new - always start with 1
      setSelectedParts(prev => [
        ...prev,
        {
          partId: part.id,
          partName: part.name,
          partNumber: part.part_number,
          maxStock: part.quantity_in_stock,
          unitOfMeasure: part.unit_of_measure,
          quantity: 1,
          unitCost: part.unit_price
        }
      ])
    }
  }

  const handleRemovePart = (partId) => {
    setSelectedParts(prev => prev.filter(p => p.partId !== partId))
  }

  const handleQuantityChange = (partId, value) => {
    const part = selectedParts.find(p => p.partId === partId)
    if (!part) return

    // Dacă e număr (de la butoane +/-), procesează direct
    if (typeof value === 'number') {
      const validQuantity = Math.round(Math.max(0.01, Math.min(value, part.maxStock)) * 100) / 100
      setSelectedParts(prev =>
        prev.map(p =>
          p.partId === partId ? { ...p, quantity: validQuantity } : p
        )
      )
      return
    }

    // Dacă e string (de la input), permite tastare liberă
    let processedValue = value.replace(',', '.')
    
    // Permite string-uri incomplete în timpul tastării: "1", "1.", "1.5"
    // Validare: doar cifre și maxim un punct
    if (processedValue === '' || processedValue === '.' || processedValue === '0.') {
      // Permite aceste stări temporare
      setSelectedParts(prev =>
        prev.map(p =>
          p.partId === partId ? { ...p, quantity: processedValue } : p
        )
      )
      return
    }
    
    if (!/^\d*\.?\d*$/.test(processedValue)) {
      return // Nu permite caractere invalide
    }

    // Salvează valoarea ca string în timpul tastării
    setSelectedParts(prev =>
      prev.map(p =>
        p.partId === partId ? { ...p, quantity: processedValue } : p
      )
    )
  }

  // Funcție pentru validare finală (la blur sau submit)
  const validateAndFixQuantity = (partId) => {
    const part = selectedParts.find(p => p.partId === partId)
    if (!part) return

    let numericValue = parseFloat(String(part.quantity).replace(',', '.')) || 0.01
    const validQuantity = Math.round(Math.max(0.01, Math.min(numericValue, part.maxStock)) * 100) / 100
    
    setSelectedParts(prev =>
      prev.map(p =>
        p.partId === partId ? { ...p, quantity: validQuantity } : p
      )
    )
  }

  // Handle submit - just return selected parts, don't save to DB yet
  const handleSubmit = () => {
    setError('')

    if (selectedParts.length === 0) {
      setError('Selectează cel puțin o piesă')
      return
    }

    // Validate and normalize quantities
    const normalizedParts = selectedParts.map(part => {
      const qty = typeof part.quantity === 'string' 
        ? parseFloat(part.quantity.replace(',', '.')) || 0 
        : part.quantity
      
      if (qty <= 0) {
        setError(`Cantitate invalidă pentru ${part.partName}`)
        return null
      }
      
      if (qty > part.maxStock) {
        setError(`Stoc insuficient pentru ${part.partName}. Disponibil: ${part.maxStock}`)
        return null
      }

      return {
        ...part,
        quantity: Math.round(qty * 100) / 100 // Normalizează la 2 zecimale
      }
    })

    // Check if validation failed
    if (normalizedParts.includes(null)) {
      return
    }

    // Return normalized parts to parent
    if (onSave) onSave(normalizedParts)
    onClose()
  }

  const filteredParts = parts?.filter(part =>
    part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    part.part_number?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalCost = selectedParts.reduce((sum, p) => {
    const qty = typeof p.quantity === 'string' ? parseFloat(p.quantity.replace(',', '.')) || 0 : p.quantity
    return sum + (qty * p.unitCost)
  }, 0)

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Package className="w-6 h-6 text-primary-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">
              Adaugă Piese Folosite
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start">
              <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Available Parts */}
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Piese Disponibile
                </h3>
                {equipmentId && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                    Afișare doar piese compatibile cu acest echipament
                  </p>
                )}
              </div>

              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Caută piese..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input pl-10 w-full"
                  />
                </div>
              </div>

              {/* Parts List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredParts && filteredParts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="font-medium">Nu s-au găsit piese compatibile</p>
                    {equipmentId && (
                      <p className="text-xs mt-2 text-gray-400">
                        Nicio piesă nu este marcată ca fiind compatibilă cu acest echipament
                      </p>
                    )}
                  </div>
                ) : (
                  filteredParts?.map(part => (
                    <div
                      key={part.id}
                      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleAddPart(part)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{part.name}</p>
                          {part.part_number && (
                            <p className="text-xs text-gray-500 font-mono">{part.part_number}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1">
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAddPart(part)
                          }}
                          className="p-1.5 hover:bg-primary-100 rounded text-primary-600"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Selected Parts */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Piese Selectate ({selectedParts.length})
              </h3>

              {selectedParts.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Selectează piese din lista din stânga</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                    {selectedParts.map(part => (
                      <div
                        key={part.partId}
                        className="border border-gray-200 rounded-lg p-3 bg-primary-50"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{part.partName}</p>
                            {part.partNumber && (
                              <p className="text-xs text-gray-500 font-mono">{part.partNumber}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemovePart(part.partId)}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const currentQty = typeof part.quantity === 'string' 
                                ? parseFloat(part.quantity.replace(',', '.')) || 0 
                                : part.quantity
                              handleQuantityChange(part.partId, currentQty - 1)
                            }}
                            className="p-1 hover:bg-gray-200 rounded"
                            disabled={(() => {
                              const qty = typeof part.quantity === 'string' ? parseFloat(part.quantity.replace(',', '.')) || 0 : part.quantity
                              return qty <= 0.01
                            })()}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          
                          <input
                            type="text"
                            inputMode="decimal"
                            value={part.quantity}
                            onChange={(e) => handleQuantityChange(part.partId, e.target.value)}
                            onBlur={() => validateAndFixQuantity(part.partId)}
                            className="input w-20 text-center p-1"
                            placeholder="1"
                          />
                          
                          <button
                            onClick={() => {
                              const currentQty = typeof part.quantity === 'string' 
                                ? parseFloat(part.quantity.replace(',', '.')) || 0 
                                : part.quantity
                              handleQuantityChange(part.partId, currentQty + 1)
                            }}
                            className="p-1 hover:bg-gray-200 rounded"
                            disabled={(() => {
                              const qty = typeof part.quantity === 'string' ? parseFloat(part.quantity.replace(',', '.')) || 0 : part.quantity
                              return qty >= part.maxStock
                            })()}
                          >
                            <Plus className="w-4 h-4" />
                          </button>

                          <span className="text-sm text-gray-600 ml-2">
                            {part.unitOfMeasure}
                          </span>

                          <span className="text-sm font-semibold text-gray-900 ml-auto">
                            {(() => {
                              const qty = typeof part.quantity === 'string' ? parseFloat(part.quantity.replace(',', '.')) || 0 : part.quantity
                              return (qty * part.unitCost).toFixed(2)
                            })()} RON
                          </span>
                        </div>

                        {(() => {
                          const qty = typeof part.quantity === 'string' ? parseFloat(part.quantity.replace(',', '.')) || 0 : part.quantity
                          return qty > part.maxStock && (
                            <p className="text-xs text-red-600 mt-1">
                              Stoc insuficient! Max: {part.maxStock}
                            </p>
                          )
                        })()}
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">Cost Total:</span>
                      <span className="text-2xl font-bold text-primary-600">
                        {totalCost.toFixed(2)} RON
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Anulează
          </button>
          <button
            onClick={handleSubmit}
            className="btn-primary inline-flex items-center"
            disabled={selectedParts.length === 0}
          >
            <Save className="w-5 h-5 mr-2" />
            Salvează Piese ({selectedParts.length})
          </button>
        </div>
      </div>
    </div>
  )
}
