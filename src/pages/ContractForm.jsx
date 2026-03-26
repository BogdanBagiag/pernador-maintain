import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Save, Building2, CreditCard, FileText, User, Search, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

const schema = z.object({
  // Vânzător
  seller_name: z.string().min(1, 'Câmp obligatoriu'),
  seller_address: z.string().optional(),
  seller_j_code: z.string().optional(),
  seller_cui: z.string().optional(),
  seller_representative: z.string().optional(),
  seller_representative_role: z.string().optional(),
  // Cumpărător
  buyer_name: z.string().min(1, 'Denumirea cumpărătorului este obligatorie'),
  buyer_address: z.string().optional(),
  buyer_county: z.string().optional(),
  buyer_j_code: z.string().optional(),
  buyer_cui: z.string().optional(),
  buyer_representative: z.string().optional(),
  buyer_representative_role: z.string().optional(),
  buyer_email: z.string().email('Email invalid').optional().or(z.literal('')),
  // Plată
  payment_term_days: z.coerce.number().min(1, 'Minim 1 zi').default(30),
  payment_term_text: z.string().optional(),
  advance_percent: z.coerce.number().min(0).max(100).default(0),
  delivery_percent: z.coerce.number().min(0).max(100).default(0),
  invoice_term_days: z.coerce.number().min(0).default(30),
  invoice_term_text: z.string().optional(),
  invoice_term_percent: z.coerce.number().min(0).max(100).default(100),
  // General
  contract_date: z.string().min(1, 'Data este obligatorie'),
  notes: z.string().optional(),
})

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b border-gray-200 mb-6">
      <div className="p-2 bg-primary-50 rounded-lg mt-0.5">
        <Icon className="w-5 h-5 text-primary-600" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50"

