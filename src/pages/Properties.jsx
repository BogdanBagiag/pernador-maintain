import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { format } from 'date-fns'
import {
  Plus, X, Trash2, Loader2, Home, Phone, Zap, AlertCircle,
  Check, Edit2, ChevronDown, ChevronUp, ShieldOff, Search,
} from 'lucide-react'

const UTILITY_TYPES = [
  { key: 'gaz', label: 'Gaz', icon: '🔥' },
  { key: 'energie', label: 'Energie', icon: '⚡' },
  { key: 'internet', label: 'Internet', icon: '📡' },
  { key: 'apa', label: 'Apă', icon: '💧' },
  { key: 'alt', label: 'Altul', icon: '📋' },
]

export default function Properties() {
  const { user } = useAuth()
  const { canView, canEdit, canDelete } = usePermissions()
  const queryClient = useQueryClient()

  const [showAddProperty, setShowAddProperty] = useState(false)
  const [expandedProperty, setExpandedProperty] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  if (!canView('properties')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <ShieldOff className="w-14 h-14 text-gray-300" />
        <p className="text-lg font-semibold text-gray-500">Acces restricționat</p>
      </div>
    )
  }

  const pEdit = canEdit('properties')
  const pDelete = canDelete('properties')

  // Fetch properties
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['rental_properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rental_properties')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })

  // Fetch utilities for all properties
  const { data: utilities = [] } = useQuery({
    queryKey: ['property_utilities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_utilities')
        .select('*')
        .order('created_at')
      if (error) throw error
      return data
    },
  })

  // Fetch readings
  const { data: readings = [] } = useQuery({
    queryKey: ['utility_readings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('utility_readings')
        .select('*')
        .order('reading_date', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // Add property
  const addProperty = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('rental_properties').insert([payload])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_properties'] })
      setShowAddProperty(false)
    },
  })

  // Delete property
  const deleteProperty = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('rental_properties').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental_properties'] })
    },
  })

  // Add utility
  const addUtility = useMutation({
    mutationFn: async ({ propertyId, type, name }) => {
      const { error } = await supabase.from('property_utilities').insert([{ property_id: propertyId, type, name }])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property_utilities'] })
    },
  })

  // Add reading
  const addReading = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('utility_readings').insert([payload])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utility_readings'] })
    },
  })

  // Mark as paid
  const markAsPaid = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('utility_readings')
        .update({ paid: true, payment_date: new Date().toISOString().split('T')[0] })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utility_readings'] })
    },
  })

  const filtered = properties.filter(p =>
    !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Home className="w-6 h-6 text-primary-600" />
          Proprietăți în chirie
        </h1>
        <p className="text-sm text-gray-500 mt-1">Gestionare utilități și citiri</p>
      </div>

      {/* Search și buton adăugare */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Caută proprietate sau chiriaș..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
        />
        {pEdit && (
          <button
            onClick={() => setShowAddProperty(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Proprietate nouă
          </button>
        )}
      </div>

      {/* Lista proprietăți */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {searchTerm ? 'Nicio proprietate găsită.' : 'Nicio proprietate adăugată.'}
          </div>
        ) : (
          filtered.map(prop => {
            const propUtilities = utilities.filter(u => u.property_id === prop.id)
            const isExpanded = expandedProperty === prop.id

            return (
              <div key={prop.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedProperty(isExpanded ? null : prop.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <div>
                      <h3 className="font-semibold text-gray-900">{prop.name}</h3>
                      {prop.tenant_name && (
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            👤 {prop.tenant_name}
                          </p>
                          {prop.tenant_phone && (
                            <p className="text-sm text-gray-600 flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {prop.tenant_phone}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                      {propUtilities.length} utilități
                    </span>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </button>

                {/* Detalii expandate */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-6 space-y-4">
                    {/* Utilități */}
                    <div>
                      <h4 className="font-medium text-gray-800 mb-3">Utilități</h4>
                      {propUtilities.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">Nicio utilitate adăugată.</p>
                      ) : (
                        <div className="space-y-2">
                          {propUtilities.map(util => {
                            const utilReadings = readings.filter(r => r.utility_id === util.id)
                            const typeInfo = UTILITY_TYPES.find(t => t.key === util.type)

                            return (
                              <div key={util.id} className="bg-white rounded-lg p-3 space-y-2">
                                <p className="font-medium text-sm text-gray-800">
                                  {typeInfo?.icon} {util.name}
                                </p>
                                {utilReadings.length === 0 ? (
                                  <p className="text-xs text-gray-400">Nicio citire.</p>
                                ) : (
                                  <div className="space-y-1">
                                    {utilReadings.slice(0, 3).map(reading => (
                                      <div key={reading.id} className="flex items-center justify-between text-xs">
                                        <span className="text-gray-600">
                                          {format(new Date(reading.reading_date), 'dd.MM.yyyy')} - {reading.reading_value}
                                          {reading.amount && ` (${reading.amount} lei)`}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                            reading.paid
                                              ? 'bg-green-100 text-green-700'
                                              : 'bg-yellow-100 text-yellow-700'
                                          }`}>
                                            {reading.paid ? 'Plătit' : 'Neplătit'}
                                          </span>
                                          {!reading.paid && pEdit && (
                                            <button
                                              onClick={() => markAsPaid.mutate(reading.id)}
                                              disabled={markAsPaid.isPending}
                                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                    {utilReadings.length > 3 && (
                                      <p className="text-xs text-gray-400">+{utilReadings.length - 3} mai multe</p>
                                    )}
                                  </div>
                                )}

                                {/* Adauga citire */}
                                {pEdit && (
                                  <AddReadingForm utilityId={util.id} onAdd={() => addReading.mutate({ utility_id: util.id, reading_date: new Date().toISOString().split('T')[0] })} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Adauga utilitate */}
                      {pEdit && (
                        <AddUtilityForm propertyId={prop.id} onAdd={(type, name) => addUtility.mutate({ propertyId: prop.id, type, name })} />
                      )}
                    </div>

                    {/* Butoane acțiuni */}
                    {pDelete && (
                      <div className="flex gap-2 pt-2 border-t border-gray-200">
                        <button
                          onClick={() => deleteProperty.mutate(prop.id)}
                          disabled={deleteProperty.isPending}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          {deleteProperty.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          Șterge
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Modal adauga proprietate */}
      {showAddProperty && (
        <AddPropertyModal
          onClose={() => setShowAddProperty(false)}
          onAdd={(data) => addProperty.mutate(data)}
          isLoading={addProperty.isPending}
        />
      )}
    </div>
  )
}

function AddPropertyModal({ onClose, onAdd, isLoading }) {
  const [name, setName] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [tenantPhone, setTenantPhone] = useState('')

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Proprietate nouă</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nume proprietate *</label>
              <input
                type="text"
                placeholder="ex: Hala 1, Apartament 5"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nume chiriaș</label>
              <input
                type="text"
                placeholder="ex: Ion Popescu"
                value={tenantName}
                onChange={e => setTenantName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon chiriaș</label>
              <input
                type="tel"
                placeholder="ex: 0722 123 456"
                value={tenantPhone}
                onChange={e => setTenantPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
              Anulează
            </button>
            <button
              onClick={() => onAdd({ name: name.trim(), tenant_name: tenantName.trim() || null, tenant_phone: tenantPhone.trim() || null })}
              disabled={!name.trim() || isLoading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Adaugă'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function AddUtilityForm({ propertyId, onAdd }) {
  const [type, setType] = useState('energie')
  const [name, setName] = useState('')
  const [show, setShow] = useState(false)

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="text-xs text-primary-600 hover:text-primary-700 font-medium mt-2"
      >
        + Adaugă utilitate
      </button>
    )
  }

  return (
    <div className="flex gap-2 mt-3 bg-gray-100 p-2 rounded-lg">
      <select
        value={type}
        onChange={e => setType(e.target.value)}
        className="px-2 py-1 text-xs border border-gray-300 rounded outline-none"
      >
        {UTILITY_TYPES.map(t => (
          <option key={t.key} value={t.key}>{t.label}</option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Descripție"
        value={name}
        onChange={e => setName(e.target.value)}
        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded outline-none"
      />
      <button
        onClick={() => { onAdd(type, name || UTILITY_TYPES.find(t => t.key === type).label); setShow(false); setName(''); setType('energie') }}
        className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
      >
        OK
      </button>
      <button onClick={() => setShow(false)} className="px-2 py-1 text-xs text-gray-500">Anulează</button>
    </div>
  )
}

function AddReadingForm({ utilityId, onAdd }) {
  const [show, setShow] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [value, setValue] = useState('')
  const [amount, setAmount] = useState('')

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
      >
        + Adaugă citire
      </button>
    )
  }

  return (
    <div className="flex gap-1.5 bg-blue-50 p-2 rounded-lg">
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="px-2 py-1 text-xs border border-gray-300 rounded outline-none"
      />
      <input
        type="number"
        placeholder="Citire"
        value={value}
        onChange={e => setValue(e.target.value)}
        className="px-2 py-1 text-xs border border-gray-300 rounded outline-none w-20"
      />
      <input
        type="number"
        placeholder="Sumă"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        className="px-2 py-1 text-xs border border-gray-300 rounded outline-none w-24"
      />
      <button
        onClick={() => { onAdd(); setShow(false); setDate(new Date().toISOString().split('T')[0]); setValue(''); setAmount('') }}
        className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
      >
        OK
      </button>
      <button onClick={() => setShow(false)} className="px-2 py-1 text-xs text-gray-500">Anulează</button>
    </div>
  )
}
