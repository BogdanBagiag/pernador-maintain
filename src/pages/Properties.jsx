import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { format } from 'date-fns'
import {
  Plus, X, Trash2, Loader2, Home, Phone, Zap, AlertCircle,
  Check, Edit2, ChevronDown, ChevronUp, ShieldOff, Search, MapPin, Users,
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

  // Fetch tenants for all properties
  const { data: tenants = [] } = useQuery({
    queryKey: ['property_tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_tenants')
        .select('*')
        .order('created_at')
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

  // Add tenant
  const addTenant = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from('property_tenants').insert([payload])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property_tenants'] })
    },
  })

  // Update tenant status
  const updateTenantStatus = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('property_tenants').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property_tenants'] })
    },
  })

  // Delete tenant
  const deleteTenant = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('property_tenants').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property_tenants'] })
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

  // Update utility
  const updateUtility = useMutation({
    mutationFn: async ({ id, type, name }) => {
      const { error } = await supabase.from('property_utilities').update({ type, name }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property_utilities'] })
    },
  })

  // Delete utility
  const deleteUtility = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('property_utilities').delete().eq('id', id)
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

  // Update reading
  const updateReading = useMutation({
    mutationFn: async ({ id, reading_date, reading_value, amount }) => {
      const { error } = await supabase
        .from('utility_readings')
        .update({ reading_date, reading_value, amount })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['utility_readings'] })
    },
  })

  // Delete reading
  const deleteReading = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('utility_readings').delete().eq('id', id)
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

  const filtered = properties.filter(p => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    const propTenants = tenants.filter(t => t.property_id === p.id)
    return (
      p.name.toLowerCase().includes(search) ||
      p.address?.toLowerCase().includes(search) ||
      propTenants.some(t => t.name.toLowerCase().includes(search))
    )
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Home className="w-6 h-6 text-primary-600" />
          Proprietăți în chirie
        </h1>
        <p className="text-sm text-gray-500 mt-1">Gestionare proprietăți, chiriași și utilități</p>
      </div>

      {/* Search și buton adăugare */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Caută proprietate, adresă sau chiriaș..."
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
            const propTenants = tenants.filter(t => t.property_id === prop.id)
            const activeTenant = propTenants.find(t => t.is_active)
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
                      <div className="space-y-1 mt-1">
                        {prop.address && (
                          <p className="text-sm text-gray-600 flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5" /> {prop.address}
                          </p>
                        )}
                        {activeTenant && (
                          <p className="text-sm text-gray-600 flex items-center gap-2">
                            <Users className="w-3.5 h-3.5" /> {activeTenant.name}
                            {activeTenant.phone && <span className="text-gray-500">• {activeTenant.phone}</span>}
                          </p>
                        )}
                        {!activeTenant && propTenants.length > 0 && (
                          <p className="text-sm text-amber-600 flex items-center gap-2">
                            <Users className="w-3.5 h-3.5" /> Niciun chiriaș activ
                          </p>
                        )}
                      </div>
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
                  <div className="border-t border-gray-100 bg-gray-50 p-6 space-y-6">
                    {/* Chiriași */}
                    <div>
                      <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Chiriași
                      </h4>
                      {propTenants.length === 0 ? (
                        <p className="text-sm text-gray-400 italic mb-3">Niciun chiriaș adăugat.</p>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {propTenants.map(tenant => (
                            <div key={tenant.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm text-gray-800">
                                  {tenant.name}
                                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    tenant.is_active
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {tenant.is_active ? 'Activ' : 'Inactiv'}
                                  </span>
                                </p>
                                {tenant.phone && <p className="text-xs text-gray-600 mt-1">{tenant.phone}</p>}
                                <p className="text-xs text-gray-500 mt-1">
                                  Din {format(new Date(tenant.start_date), 'dd.MM.yyyy')}
                                  {tenant.end_date && ` - ${format(new Date(tenant.end_date), 'dd.MM.yyyy')}`}
                                </p>
                              </div>
                              {pEdit && (
                                <div className="flex gap-2">
                                  {!tenant.is_active && (
                                    <button
                                      onClick={() => updateTenantStatus.mutate({ id: tenant.id, is_active: true })}
                                      disabled={updateTenantStatus.isPending}
                                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                                      title="Marcheaza ca activ"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                  )}
                                  {tenant.is_active && (
                                    <button
                                      onClick={() => updateTenantStatus.mutate({ id: tenant.id, is_active: false })}
                                      disabled={updateTenantStatus.isPending}
                                      className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"
                                      title="Marcheza ca inactiv"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                  {pDelete && (
                                    <button
                                      onClick={() => deleteTenant.mutate(tenant.id)}
                                      disabled={deleteTenant.isPending}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Adauga chiriaș */}
                      {pEdit && (
                        <AddTenantForm propertyId={prop.id} onAdd={(name, phone) => addTenant.mutate({ property_id: prop.id, name, phone, is_active: true, start_date: new Date().toISOString().split('T')[0] })} />
                      )}
                    </div>

                    {/* Utilități */}
                    <div>
                      <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4" /> Utilități
                      </h4>
                      {propUtilities.length === 0 ? (
                        <p className="text-sm text-gray-400 italic mb-3">Nicio utilitate adăugată.</p>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {propUtilities.map(util => {
                            const utilReadings = readings.filter(r => r.utility_id === util.id)
                            const typeInfo = UTILITY_TYPES.find(t => t.key === util.type)

                            return (
                              <div key={util.id} className="bg-white rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-sm text-gray-800">
                                    {typeInfo?.icon} {util.name}
                                  </p>
                                  {pEdit && (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => {
                                          const newType = prompt('Tip utilitate:', util.type)
                                          const newName = prompt('Nume:', util.name)
                                          if (newType && newName) {
                                            updateUtility.mutate({ id: util.id, type: newType, name: newName })
                                          }
                                        }}
                                        disabled={updateUtility.isPending}
                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                        title="Editează"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      {pDelete && (
                                        <button
                                          onClick={() => {
                                            if (confirm('Ștergi utilitatea și toate citirile ei?')) {
                                              deleteUtility.mutate(util.id)
                                            }
                                          }}
                                          disabled={deleteUtility.isPending}
                                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                                          title="Șterge"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {utilReadings.length === 0 ? (
                                  <p className="text-xs text-gray-400">Nicio citire.</p>
                                ) : (
                                  <div className="space-y-1">
                                    {utilReadings.slice(0, 3).map(reading => (
                                      <div key={reading.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                                        <span className="text-gray-600 flex-1">
                                          {format(new Date(reading.reading_date), 'dd.MM.yyyy')} - {reading.reading_value}
                                          {reading.amount && ` (${reading.amount} lei)`}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                            reading.paid
                                              ? 'bg-green-100 text-green-700'
                                              : 'bg-yellow-100 text-yellow-700'
                                          }`}>
                                            {reading.paid ? 'Plătit' : 'Neplătit'}
                                          </span>
                                          {pEdit && (
                                            <>
                                              <button
                                                onClick={() => {
                                                  const newDate = prompt('Dată (YYYY-MM-DD):', reading.reading_date)
                                                  const newValue = prompt('Citire:', reading.reading_value)
                                                  const newAmount = prompt('Sumă (lei):', reading.amount || '')
                                                  if (newDate && newValue) {
                                                    updateReading.mutate({
                                                      id: reading.id,
                                                      reading_date: newDate,
                                                      reading_value: newValue,
                                                      amount: newAmount || null,
                                                    })
                                                  }
                                                }}
                                                disabled={updateReading.isPending}
                                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                title="Editează"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </button>
                                              {pDelete && (
                                                <button
                                                  onClick={() => {
                                                    if (confirm('Ștergi citirea?')) {
                                                      deleteReading.mutate(reading.id)
                                                    }
                                                  }}
                                                  disabled={deleteReading.isPending}
                                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                  title="Șterge"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </button>
                                              )}
                                            </>
                                          )}
                                          {!reading.paid && pEdit && (
                                            <button
                                              onClick={() => markAsPaid.mutate(reading.id)}
                                              disabled={markAsPaid.isPending}
                                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                                              title="Marcheaza ca plătit"
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
                                  <AddReadingForm
                                    utilityId={util.id}
                                    onAdd={(date, value, amount) => addReading.mutate({
                                      utility_id: util.id,
                                      reading_date: date,
                                      reading_value: value,
                                      amount: amount || null,
                                    })}
                                  />
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
                          Șterge proprietate
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
  const [address, setAddress] = useState('')

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresă</label>
              <input
                type="text"
                placeholder="ex: Str. Prichinei 123, Brașov"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
              Anulează
            </button>
            <button
              onClick={() => onAdd({ name: name.trim(), address: address.trim() || null })}
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

function AddTenantForm({ propertyId, onAdd }) {
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
      >
        + Adaugă chiriaș
      </button>
    )
  }

  return (
    <div className="bg-gray-100 p-3 rounded-lg space-y-2">
      <input
        type="text"
        placeholder="Nume chiriaș"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded outline-none"
      />
      <input
        type="tel"
        placeholder="Telefon (opțional)"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => { onAdd(name.trim(), phone.trim() || null); setShow(false); setName(''); setPhone('') }}
          disabled={!name.trim()}
          className="flex-1 px-2 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
        >
          Adaugă
        </button>
        <button onClick={() => setShow(false)} className="px-2 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-200">
          Anulează
        </button>
      </div>
    </div>
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
        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
      >
        + Adaugă utilitate
      </button>
    )
  }

  return (
    <div className="flex gap-2 bg-gray-100 p-2 rounded-lg">
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
        onClick={() => { onAdd(date, value, amount); setShow(false); setDate(new Date().toISOString().split('T')[0]); setValue(''); setAmount('') }}
        className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
      >
        OK
      </button>
      <button onClick={() => setShow(false)} className="px-2 py-1 text-xs text-gray-500">Anulează</button>
    </div>
  )
}
