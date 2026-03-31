import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft, Save, Building2, CreditCard, FileText,
  User, Search, Loader2, CheckCircle, AlertCircle, BookmarkCheck,
  Package, Plus, Trash2, Settings
} from 'lucide-react'

const schema = z.object({
  seller_name: z.string().min(1, 'Câmp obligatoriu'),
  seller_address: z.string().optional(),
  seller_j_code: z.string().optional(),
  seller_cui: z.string().optional(),
  seller_county: z.string().optional(),
  seller_representative: z.string().optional(),
  seller_representative_role: z.string().optional(),
  buyer_name: z.string().min(1, 'Denumirea cumpărătorului este obligatorie'),
  buyer_address: z.string().optional(),
  buyer_county: z.string().optional(),
  buyer_j_code: z.string().optional(),
  buyer_cui: z.string().optional(),
  buyer_representative: z.string().optional(),
  buyer_representative_role: z.string().optional(),
  buyer_email: z.string().email('Email invalid').optional().or(z.literal('')),
  payment_term_days: z.coerce.number().min(1, 'Minim 1 zi').default(30),
  payment_term_text: z.string().optional(),
  advance_percent: z.coerce.number().min(0).max(100).default(0),
  delivery_percent: z.coerce.number().min(0).max(100).default(0),
  invoice_term_days: z.coerce.number().min(0).default(30),
  invoice_term_text: z.string().optional(),
  invoice_term_percent: z.coerce.number().min(0).max(100).default(100),
  contract_date: z.string().min(1, 'Data este obligatorie'),
  notes: z.string().optional(),
  template_id: z.string().optional(),
  payment_condition_template_id: z.string().optional(),
})

