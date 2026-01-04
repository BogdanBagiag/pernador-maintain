import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { Download, Printer } from 'lucide-react'

export default function QRCodeGenerator({ equipmentId, equipmentName }) {
  const canvasRef = useRef(null)
  const reportUrl = `${window.location.origin}/report/${equipmentId}`

  useEffect(() => {
    if (canvasRef.current && equipmentId) {
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
  }, [equipmentId, reportUrl])

  const handleDownload = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `QR-${equipmentName || equipmentId}.png`
      link.href = url
      link.click()
    }
  }

  const handlePrint = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const printWindow = window.open('', '_blank')
    const img = canvas.toDataURL('image/png')
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${equipmentName || 'Equipment'}</title>
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
            <h2>${equipmentName || 'Equipment'}</h2>
            <img src="${img}" alt="QR Code" />
            <p>Scan to report issue</p>
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

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">QR Code</h3>
      
      <div className="flex flex-col items-center">
        <canvas ref={canvasRef} className="border border-gray-200 rounded-lg" />
        
        <p className="text-sm text-gray-600 mt-4 text-center">
          Scan this code to report issues with this equipment
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
    </div>
  )
}
