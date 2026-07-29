import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { Loader2, Package, Phone, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'

// Pagina publica de scanare a unui bon Pernador Clean - fara autentificare.
// Accesibila prin codul QR tiparit pe bon; oricine are link-ul (deci id-ul bonului)
// poate vedea bonul si ii poate schimba statusul, fara sa fie logat in aplicatie.

const STATUSES = [
  { key: 'adus',     label: 'Adus',     emoji: '📥', badge: 'bg-blue-100 text-blue-700',  ring: 'ring-blue-300' },
  { key: 'in_lucru', label: 'În lucru', emoji: '🧼', badge: 'bg-amber-100 text-amber-700', ring: 'ring-amber-300' },
  { key: 'gata',     label: 'Gata',     emoji: '✅', badge: 'bg-green-100 text-green-700', ring: 'ring-green-300' },
  { key: 'ridicat',  label: 'Ridicat',  emoji: '🏠', badge: 'bg-gray-100 text-gray-600',   ring: 'ring-gray-300' },
]
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.key, s]))

export default function PernadorCleanScan() {
  const { bonId } = useParams()
  const [searchParams] = useSearchParams()
  const readOnly = searchParams.get('ro') === '1'
  const queryClient = useQueryClient()
  const [pendingStatus, setPendingStatus] = useState(null)

  const { data: bon, isLoading, error, refetch } = useQuery({
    queryKey: ['pc_scan_bon', bonId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pc_get_bon_public', { p_bon_id: bonId })
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Bon negăsit')
      return data[0]
    },
    enabled: !!bonId,
    retry: false,
  })

  const changeStatus = useMutation({
    mutationFn: async (newStatus) => {
      const { error } = await supabase.rpc('pc_advance_status', { p_bon_id: bonId, p_new_status: newStatus })
      if (error) throw error
    },
    onSuccess: () => {
      setPendingStatus(null)
      queryClient.invalidateQueries({ queryKey: ['pc_scan_bon', bonId] })
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (error || !bon) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-sm text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-gray-700 font-medium">Bonul nu a putut fi găsit.</p>
          <p className="text-sm text-gray-400">Verifică dacă linkul e corect.</p>
        </div>
      </div>
    )
  }

  const st = STATUS_MAP[bon.status] || {}
  const otherStatuses = STATUSES.filter(s => s.key !== bon.status)

  return (
    <div className="min-h-screen bg-gray-50 flex items-start sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-primary-600 px-6 py-5 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <span className="font-bold text-lg">Pernador Clean</span>
          </div>
          <p className="text-primary-100 text-sm mt-0.5">Bon #{bon.nr_bon}</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Status curent */}
          <div className="text-center">
            <span className={`inline-flex items-center gap-2 text-base font-semibold px-4 py-2 rounded-full ${st.badge}`}>
              {st.emoji} {st.label}
            </span>
          </div>

          {/* Client */}
          <div className="space-y-1 text-center">
            <p className="text-lg font-semibold text-gray-900">{bon.nume}</p>
            {bon.telefon && (
              <p className="text-sm text-gray-400 flex items-center justify-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {bon.telefon}
              </p>
            )}
          </div>

          {/* Produse */}
          {(bon.produse || []).length > 0 && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-1.5">
              {(bon.produse || []).map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <Package className="w-3.5 h-3.5 flex-shrink-0 text-gray-300" />
                  <span>
                    {p.cantitate}x {p.produs || '—'}
                    {p.dimensiune ? ` (${p.dimensiune})` : ''}
                    {p.culoare ? ` · ${p.culoare}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Date */}
          <div className="text-xs text-gray-400 text-center space-y-0.5">
            <p>Adus: {bon.created_at ? format(new Date(bon.created_at), 'dd.MM.yyyy HH:mm') : '—'}</p>
            {bon.data_gata && (
              <p className="text-green-500">Gata: {format(new Date(bon.data_gata), 'dd.MM.yyyy HH:mm')}</p>
            )}
          </div>

          {/* Schimbare status - doar pentru exemplarul de magazin, nu si pentru client */}
          <div className="border-t border-gray-100 pt-4">
            {readOnly ? (
              <p className="text-xs text-gray-400 text-center">
                Poți urmări aici statusul comenzii tale. Statusul este actualizat de operator.
              </p>
            ) : pendingStatus ? (
              <div className="space-y-2 text-center">
                <p className="text-sm text-gray-600">
                  Schimbi statusul în <b>{STATUS_MAP[pendingStatus]?.label}</b>?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => changeStatus.mutate(pendingStatus)}
                    disabled={changeStatus.isPending}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white rounded-xl py-2.5 font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    {changeStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Da, schimbă
                  </button>
                  <button
                    onClick={() => setPendingStatus(null)}
                    className="flex-1 bg-white border border-gray-200 text-gray-600 rounded-xl py-2.5 font-medium hover:bg-gray-50"
                  >
                    Anulează
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 text-center mb-2">Schimbă statusul în:</p>
                <div className="grid grid-cols-1 gap-2">
                  {otherStatuses.map(s => (
                    <button
                      key={s.key}
                      onClick={() => setPendingStatus(s.key)}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-medium text-sm hover:ring-2 transition-all ${s.badge} border-transparent ${s.ring}`}
                    >
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {changeStatus.isError && (
              <p className="text-xs text-red-500 text-center mt-2">
                Eroare: {changeStatus.error?.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
