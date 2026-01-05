import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import { X, Camera, AlertCircle, Loader2 } from 'lucide-react'

export default function QRScanner({ onClose }) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [manualCode, setManualCode] = useState('')
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)
  const navigate = useNavigate()

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
        { facingMode: "environment" }, // Use back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleScanSuccess(decodedText)
        },
        (errorMessage) => {
          // Ignore scan errors (happens continuously)
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
    // Stop scanning immediately
    await stopScanner()
    setIsScanning(false)
    
    console.log('QR Code scanned:', qrCodeText)
    
    // Try to extract equipment ID from QR code
    // Format could be: equipment_id or full URL or custom format
    let equipmentId = qrCodeText
    
    // If QR contains URL, extract ID
    if (qrCodeText.includes('/equipment/')) {
      const match = qrCodeText.match(/\/equipment\/([a-f0-9-]+)/)
      if (match) equipmentId = match[1]
    }
    
    // Verify equipment exists
    setSuccess('QR scanat! Verificare...')
    
    const { data: equipment, error: dbError } = await supabase
      .from('equipment')
      .select('id, name, serial_number')
      .eq('id', equipmentId)
      .single()
    
    if (dbError || !equipment) {
      setError('Echipament negăsit! Verifică codul QR.')
      setSuccess('')
      // Restart scanner
      setTimeout(() => {
        setError('')
        startScanner()
      }, 2000)
      return
    }
    
    setSuccess(`✅ ${equipment.name} identificat!`)
    
    // Navigate to equipment detail
    setTimeout(() => {
      navigate(`/equipment/${equipment.id}`)
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
                placeholder="ID echipament sau cod QR"
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
              💡 <strong>Instrucțiuni:</strong> Poziționează QR code-ul echipamentului în cadru. 
              Scanarea se face automat.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
