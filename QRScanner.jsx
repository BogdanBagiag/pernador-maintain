import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { X, Camera, AlertCircle, Loader2 } from 'lucide-react'

export default function QRScanner({ onClose }) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [manualCode, setManualCode] = useState('')
  const html5QrCodeRef = useRef(null)
  const navigate = useNavigate()
  const { user } = useAuth() // Check if user is authenticated

  useEffect(() => {
    startScanner()
    
    return () => {
      stopScanner()
    }
  }, [])

  const startScanner = async () => {
    try {
      setIsScanning(true)
      setError('')
      
      html5QrCodeRef.current = new Html5Qrcode("qr-reader")
      
      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleScanSuccess(decodedText)
        },
        (errorMessage) => {
          // Ignore scan errors
        }
      )
    } catch (err) {
      console.error('Camera error:', err)
      setError('Nu se poate accesa camera. Folosește input manual mai jos.')
      setIsScanning(false)
    }
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current.clear()
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
    }
  }

  const handleScanSuccess = async (qrCodeText) => {
    await stopScanner()
    setIsScanning(false)
    
    // Extract ID and determine type from QR code
    let id = qrCodeText.trim()
    let type = 'equipment' // default
    
    // Format 1: Query parameter (?equipment= or ?location=)
    if (qrCodeText.includes('?equipment=')) {
      const match = qrCodeText.match(/[?&]equipment=([a-f0-9-]+)/)
      if (match) {
        id = match[1]
        type = 'equipment'
      }
    } else if (qrCodeText.includes('?location=')) {
      const match = qrCodeText.match(/[?&]location=([a-f0-9-]+)/)
      if (match) {
        id = match[1]
        type = 'location'
      }
    }
    // Format 2: URL path
    else if (qrCodeText.includes('/equipment/') || qrCodeText.includes('/report/')) {
      const match = qrCodeText.match(/\/(equipment|report)\/([a-f0-9-]+)/)
      if (match) {
        id = match[2]
        type = 'equipment'
      }
    } else if (qrCodeText.includes('/locations/')) {
      const match = qrCodeText.match(/\/locations\/([a-f0-9-]+)/)
      if (match) {
        id = match[1]
        type = 'location'
      }
    }
    // Format 3: JSON
    else if (qrCodeText.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(qrCodeText)
        id = parsed.id || parsed.equipment_id || parsed.location_id || qrCodeText
        type = parsed.type || (parsed.location_id ? 'location' : 'equipment')
      } catch (e) {
        // Use raw text if JSON parse fails
      }
    }
    // Format 4: Direct ID - need to determine type by checking database
    
    setSuccess('QR scanat! Verificare...')
    
    // Try to find in equipment first, then location
    let item = null
    let itemType = type
    
    if (type === 'equipment') {
      const { data: equipment } = await supabase
        .from('equipment')
        .select('id, name')
        .eq('id', id)
        .single()
      
      if (equipment) {
        item = equipment
        itemType = 'equipment'
      }
    }
    
    if (!item && (type === 'location' || type === 'equipment')) {
      const { data: location } = await supabase
        .from('locations')
        .select('id, name')
        .eq('id', id)
        .single()
      
      if (location) {
        item = location
        itemType = 'location'
      }
    }
    
    if (!item) {
      setError('Element negăsit! Verifică codul QR și încearcă din nou.')
      setSuccess('')
      setTimeout(() => {
        setError('')
        startScanner()
      }, 2000)
      return
    }
    
    setSuccess(`✅ ${item.name} identificat!`)
    
    // Smart redirect based on authentication status
    setTimeout(() => {
      if (user) {
        // AUTHENTICATED: Go to detail page to see full info
        if (itemType === 'location') {
          navigate(`/locations/${item.id}`)
        } else {
          navigate(`/equipment/${item.id}`)
        }
      } else {
        // UNAUTHENTICATED: Go directly to public report form
        if (itemType === 'location') {
          navigate(`/report-issue?location=${item.id}`)
        } else {
          navigate(`/report/${item.id}`)
        }
      }
      onClose()
    }, 1000)
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    
    await stopScanner()
    await handleScanSuccess(manualCode.trim())
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Camera className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold">Scanează QR Code</h2>
          </div>
          <button
            onClick={() => {
              stopScanner()
              onClose()
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scanner Area */}
        <div className="space-y-4">
          {/* QR Scanner */}
          <div className="relative bg-gray-100 rounded-lg overflow-hidden">
            <div id="qr-reader" className="w-full"></div>
            
            {isScanning && (
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Scanare în curs...</span>
                </div>
              </div>
            )}
          </div>

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              <span className="text-sm font-medium">{success}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Manual Input Fallback */}
          <div className="border-t pt-4">
            <p className="text-sm text-gray-600 mb-3">
              Camera nu funcționează? Introdu codul manual:
            </p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="ID echipament sau locație"
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Caută
              </button>
            </form>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              💡 <strong>Instrucțiuni:</strong> Scanează QR code-ul de pe echipament sau locație.
              {user ? (
                <span> Vei vedea detaliile complete și poți raporta probleme.</span>
              ) : (
                <span> Vei putea raporta probleme direct, fără autentificare.</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
