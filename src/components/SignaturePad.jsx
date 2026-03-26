import { useRef, useEffect, useCallback, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  Pen, Upload, RotateCcw, Save, Trash2,
  CheckCircle, AlertCircle, Loader2, BookmarkCheck
} from 'lucide-react'

/**
 * SignaturePad
 * Props:
 *  - onSignature(dataUrl)  — callback când semnătura e gata
 *  - showSaveOption        — afișează butoanele de salvare/încărcare din cont (default true)
 *  - initialData           — semnătură preîncărcată (dataUrl)
 *  - height                — înălțimea canvas-ului (default 160)
 */
export default function SignaturePad({
  onSignature,
  showSaveOption = true,
  initialData = null,
  height = 160,
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const fileInputRef = useRef(null)
  const [mode, setMode] = useState('draw')         // 'draw' | 'upload'
  const [uploadedSig, setUploadedSig] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [hasDrawing, setHasDrawing] = useState(false)

  // ── Fetch semnătură salvată ──────────────────────────────────────
  const { data: savedSig, isLoading: loadingSaved } = useQuery({
    queryKey: ['user-signature', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_signatures')
        .select('signature_data, updated_at')
        .eq('user_id', user.id)
        .maybeSingle()
      return data
    },
    enabled: !!user && showSaveOption,
  })

  // ── Setup canvas ─────────────────────────────────────────────────
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  useEffect(() => {
    if (mode === 'draw') {
      setTimeout(setupCanvas, 50)
    }
  }, [mode, setupCanvas])

  // ── Preîncarcă semnătura dacă există ────────────────────────────
  useEffect(() => {
    if (initialData && mode === 'draw') {
      loadImageOnCanvas(initialData)
    }
  }, [initialData, mode])

  const loadImageOnCanvas = (dataUrl) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1))
      setHasDrawing(true)
      onSignature?.(dataUrl)
    }
    img.src = dataUrl
  }

  // ── Desenare ──────────────────────────────────────────────────────
  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0] || e
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }

  const startDraw = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    isDrawing.current = true
    lastPos.current = getPos(e, canvas)
  }, [])

  const draw = useCallback((e) => {
    e.preventDefault()
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
    setHasDrawing(true)
    onSignature?.(canvas.toDataURL('image/png'))
  }, [onSignature])

  const endDraw = useCallback(() => {
    isDrawing.current = false
  }, [])

  const clearCanvas = () => {
    setupCanvas()
    setHasDrawing(false)
    onSignature?.(null)
  }

  // ── Upload imagine ────────────────────────────────────────────────
  const handleUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setUploadedSig(ev.target.result)
      onSignature?.(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  const getSignatureData = () => {
    if (mode === 'upload') return uploadedSig
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.toDataURL('image/png')
  }

  // ── Salvare în cont ───────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = getSignatureData()
      if (!data) throw new Error('Nu există semnătură de salvat')
      const payload = { user_id: user.id, signature_data: data, updated_at: new Date().toISOString() }
      if (savedSig) {
        const { error } = await supabase
          .from('user_signatures')
          .update({ signature_data: data, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('user_signatures')
          .insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user-signature', user?.id])
      setSaveSuccess(true)
      setSaveError(null)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
    onError: (err) => setSaveError(err.message),
  })

  // ── Ștergere din cont ─────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('user_signatures')
        .delete()
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user-signature', user?.id])
      clearCanvas()
    },
  })

  // ── Încarcă semnătura salvată pe canvas ───────────────────────────
  const loadSavedSignature = () => {
    if (!savedSig?.signature_data) return
    if (mode !== 'draw') setMode('draw')
    setTimeout(() => loadImageOnCanvas(savedSig.signature_data), 100)
  }

  return (
    <div className="space-y-3">
      {/* Butoane mod */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('draw')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
            mode === 'draw'
              ? 'bg-primary-50 border-primary-300 text-primary-700'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Pen className="w-4 h-4" />
          Desenez
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
            mode === 'upload'
              ? 'bg-primary-50 border-primary-300 text-primary-700'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Upload className="w-4 h-4" />
          Încarc imagine
        </button>
      </div>

      {/* Canvas */}
      {mode === 'draw' && (
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-white cursor-crosshair touch-none"
            style={{ height: `${height}px`, touchAction: 'none' }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          <p className="text-xs text-gray-400 text-center mt-1.5">
            Desenați semnătura cu degetul sau mouse-ul
          </p>
          {hasDrawing && (
            <button
              type="button"
              onClick={clearCanvas}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <RotateCcw className="w-3 h-3" />
              Șterge
            </button>
          )}
        </div>
      )}

      {/* Upload */}
      {mode === 'upload' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          {uploadedSig ? (
            <div className="relative border-2 border-primary-200 rounded-xl p-4 bg-gray-50 text-center">
              <img src={uploadedSig} alt="Semnătură" className="max-h-32 mx-auto" />
              <button
                type="button"
                onClick={() => { setUploadedSig(null); onSignature?.(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="mt-2 text-xs text-red-500 hover:underline"
              >
                Șterge și reîncarcă
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-primary-400 hover:bg-primary-50 transition-colors"
              style={{ height: `${height}px` }}
            >
              <Upload className="w-8 h-8 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-600">Apasă pentru a încărca</p>
                <p className="text-xs text-gray-400">PNG, JPG</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Opțiuni salvare */}
      {showSaveOption && user && (
        <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
          <p className="text-xs font-semibold text-gray-600">Semnătura mea salvată în cont</p>

          {loadingSaved ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Se încarcă...
            </div>
          ) : savedSig ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white border border-gray-200 rounded-lg p-2">
                <img src={savedSig.signature_data} alt="Semnătură salvată" className="max-h-12 max-w-full" />
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={loadSavedSignature}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  Folosește
                </button>
                <button
                  type="button"
                  onClick={() => { if (window.confirm('Ștergi semnătura salvată?')) deleteMutation.mutate() }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Șterge
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Nu ai o semnătură salvată.</p>
          )}

          {/* Buton salvare semnătură curentă */}
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || (!hasDrawing && !uploadedSig)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saveSuccess ? 'Semnătură salvată!' : 'Salvează semnătura curentă în cont'}
          </button>

          {saveError && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {saveError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