export default function ContractForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const isEditing = Boolean(id)

  // ANAF lookup
  const [anafLoading, setAnafLoading] = useState(false)
  const [anafError, setAnafError] = useState(null)
  const [anafSuccess, setAnafSuccess] = useState(false)

  const lookupAnaf = async () => {
    const cui = watch('buyer_cui')?.replace(/[^0-9]/g, '')
    if (!cui) {
      setAnafError('Introdu CUI-ul înainte de căutare')
      return
    }
    setAnafLoading(true)
    setAnafError(null)
    setAnafSuccess(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/anaf-lookup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ cui }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Eroare ANAF')
      // Precompleteaza campurile
      setValue('buyer_name', data.denumire || '')
      setValue('buyer_address', data.adresa || '')
      setValue('buyer_county', data.judet || '')
      setValue('buyer_j_code', data.nrRegCom || '')
      setAnafSuccess(true)
      setTimeout(() => setAnafSuccess(false), 4000)
    } catch (err) {
      setAnafError(err.message)
    } finally {
      setAnafLoading(false)
    }
  }

  const { data: existing, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('contracts').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: isEditing,
  })

  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      seller_name: '',
      seller_address: '',
      seller_j_code: '',
      seller_cui: '',
      seller_representative: '',
      seller_representative_role: 'Administrator',
      buyer_name: '',
      buyer_address: '',
      buyer_county: '',
      buyer_j_code: '',
      buyer_cui: '',
      buyer_representative: '',
      buyer_representative_role: 'Administrator',
      buyer_email: '',
      payment_term_days: 30,
      payment_term_text: 'treizeci',
      advance_percent: 0,
      delivery_percent: 0,
      invoice_term_days: 30,
      invoice_term_text: 'treizeci',
      invoice_term_percent: 100,
      contract_date: today,
      notes: '',
    },
  })

  useEffect(() => {
    if (existing) {
      reset({
        ...existing,
        contract_date: existing.contract_date || today,
      })
    }
  }, [existing, reset])

  const adv = Number(watch('advance_percent') || 0)
  const del = Number(watch('delivery_percent') || 0)
  const inv = Number(watch('invoice_term_percent') || 0)
  const totalPercent = adv + del + inv

  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        ...values,
        updated_at: new Date().toISOString(),
      }
      if (isEditing) {
        const { error } = await supabase.from('contracts').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('contracts').insert({
          ...payload,
          created_by: user.id,
        }).select('id').single()
        if (error) throw error
        return data
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['contracts'])
      if (isEditing) {
        navigate(`/contracte/${id}`)
      } else {
        navigate(`/contracte/${data.id}`)
      }
    },
  })

  if (isEditing && isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Editează Contract' : 'Contract Nou'}
          </h1>
          {existing?.contract_number && (
            <p className="text-sm text-gray-500">{existing.contract_number}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        {/* Data contractului */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <Field label="Data contractului" error={errors.contract_date?.message}>
            <input type="date" {...register('contract_date')} className={inputClass} />
          </Field>
        </div>

        {/* Vânzător */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle icon={Building2} title="Vânzătorul" subtitle="Datele firmei dvs. (Pernador)" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Denumire" error={errors.seller_name?.message}>
                <input {...register('seller_name')} placeholder="ex. S.C. PERNADOR S.R.L." className={inputClass} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Adresă sediu social">
                <input {...register('seller_address')} placeholder="Str., nr., localitate, județ" className={inputClass} />
              </Field>
            </div>
            <Field label="Codul J (Reg. Comerțului)">
              <input {...register('seller_j_code')} placeholder="ex. J22/123/2020" className={inputClass} />
            </Field>
            <Field label="CUI / CIF">
              <input {...register('seller_cui')} placeholder="ex. RO12345678" className={inputClass} />
            </Field>
            <Field label="Reprezentat prin">
              <input {...register('seller_representative')} placeholder="Nume Prenume" className={inputClass} />
            </Field>
            <Field label="În calitate de">
              <input {...register('seller_representative_role')} placeholder="Administrator / Director" className={inputClass} />
            </Field>
          </div>
        </div>

        {/* Cumpărător */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle icon={User} title="Cumpărătorul" subtitle="Datele firmei cliente" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Denumire *" error={errors.buyer_name?.message}>
                <input {...register('buyer_name')} placeholder="ex. S.C. CLIENT S.R.L." className={inputClass} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Adresă sediu social">
                <input {...register('buyer_address')} placeholder="Stradă, număr, localitate" className={inputClass} />
              </Field>
            </div>
            <Field label="Județ">
              <input {...register('buyer_county')} placeholder="ex. Iași" className={inputClass} />
            </Field>
            <Field label="Codul J (Reg. Comerțului)">
              <input {...register('buyer_j_code')} placeholder="ex. J22/456/2021" className={inputClass} />
            </Field>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CUI / CIF</label>
              <div className="flex gap-2">
                <input
                  {...register('buyer_cui')}
                  placeholder="ex. 12345678"
                  className={inputClass}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), lookupAnaf())}
                />
                <button
                  type="button"
                  onClick={lookupAnaf}
                  disabled={anafLoading}
                  title="Caută date în ANAF"
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {anafLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Search className="w-4 h-4" />
                  }
                  <span className="hidden sm:inline">ANAF</span>
                </button>
              </div>
              {anafError && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {anafError}
                </p>
              )}
              {anafSuccess && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  Date preluate din ANAF cu succes!
                </p>
              )}
            </div>
            <Field label="Email client">
              <input type="email" {...register('buyer_email')} placeholder="client@firma.ro" className={inputClass} />
            </Field>
            <Field label="Reprezentat prin">
              <input {...register('buyer_representative')} placeholder="Nume Prenume" className={inputClass} />
            </Field>
            <Field label="În calitate de">
              <input {...register('buyer_representative_role')} placeholder="Administrator / Director" className={inputClass} />
            </Field>
          </div>
        </div>

        {/* Condiții de plată */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle icon={CreditCard} title="Condiții de Plată" subtitle="Termene și modalități de plată" />

          {/* 7.2 Termen general */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700 font-medium mb-3">
              7.2 — Termenul de plată pentru produsele facturate
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Număr zile" error={errors.payment_term_days?.message}>
                <input
                  type="number"
                  {...register('payment_term_days')}
                  min="1"
                  placeholder="30"
                  className={inputClass}
                />
              </Field>
              <Field label="În litere">
                <input
                  {...register('payment_term_text')}
                  placeholder="treizeci"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          {/* 7.4 Modalități de plată */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700 font-medium mb-3">
              7.4 — Modalitățile de plată per comandă
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="(i) Avans (%)">
                  <input type="number" {...register('advance_percent')} min="0" max="100" step="0.01" className={inputClass} />
                </Field>
                <Field label="(ii) Plată la livrare (%)">
                  <input type="number" {...register('delivery_percent')} min="0" max="100" step="0.01" className={inputClass} />
                </Field>
              </div>
              <p className="text-xs text-blue-600 font-medium">(iii) Plată în termen de:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Număr zile">
                  <input type="number" {...register('invoice_term_days')} min="0" className={inputClass} />
                </Field>
                <Field label="În litere">
                  <input {...register('invoice_term_text')} placeholder="treizeci" className={inputClass} />
                </Field>
                <Field label="Procent (%)">
                  <input type="number" {...register('invoice_term_percent')} min="0" max="100" step="0.01" className={inputClass} />
                </Field>
              </div>
            </div>

            {/* Validare total */}
            <div className={`mt-3 flex items-center gap-2 text-xs font-medium ${totalPercent === 100 ? 'text-green-600' : totalPercent > 100 ? 'text-red-600' : 'text-amber-600'}`}>
              <div className={`w-2 h-2 rounded-full ${totalPercent === 100 ? 'bg-green-500' : totalPercent > 100 ? 'bg-red-500' : 'bg-amber-500'}`} />
              Total: {totalPercent}% {totalPercent !== 100 && '(trebuie să fie 100%)'}
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle icon={FileText} title="Observații" subtitle="Clauze speciale sau note interne" />
          <textarea
            {...register('notes')}
            rows={4}
            placeholder="Note sau clauze speciale..."
            className={inputClass}
          />
        </div>

        {/* Submit */}
        {mutation.isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Eroare: {mutation.error?.message}
          </div>
        )}

        <div className="flex gap-3 justify-end pb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Anulează
          </button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSubmitting || mutation.isPending ? 'Se salvează...' : 'Salvează contractul'}
          </button>
        </div>
      </form>
    </div>
  )
}