function SectionTitle({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between pb-4 border-b border-gray-200 mb-6">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary-50 rounded-lg mt-0.5">
          <Icon className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
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
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isEditing = Boolean(id)

  // Produse
  const [products, setProducts] = useState([])

  const addProduct = () => {
    setProducts(prev => [...prev, { name: '', quantity: '1', unit: 'buc', price: '', vat: '21' }])
  }
  const removeProduct = (idx) => {
    setProducts(prev => prev.filter((_, i) => i !== idx))
  }
  const updateProduct = (idx, field, value) => {
    setProducts(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  // ANAF state
  const [anafLoading, setAnafLoading] = useState(false)
  const [anafError, setAnafError] = useState(null)
  const [anafSuccess, setAnafSuccess] = useState(false)

  // Salvare firma state
  const [savingCompany, setSavingCompany] = useState(false)
  const [saveCompanySuccess, setSaveCompanySuccess] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      seller_name: '', seller_address: '', seller_j_code: '',
      seller_cui: '', seller_county: '', seller_representative: '', seller_representative_role: 'Administrator',
      buyer_name: '', buyer_address: '', buyer_county: '',
      buyer_j_code: '', buyer_cui: '', buyer_representative: '',
      buyer_representative_role: 'Administrator', buyer_email: '',
      payment_term_days: 30, payment_term_text: 'treizeci',
      advance_percent: 0, delivery_percent: 0,
      invoice_term_days: 30, invoice_term_text: 'treizeci',
      invoice_term_percent: 100, contract_date: today, notes: '',
    },
  })

  // Încarcă datele firmei salvate
  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle()
      return data
    },
  })

  // Fetch șabloane disponibile
  const { data: templates = [] } = useQuery({
    queryKey: ['contract-templates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contract_templates')
        .select('id, name, is_active')
        .order('updated_at', { ascending: false })
      return data || []
    },
  })

  const { data: paymentTemplates = [] } = useQuery({
    queryKey: ['payment-condition-templates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('payment_condition_templates')
        .select('*')
        .order('order_index', { ascending: true })
      return data || []
    },
  })

  // Încarcă contractul existent la editare
  const { data: existing, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('contracts').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: isEditing,
  })

  // Setează automat șablonul activ la creare
  useEffect(() => {
    if (!isEditing && templates.length > 0) {
      const active = templates.find(t => t.is_active)
      if (active) setValue('template_id', active.id)
    }
  }, [templates, isEditing, setValue])

  // Aplică datele firmei la creare (nu la editare)
  useEffect(() => {
    if (!isEditing && companySettings?.seller_name) {
      setValue('seller_name', companySettings.seller_name || '')
      setValue('seller_address', companySettings.seller_address || '')
      setValue('seller_j_code', companySettings.seller_j_code || '')
      setValue('seller_cui', companySettings.seller_cui || '')
      setValue('seller_representative', companySettings.seller_representative || '')
      setValue('seller_representative_role', companySettings.seller_representative_role || 'Administrator')
    }
  }, [companySettings, isEditing, setValue])

  // Aplică datele contractului existent la editare
  useEffect(() => {
    if (existing) {
      reset({ ...existing, contract_date: existing.contract_date || today })
      if (existing.products && Array.isArray(existing.products)) {
        setProducts(existing.products)
      }
      // Set payment template from saved id or detect from data
      if (existing.payment_condition_template_id) {
        setSelectedPaymentTemplateId(existing.payment_condition_template_id)
      } else if (paymentTemplates.length > 0) {
        const detected = detectPaymentType(existing)
        const match = paymentTemplates.find(t => t.payment_type === detected)
        if (match) {
          setSelectedPaymentTemplateId(match.id)
          setValue('payment_condition_template_id', match.id)
        }
      }
    }
  }, [existing, reset, paymentTemplates])

  // Salvare date firmă
  const handleSaveCompany = async () => {
    setSavingCompany(true)
    setSaveCompanySuccess(false)
    try {
      const payload = {
        seller_name: watch('seller_name') || '',
        seller_address: watch('seller_address') || '',
        seller_j_code: watch('seller_j_code') || '',
        seller_cui: watch('seller_cui') || '',
        seller_representative: watch('seller_representative') || '',
        seller_representative_role: watch('seller_representative_role') || '',
        updated_at: new Date().toISOString(),
      }
      if (companySettings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(payload)
          .eq('id', companySettings.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert(payload)
        if (error) throw error
      }
      queryClient.invalidateQueries(['company-settings'])
      setSaveCompanySuccess(true)
      setTimeout(() => setSaveCompanySuccess(false), 3000)
    } catch (err) {
      alert('Eroare la salvare: ' + err.message)
    } finally {
      setSavingCompany(false)
    }
  }

  // ANAF lookup pentru cumpărător
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

  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = { ...values, products, updated_at: new Date().toISOString() }
      if (isEditing) {
        const { error } = await supabase.from('contracts')
          .update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('contracts')
          .insert({ ...payload, created_by: user.id }).select('id').single()
        if (error) throw error
        return data
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['contracts'])
      navigate(isEditing ? `/contracte/${id}` : `/contracte/${data.id}`)
    },
  })

  // ── Condiții plată ──
  const detectPaymentType = (data) => {
    const adv = Number(data?.advance_percent || 0)
    const del = Number(data?.delivery_percent || 0)
    if (adv > 0 && del > 0) return 'advance_delivery'
    if (adv > 0) return 'advance_term'
    return 'term'
  }

  const [selectedPaymentTemplateId, setSelectedPaymentTemplateId] = useState(null)

  // Derive paymentType from selected template
  const selectedPaymentTemplate = paymentTemplates.find(t => t.id === selectedPaymentTemplateId)
  const paymentType = selectedPaymentTemplate?.payment_type || 'term'

  // Auto-select default template when templates load (only on create)
  useEffect(() => {
    if (!isEditing && paymentTemplates.length > 0 && !selectedPaymentTemplateId) {
      const def = paymentTemplates.find(t => t.is_default) || paymentTemplates[0]
      if (def) {
        setSelectedPaymentTemplateId(def.id)
        setValue('payment_condition_template_id', def.id)
      }
    }
  }, [paymentTemplates, isEditing, selectedPaymentTemplateId, setValue])

  const selectPaymentTemplate = (template) => {
    setSelectedPaymentTemplateId(template.id)
    setValue('payment_condition_template_id', template.id)
    // Reset numeric fields based on type
    if (template.payment_type === 'term') {
      setValue('advance_percent', 0)
      setValue('delivery_percent', 0)
      setValue('invoice_term_percent', 100)
    } else if (template.payment_type === 'advance_delivery') {
      const adv = Number(watch('advance_percent')) || 30
      setValue('advance_percent', adv)
      setValue('delivery_percent', 100 - adv)
      setValue('invoice_term_percent', 0)
      setValue('invoice_term_days', 0)
      setValue('invoice_term_text', '')
    } else if (template.payment_type === 'advance_term') {
      const adv = Number(watch('advance_percent')) || 30
      setValue('advance_percent', adv)
      setValue('delivery_percent', 0)
      setValue('invoice_term_percent', 100 - adv)
      if (!watch('invoice_term_days')) setValue('invoice_term_days', 30)
      if (!watch('invoice_term_text')) setValue('invoice_term_text', 'treizeci')
    }
  }

  const DAYS_WORDS = {
    7: 'șapte', 10: 'zece', 14: 'paisprezece', 15: 'cincisprezece',
    21: 'douăzeci și una', 30: 'treizeci', 45: 'patruzeci și cinci',
    60: 'șaizeci', 90: 'nouăzeci',
  }
  const toWords = (n) => DAYS_WORDS[Number(n)] || ''

  const adv = Number(watch('advance_percent') || 0)
  const del = Number(watch('delivery_percent') || 0)
  const inv = Number(watch('invoice_term_percent') || 0)
  const invDays = Number(watch('invoice_term_days') || 0)
  const ptDays = Number(watch('payment_term_days') || 0)
  const totalPercent = adv + del + inv

  const paymentPreview = () => {
    if (!selectedPaymentTemplate) return ''
    let text = selectedPaymentTemplate.content || ''
    const ptText = watch('payment_term_text') || toWords(ptDays) || ''
    const invText = watch('invoice_term_text') || toWords(invDays) || ''
    return text
      .replace(/\{\{PAYMENT_TERM_DAYS\}\}/g, String(ptDays))
      .replace(/\{\{PAYMENT_TERM_TEXT\}\}/g, ptText)
      .replace(/\{\{ADVANCE_PERCENT\}\}/g, String(adv))
      .replace(/\{\{DELIVERY_PERCENT\}\}/g, String(del))
      .replace(/\{\{INVOICE_TERM_DAYS\}\}/g, String(invDays))
      .replace(/\{\{INVOICE_TERM_TEXT\}\}/g, invText)
      .replace(/\{\{INVOICE_TERM_PERCENT\}\}/g, String(inv))
  }

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
        <button onClick={() => navigate(-1)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
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

        {/* ── ȘABLON ── */}
        {templates.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Șablon contract</h2>
                <p className="text-xs text-gray-500">Șablonul folosit pentru generarea PDF-ului</p>
              </div>
            </div>
            <select
              {...register('template_id')}
              className={inputClass}
            >
              <option value="">— Fără șablon —</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_active ? ' ★ (activ)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── VÂNZĂTOR ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle
            icon={Building2}
            title="Vânzătorul"
            subtitle="Datele firmei dvs."
            action={
              <button
                type="button"
                onClick={handleSaveCompany}
                disabled={savingCompany}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  saveCompanySuccess
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700'
                }`}
              >
                {savingCompany ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : saveCompanySuccess ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <BookmarkCheck className="w-3.5 h-3.5" />
                )}
                {saveCompanySuccess ? 'Salvat!' : 'Salvează datele firmei'}
              </button>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Denumire *" error={errors.seller_name?.message}>
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
            <Field label="Județ">
              <input {...register('seller_county')} placeholder="ex. Iași" className={inputClass} />
            </Field>
            <Field label="Reprezentat prin">
              <input {...register('seller_representative')} placeholder="Nume Prenume" className={inputClass} />
            </Field>
            <Field label="În calitate de">
              <input {...register('seller_representative_role')} placeholder="Administrator / Director" className={inputClass} />
            </Field>
          </div>

          {companySettings?.seller_name && !isEditing && (
            <p className="mt-3 text-xs text-green-600 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Date preluate din profilul firmei salvat
            </p>
          )}
        </div>

        {/* ── CUMPĂRĂTOR ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle
            icon={User}
            title="Cumpărătorul"
            subtitle="Introdu CUI-ul și apasă ANAF pentru completare automată"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* CUI — primul câmp, cu buton ANAF */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">CUI / CIF</label>
              <div className="flex gap-2">
                <input
                  {...register('buyer_cui')}
                  placeholder="ex. 12345678 (fără RO)"
                  className={inputClass}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), lookupAnaf())}
                />
                <button
                  type="button"
                  onClick={lookupAnaf}
                  disabled={anafLoading}
                  className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {anafLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Search className="w-4 h-4" />
                  }
                  ANAF
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

            {/* Restul câmpurilor cumpărător */}
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
            <Field label="Email client">
              <input type="email" {...register('buyer_email')} placeholder="client@firma.ro" className={inputClass} />
            </Field>
            <div /> {/* spacer */}
            <Field label="Reprezentat prin">
              <input {...register('buyer_representative')} placeholder="Nume Prenume" className={inputClass} />
            </Field>
            <Field label="În calitate de">
              <input {...register('buyer_representative_role')} placeholder="Administrator / Director" className={inputClass} />
            </Field>
          </div>
        </div>

        {/* ── CONDIȚII PLATĂ ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle
            icon={CreditCard}
            title="Condiții de Plată"
            subtitle="Selectează șablonul de plată"
            action={
              <a
                href="/contracte/conditii-plata"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-300 rounded-lg hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Gestionează șabloane
              </a>
            }
          />

          {paymentTemplates.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
              <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-3">Nu există șabloane de condiții de plată.</p>
              <a href="/contracte/conditii-plata" target="_blank" className="text-xs text-primary-600 hover:underline">
                Creează primul șablon →
              </a>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 mb-6">
                {paymentTemplates.map(template => {
                  const isSelected = selectedPaymentTemplateId === template.id
                  const typeColors = {
                    term: 'bg-blue-50 text-blue-700 border-blue-200',
                    advance_delivery: 'bg-amber-50 text-amber-700 border-amber-200',
                    advance_term: 'bg-green-50 text-green-700 border-green-200',
                  }
                  const typeLabels = {
                    term: 'La termen',
                    advance_delivery: 'Avans + livrare',
                    advance_term: 'Avans + termen',
                  }
                  return (
                    <label
                      key={template.id}
                      className={`relative flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                        isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment_type"
                        className="mt-1 accent-primary-600"
                        checked={isSelected}
                        onChange={() => selectPaymentTemplate(template)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${typeColors[template.payment_type] || typeColors.term}`}>
                            {typeLabels[template.payment_type] || template.payment_type}
                          </span>
                          {template.is_default && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              implicit
                            </span>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
                        )}
                        {isSelected && (
                          <div className="mt-3">
                            {/* Inputs for TERM */}
                            {template.payment_type === 'term' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Număr zile" error={errors.payment_term_days?.message}>
                                  <input
                                    type="number"
                                    {...register('payment_term_days', {
                                      onChange: (e) => {
                                        const w = toWords(e.target.value)
                                        if (w) setValue('payment_term_text', w)
                                      }
                                    })}
                                    min="1" placeholder="30"
                                    className={inputClass}
                                  />
                                </Field>
                                <Field label="În litere">
                                  <input {...register('payment_term_text')} placeholder="treizeci" className={inputClass} />
                                </Field>
                              </div>
                            )}
                            {/* Inputs for ADVANCE_DELIVERY */}
                            {template.payment_type === 'advance_delivery' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Avans (%)">
                                  <input
                                    type="number"
                                    {...register('advance_percent', {
                                      onChange: (e) => {
                                        const a = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                                        setValue('delivery_percent', 100 - a)
                                        setValue('invoice_term_percent', 0)
                                      }
                                    })}
                                    min="0" max="100" step="1" placeholder="30"
                                    className={inputClass}
                                  />
                                </Field>
                                <Field label="Rest la livrare (%)">
                                  <input type="number" {...register('delivery_percent')} readOnly className={`${inputClass} bg-gray-50 text-gray-500`} />
                                </Field>
                              </div>
                            )}
                            {/* Inputs for ADVANCE_TERM */}
                            {template.payment_type === 'advance_term' && (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <Field label="Avans (%)">
                                    <input
                                      type="number"
                                      {...register('advance_percent', {
                                        onChange: (e) => {
                                          const a = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                                          setValue('invoice_term_percent', 100 - a)
                                          setValue('delivery_percent', 0)
                                        }
                                      })}
                                      min="0" max="100" step="1" placeholder="30"
                                      className={inputClass}
                                    />
                                  </Field>
                                  <Field label="Rest la termen (%)">
                                    <input type="number" {...register('invoice_term_percent')} readOnly className={`${inputClass} bg-gray-50 text-gray-500`} />
                                  </Field>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <Field label="Număr zile">
                                    <input
                                      type="number"
                                      {...register('invoice_term_days', {
                                        onChange: (e) => {
                                          const w = toWords(e.target.value)
                                          if (w) setValue('invoice_term_text', w)
                                        }
                                      })}
                                      min="1" placeholder="30"
                                      className={inputClass}
                                    />
                                  </Field>
                                  <Field label="În litere">
                                    <input {...register('invoice_term_text')} placeholder="treizeci" className={inputClass} />
                                  </Field>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>

              {/* Preview text contract */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-400 font-medium mb-1 uppercase tracking-wide">Text în contract</p>
                <p className="text-sm text-gray-700 italic">{paymentPreview()}</p>
              </div>

              {/* Validare total */}
              {totalPercent !== 100 && totalPercent > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-amber-600">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  Total procente: {totalPercent}% (trebuie să fie 100%)
                </div>
              )}
            </>
          )}
        </div>

        {/* ── PRODUSE ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle
            icon={Package}
            title="Produse / Servicii"
            subtitle="Opțional — folosiți shortcode-ul {{PRODUCTS_TABLE}} în șablon"
            action={
              <button
                type="button"
                onClick={addProduct}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Adaugă produs
              </button>
            }
          />

          {products.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
              <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Niciun produs adăugat</p>
              <button
                type="button"
                onClick={addProduct}
                className="mt-2 text-xs text-primary-600 hover:underline"
              >
                + Adaugă primul produs
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 px-3 py-2 uppercase tracking-wide">Denumire</th>
                      <th className="text-center text-xs font-semibold text-gray-500 px-2 py-2 uppercase tracking-wide w-20">Cant.</th>
                      <th className="text-center text-xs font-semibold text-gray-500 px-2 py-2 uppercase tracking-wide w-20">U.M.</th>
                      <th className="text-right text-xs font-semibold text-gray-500 px-2 py-2 uppercase tracking-wide w-28">Preț fără TVA</th>
                      <th className="text-center text-xs font-semibold text-gray-500 px-2 py-2 uppercase tracking-wide w-20">TVA</th>
                      <th className="text-right text-xs font-semibold text-gray-500 px-3 py-2 uppercase tracking-wide w-28">Total+TVA</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((p, idx) => {
                      const sub = (Number(p.quantity) || 0) * (Number(p.price) || 0)
                      const totalTva = sub * (1 + (Number(p.vat) || 0) / 100)
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={p.name}
                              onChange={e => updateProduct(idx, 'name', e.target.value)}
                              placeholder="Denumire produs sau serviciu"
                              className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={p.quantity}
                              onChange={e => updateProduct(idx, 'quantity', e.target.value)}
                              min="0" step="0.01"
                              className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center focus:ring-1 focus:ring-primary-500"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={p.unit}
                              onChange={e => updateProduct(idx, 'unit', e.target.value)}
                              className="w-full px-1 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-primary-500"
                            >
                              {['buc', 'kg', 'm', 'm²', 'm³', 'l', 'h', 'set', 'pachet', 'pereche'].map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={p.price}
                              onChange={e => updateProduct(idx, 'price', e.target.value)}
                              placeholder="0.00"
                              min="0" step="0.01"
                              className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:ring-1 focus:ring-primary-500"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={p.vat}
                              onChange={e => updateProduct(idx, 'vat', e.target.value)}
                              className="w-full px-1 py-1 border border-gray-200 rounded text-sm text-center focus:ring-1 focus:ring-primary-500"
                            >
                              {['0', '5', '9', '19', '21'].map(v => (
                                <option key={v} value={v}>{v}%</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-700 tabular-nums">
                            {sub > 0 ? `${totalTva.toFixed(2)}` : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => removeProduct(idx)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total general */}
              <div className="flex justify-end pt-2 border-t border-gray-200">
                <div className="text-sm">
                  <span className="text-gray-500 mr-3">Total fără TVA:</span>
                  <span className="font-semibold">
                    {products.reduce((s, p) => s + (Number(p.quantity)||0)*(Number(p.price)||0), 0).toFixed(2)} RON
                  </span>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="text-sm">
                  <span className="text-gray-500 mr-3">Total cu TVA:</span>
                  <span className="font-bold text-primary-700">
                    {products.reduce((s, p) => {
                      const sub = (Number(p.quantity)||0)*(Number(p.price)||0)
                      return s + sub * (1 + (Number(p.vat)||0)/100)
                    }, 0).toFixed(2)} RON
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── NOTE ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle icon={FileText} title="Observații" subtitle="Clauze speciale sau note interne" />
          <textarea {...register('notes')} rows={4} placeholder="Note sau clauze speciale..." className={inputClass} />
        </div>

        {mutation.isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Eroare: {mutation.error?.message}
          </div>
        )}

        <div className="flex gap-3 justify-end pb-8">
          <button type="button" onClick={() => navigate(-1)}
            className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Anulează
          </button>
          <button type="submit" disabled={isSubmitting || mutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {isSubmitting || mutation.isPending ? 'Se salvează...' : 'Salvează contractul'}
          </button>
        </div>
      </form>
    </div>
  )
}
