import { useState, useRef, useEffect } from 'react'
import { X, Printer, Download } from 'lucide-react'
import QRCode from 'qrcode'

export default function QRCodeBulkPrint({ equipment, onClose }) {
  const [codesPerPage, setCodesPerPage] = useState(4) // Default, will be auto-adjusted
  const [isGenerating, setIsGenerating] = useState(false)
  const [qrCodes, setQrCodes] = useState({})
  const printRef = useRef()

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = () => {
    // This will trigger the browser's print dialog with "Save as PDF" option
    window.print()
  }

  // Generate QR code data URL
  const generateQRCode = async (equipmentId) => {
    try {
      // Use /report/ URL to match existing QR code structure
      const url = `${window.location.origin}/report/${equipmentId}`
      return await QRCode.toDataURL(url, {
        width: 800,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
    } catch (error) {
      console.error('Error generating QR code:', error)
      return null
    }
  }

  // Generate all QR codes on mount
  useEffect(() => {
    const loadQRCodes = async () => {
      console.log(`🔄 Starting QR generation for ${equipment.length} equipment items`)
      setIsGenerating(true)
      const codes = {}
      
      for (const eq of equipment) {
        try {
          codes[eq.id] = await generateQRCode(eq.id)
          console.log(`✅ Generated QR for: ${eq.name} (${eq.id})`)
        } catch (error) {
          console.error(`❌ Failed to generate QR for: ${eq.name} (${eq.id})`, error)
        }
      }
      
      setQrCodes(codes)
      setIsGenerating(false)
      console.log(`✨ QR generation complete: ${Object.keys(codes).length} / ${equipment.length} codes`)
    }
    loadQRCodes()
    
    // Auto-select optimal layout
    const findOptimalLayout = () => {
      const count = equipment.length
      // Try to find a layout that divides evenly
      for (const option of [8, 6, 4, 2]) {
        if (count % option === 0) {
          console.log(`📐 Auto-selected ${option} per page (divides evenly)`)
          return option
        }
      }
      // If no exact match, choose the smallest that fits all
      if (count <= 2) return 2
      if (count <= 4) return 4
      if (count <= 6) return 6
      console.log(`📐 Auto-selected 8 per page (default for ${count} items)`)
      return 8 // For larger counts, use 8
    }
    
    setCodesPerPage(findOptimalLayout())
  }, [equipment])

  // Get layout configuration based on codes per page
  const getLayoutConfig = () => {
    switch (codesPerPage) {
      case 2:
        return { cols: 1, rows: 2, size: 'large' } // Large QR codes
      case 4:
        return { cols: 2, rows: 2, size: 'medium' }
      case 6:
        return { cols: 2, rows: 3, size: 'medium' }
      case 8:
        return { cols: 2, rows: 4, size: 'small' }
      default:
        return { cols: 2, rows: 2, size: 'medium' }
    }
  }

  const layout = getLayoutConfig()

  // Split equipment into pages
  const pages = []
  for (let i = 0; i < equipment.length; i += codesPerPage) {
    pages.push(equipment.slice(i, i + codesPerPage))
  }
  
  // Debug logging pentru paginare
  console.log(`📄 Pages breakdown:`, pages.map((p, i) => `Page ${i+1}: ${p.length} items`).join(', '))

  // Get QR code size classes
  const getSizeClasses = () => {
    switch (layout.size) {
      case 'large':
        return 'w-64 h-64'
      case 'medium':
        return 'w-48 h-48'
      case 'small':
        return 'w-40 h-40'
      default:
        return 'w-48 h-48'
    }
  }

  const getContainerPadding = () => {
    switch (layout.size) {
      case 'large':
        return 'p-8'
      case 'medium':
        return 'p-6'
      case 'small':
        return 'p-4'
      default:
        return 'p-6'
    }
  }

  return (
    <>
      {/* Modal for configuration */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:hidden">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Printare Coduri QR în Masă
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Equipment count */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>{equipment.length}</strong> echipamente selectate
              </p>
              <p className="text-xs text-blue-700 mt-1">
                {Object.keys(qrCodes).length} coduri QR generate
              </p>
            </div>

            {/* Layout selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Coduri QR per pagină A4
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[2, 4, 6, 8].map((count) => {
                  const wouldBeOptimal = equipment.length % count === 0 || 
                                         (equipment.length <= count && equipment.length > 0)
                  return (
                    <button
                      key={count}
                      onClick={() => setCodesPerPage(count)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        codesPerPage === count
                          ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-300'
                          : wouldBeOptimal
                          ? 'border-green-300 bg-green-50 hover:border-green-400'
                          : 'border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900 mb-1">
                          {count}
                        </div>
                        <div className="text-xs text-gray-600">
                          {count === 2 && 'Mari (2 pe pagină)'}
                          {count === 4 && 'Medii (2x2)'}
                          {count === 6 && 'Medii (2x3)'}
                          {count === 8 && 'Mici (2x4)'}
                        </div>
                        {wouldBeOptimal && (
                          <div className="text-xs text-green-600 mt-1 font-medium">
                            ✓ Recomandat
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Alege un număr care divide uniform cele {equipment.length} echipamente pentru rezultate optime
              </p>
            </div>

            {/* Preview info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Total pagini:</strong> {pages.length}
              </p>
              <div className="text-sm text-gray-600 space-y-1">
                <p className="font-medium">Distribuție pe pagini:</p>
                {pages.map((page, idx) => (
                  <div key={idx} className="flex justify-between text-xs pl-2">
                    <span>Pagina {idx + 1}:</span>
                    <span className="font-mono">{page.length} / {codesPerPage} coduri</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Layout: {layout.cols} coloane × {layout.rows} rânduri maximum per pagină
              </p>
              
              {/* Warning pentru coduri lipsă */}
              {Object.keys(qrCodes).length < equipment.length && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-xs text-yellow-800">
                    ⚠️ {equipment.length - Object.keys(qrCodes).length} coduri QR încă se generează...
                  </p>
                </div>
              )}
            </div>

            {isGenerating && (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-sm text-gray-600 mt-2">Generare coduri QR...</p>
              </div>
            )}
          </div>

          <div className="p-6 border-t bg-gray-50 flex gap-3">
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Anulează
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGenerating || Object.keys(qrCodes).length < equipment.length}
              className="btn-secondary flex-1 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5 mr-2" />
              Salvează PDF
            </button>
            <button
              onClick={handlePrint}
              disabled={isGenerating || Object.keys(qrCodes).length < equipment.length}
              className="btn-primary flex-1 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-5 h-5 mr-2" />
              Printează
            </button>
          </div>
        </div>
      </div>

      {/* Print content */}
      <div ref={printRef} className="hidden print:block">
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 10mm;
            }
            
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            body {
              margin: 0;
              padding: 0;
            }
            
            .print-page {
              page-break-after: always;
              page-break-inside: avoid;
              width: 100%;
              display: block;
            }
            
            .print-page:last-child {
              page-break-after: auto;
            }
            
            .qr-grid {
              display: grid;
              gap: 1rem;
              width: 100%;
            }
            
            .qr-item {
              break-inside: avoid;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            
            .qr-item * {
              max-width: 100%;
            }
          }
        `}</style>

        {pages.map((pageEquipment, pageIndex) => (
          <div key={pageIndex} className="print-page">
            <div
              className="qr-grid"
              style={{
                gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
              }}
            >
              {pageEquipment.map((eq) => {
                if (!qrCodes[eq.id]) {
                  console.warn(`Missing QR code for equipment ${eq.id}:`, eq.name)
                  return null
                }
                
                return (
                  <div
                    key={eq.id}
                    className={`qr-item ${getContainerPadding()} border-2 border-dashed border-gray-300`}
                  >
                    <img
                      src={qrCodes[eq.id]}
                      alt={`QR Code for ${eq.name}`}
                      className={`${getSizeClasses()} object-contain`}
                      style={{ display: 'block', margin: '0 auto' }}
                    />
                    <div className="mt-3 text-center space-y-1" style={{ width: '100%' }}>
                      <p 
                        className="font-bold text-gray-900 break-words" 
                        style={{ 
                          fontSize: layout.size === 'small' ? '12px' : '14px',
                          lineHeight: '1.4',
                          margin: '0 0 4px 0'
                        }}
                      >
                        {eq.name}
                      </p>
                      {eq.inventory_number && (
                        <p 
                          className="text-gray-600" 
                          style={{ 
                            fontSize: layout.size === 'small' ? '10px' : '11px',
                            lineHeight: '1.3',
                            margin: '2px 0'
                          }}
                        >
                          Inv: {eq.inventory_number}
                        </p>
                      )}
                      {eq.serial_number && (
                        <p 
                          className="text-gray-600" 
                          style={{ 
                            fontSize: layout.size === 'small' ? '10px' : '11px',
                            lineHeight: '1.3',
                            margin: '2px 0'
                          }}
                        >
                          S/N: {eq.serial_number}
                        </p>
                      )}
                      {eq.manufacturer && eq.model && (
                        <p 
                          className="text-gray-500" 
                          style={{ 
                            fontSize: layout.size === 'small' ? '9px' : '10px',
                            lineHeight: '1.3',
                            margin: '2px 0'
                          }}
                        >
                          {eq.manufacturer} {eq.model}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
