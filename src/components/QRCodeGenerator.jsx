import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { Download, Printer } from 'lucide-react'

export default function QRCodeGenerator({ id, name, type = 'equipment', equipmentId, equipmentName }) {
  const canvasRef = useRef(null)
  
  // Support old props for backward compatibility
  const actualId = id || equipmentId
  const actualName = name || equipmentName
  const actualType = type
  
  // Generate URL based on type
  const reportUrl = actualType === 'location' 
    ? `${window.location.origin}/locations/${actualId}`
    : `${window.location.origin}/report/${actualId}`

  useEffect(() => {
    if (canvasRef.current && actualId) {
      QRCode.toCanvas(
        canvasRef.current,
        reportUrl,
        {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        },
        (error) => {
          if (error) console.error('Error generating QR code:', error)
        }
      )
    }
  }, [actualId, reportUrl])

  const handleDownload = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `QR-${actualName || actualId}.png`
      link.href = url
      link.click()
    }
  }

  const handlePrint = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const printWindow = window.open('', '_blank')
    const img = canvas.toDataURL('image/png')
    const typeLabel = actualType === 'location' ? 'Locație' : 'Echipament'
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${actualName || typeLabel}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              font-family: Arial, sans-serif;
            }
            .qr-container {
              text-align: center;
              border: 2px solid #000;
              padding: 20px;
              display: inline-block;
            }
            h2 {
              margin: 0 0 10px 0;
              font-size: 24px;
            }
            .type-label {
              font-size: 12px;
              color: #666;
              margin-bottom: 10px;
            }
            p {
              margin: 10px 0 0 0;
              font-size: 14px;
              color: #666;
            }
            img {
              display: block;
              margin: 10px auto;
            }
            @media print {
              body {
                padding: 0;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="type-label">${typeLabel}</div>
            <h2>${actualName || typeLabel}</h2>
            <img src="${img}" alt="QR Code" />
            <p>Scanează pentru a raporta probleme</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 100);
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const typeLabel = actualType === 'location' ? 'această locație' : 'acest echipament'

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} className="border border-gray-200 rounded-lg" />
      
      <p className="text-sm text-gray-600 mt-4 text-center">
        Scanează acest cod pentru a raporta probleme cu {typeLabel}
      </p>

      <div className="flex items-center space-x-3 mt-4">
        <button
          onClick={handleDownload}
          className="btn-secondary inline-flex items-center"
        >
          <Download className="w-4 h-4 mr-2" />
          Download
        </button>
        <button
          onClick={handlePrint}
          className="btn-secondary inline-flex items-center"
        >
          <Printer className="w-4 h-4 mr-2" />
          Print
        </button>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg w-full">
        <p className="text-xs text-gray-500 font-mono break-all">
          {reportUrl}
        </p>
      </div>
    </div>
  )
}
