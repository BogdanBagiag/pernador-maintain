import { useState } from 'react'
import { Camera, QrCode, Info, ShieldOff } from 'lucide-react'
import QRScanner from '../components/QRScanner'
import { usePermissions } from '../contexts/PermissionsContext'

export default function ScanPage() {
  const { canView } = usePermissions()
  const pView = canView('qr_scan')
  const [showScanner, setShowScanner] = useState(false)

  if (!pView) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <ShieldOff className="w-14 h-14 text-gray-300" />
      <p className="text-lg font-semibold text-gray-500">Acces restricționat</p>
      <p className="text-sm text-gray-400">Nu ai permisiunea de a accesa Scanarea QR.</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <QrCode className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Scanare QR Code</h1>
        </div>
        <p className="text-gray-600">
          Identifică rapid echipamentele și locațiile prin scanarea codului QR
        </p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {/* Info Section */}
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Cum funcționează:</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <span>Click pe butonul "Deschide Camera" de mai jos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <span>Permite accesul la cameră când browser-ul solicită</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <span>Poziționează QR code-ul în cadru</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">4.</span>
                  <span>Scanarea se face automat - vei fi redirecționat la detalii</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Scan Button */}
        <div className="text-center">
          <button
            onClick={() => setShowScanner(true)}
            className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
          >
            <Camera className="w-6 h-6" />
            Deschide Camera
          </button>
        </div>

        {/* Features Grid */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="text-center p-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Identificare Rapidă</h3>
            <p className="text-sm text-gray-600">
              Scanează echipamente și locații în secunde
            </p>
          </div>

          <div className="text-center p-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Camera className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Acces Instant</h3>
            <p className="text-sm text-gray-600">
              Vezi imediat detalii, probleme și istoric
            </p>
          </div>

          <div className="text-center p-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Info className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Input Manual</h3>
            <p className="text-sm text-gray-600">
              Dacă camera nu funcționează, poți introduce codul manual
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 border-t pt-6">
          <h3 className="font-semibold text-gray-900 mb-3">💡 Sfaturi:</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Asigură-te că QR code-ul este curat și vizibil</li>
            <li>• Folosește lumină naturală sau bună iluminare</li>
            <li>• Ține telefonul stabil pentru scanare mai rapidă</li>
            <li>• Fiecare echipament și locație are QR code unic</li>
          </ul>
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner onClose={() => setShowScanner(false)} />
      )}
    </div>
  )
}
