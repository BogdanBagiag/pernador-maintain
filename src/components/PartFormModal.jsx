import { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { X, Save, Package, Search } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'

export default function PartFormModal({ part, onClose }) {
  const queryClient = useQueryClient()
  const isEditing = !!part

  const [formData, setFormData] = useState({
    name: '',
    part_number: '',
    description: '',
    category: '',
    quantity_in_stock: 0,
    min_quantity: 0,
    unit_price: 0,
    unit_of_measure: 'buc',
    supplier: '',
    supplier_contact: '',
    storage_location: '',
    compatible_equipment: [],
    notes: ''
  })

  const [error, setError] = useState('')
  const [equipmentSearch, setEquipmentSearch] = useState('')

  // Fetch equipment for compatibility selection
  const { data: equipment } = useQuery({
    queryKey: ['equipment-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('id, name, model, serial_number')
        .order('name')
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (part) {
      setFormData({
        name: part.name || '',
        part_number: part.part_number || '',
        description: part.description || '',
        category: part.category || '',
        quantity_in_stock: part.quantity_in_stock || 0,
        min_quantity: part.min_quantity || 0,
        unit_price: part.unit_price || 0,
        unit_of_measure: part.unit_of_measure || 'buc',
        supplier: part.supplier || '',
        supplier_contact: part.supplier_contact || '',
        storage_location: part.storage_location || '',
        compatible_equipment: part.compatible_equipment || [],
        notes: part.notes || ''
      })
    }
  }, [part])

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isEditing) {
        const { error } = await supabase
          .from('inventory_parts')
          .update(data)
          .eq('id', part.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('inventory_parts')
          .insert([data])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory-parts'])
      onClose()
    },
    onError: (error) => {
      setError(error.message)
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('Numele piesei este obligatoriu')
      return
    }

    if (formData.quantity_in_stock < 0) {
      setError('Cantitatea nu poate fi negativă')
      return
    }

    saveMutation.mutate(formData)
  }

  const handleEquipmentToggle = (equipmentId) => {
    setFormData(prev => ({
      ...prev,
      compatible_equipment: prev.compatible_equipment.includes(equipmentId)
        ? prev.compatible_equipment.filter(id => id !== equipmentId)
        : [...prev.compatible_equipment, equipmentId]
    }))
  }

  // Filter equipment based on search
  const filteredEquipment = equipment?.filter(eq => 
    eq.name?.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
    eq.model?.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
    eq.serial_number?.toLowerCase().includes(equipmentSearch.toLowerCase())
  ) || []

  const categories = [
    'ulei',
    'filtru',
    'curea',
    'rulment',
    'garnitură',
    'componente',
    'consumabile',
    'altele'
  ]

  const units = [
    'buc',
    'litru',
    'kg',
    'metru',
    'set',
    'pereche'
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Package className="w-6 h-6 text-primary-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Editează Piesă' : 'Piesă Nouă'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Informații de bază */}
            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Informații de Bază
              </h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nume Piesă *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input w-full"
                placeholder="ex: Ulei SAE 10W-40"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cod Piesă
              </label>
              <input
                type="text"
                value={formData.part_number}
                onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                className="input w-full"
                placeholder="ex: OIL-10W40-5L"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descriere
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input w-full"
                rows="2"
                placeholder="Descriere detaliată a piesei..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categorie
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input w-full"
              >
                <option value="">Selectează categoria</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Locație Depozitare
              </label>
              <input
                type="text"
                value={formData.storage_location}
                onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                className="input w-full"
                placeholder="ex: Magazie A - Raft 3"
              />
            </div>

            {/* Stoc și Prețuri */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Stoc și Prețuri
              </h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantitate în Stoc *
              </label>
              <input
                type="number"
                value={formData.quantity_in_stock}
                onChange={(e) => setFormData({ ...formData, quantity_in_stock: parseInt(e.target.value) || 0 })}
                className="input w-full"
                min="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nivel Minim Stoc
              </label>
              <input
                type="number"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })}
                className="input w-full"
                min="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Alertă când stocul scade sub această valoare
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preț Unitar (RON)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                className="input w-full"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unitate de Măsură
              </label>
              <select
                value={formData.unit_of_measure}
                onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                className="input w-full"
              >
                {units.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            {/* Furnizor */}
            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Informații Furnizor
              </h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Furnizor
              </label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="input w-full"
                placeholder="Nume furnizor"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Furnizor
              </label>
              <input
                type="text"
                value={formData.supplier_contact}
                onChange={(e) => setFormData({ ...formData, supplier_contact: e.target.value })}
                className="input w-full"
                placeholder="Telefon, email, etc."
              />
            </div>

            {/* Compatibilitate Echipamente */}
            {equipment && equipment.length > 0 && (
              <>
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Echipamente Compatibile
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Selectează echipamentele pentru care poate fi folosită această piesă
                  </p>
                  
                  {/* Search equipment */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Caută echipamente..."
                      value={equipmentSearch}
                      onChange={(e) => setEquipmentSearch(e.target.value)}
                      className="input pl-9 w-full"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-4">
                    <div className="space-y-2">
                      {filteredEquipment.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          {equipmentSearch ? 'Nu s-au găsit echipamente' : 'Nu există echipamente disponibile'}
                        </p>
                      ) : (
                        filteredEquipment.map(eq => (
                        <label key={eq.id} className="flex items-start space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={formData.compatible_equipment.includes(eq.id)}
                            onChange={() => handleEquipmentToggle(eq.id)}
                            className="form-checkbox h-4 w-4 text-primary-600 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{eq.name}</p>
                            {(eq.model || eq.serial_number) && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {eq.model && <span>Model: {eq.model}</span>}
                                {eq.model && eq.serial_number && <span className="mx-1">•</span>}
                                {eq.serial_number && <span>Serie: {eq.serial_number}</span>}
                              </p>
                            )}
                          </div>
                        </label>
                      ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Note */}
            <div className="md:col-span-2 mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input w-full"
                rows="3"
                placeholder="Note suplimentare..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={saveMutation.isPending}
            >
              Anulează
            </button>
            <button
              type="submit"
              className="btn-primary inline-flex items-center"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Se salvează...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  {isEditing ? 'Actualizează' : 'Adaugă Piesă'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
