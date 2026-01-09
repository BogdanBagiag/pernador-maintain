import { X, Download, CheckCircle, XCircle, AlertCircle, FileText, Eye } from 'lucide-react'

export default function ViewInspectionModal({ inspection, equipment, onClose, onEdit }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'conditional':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />
      default:
        return null
    }
  }

  const getStatusLabel = (status) => {
    const labels = {
      passed: 'Promovat',
      failed: 'Respins',
      conditional: 'Condiționat'
    }
    return labels[status] || status
  }

  const getStatusColor = (status) => {
    const colors = {
      passed: 'bg-green-100 text-green-800 border-green-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      conditional: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  // Check if certificate is PDF for iframe preview
  const isPDF = inspection.certificate_url?.toLowerCase().endsWith('.pdf')
  const isImage = inspection.certificate_url?.match(/\.(jpg|jpeg|png|gif)$/i)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Detalii Inspecție
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {equipment?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold border-2 ${getStatusColor(inspection.status)}`}>
              {getStatusIcon(inspection.status)}
              <span className="ml-2">{getStatusLabel(inspection.status)}</span>
            </div>
            {onEdit && (
              <button onClick={onEdit} className="btn-secondary">
                <Eye className="w-4 h-4 mr-2" />
                Editează
              </button>
            )}
          </div>

          {/* Inspection Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Data Inspecției */}
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Data Inspecției
              </label>
              <p className="text-lg font-medium text-gray-900">
                {new Date(inspection.inspection_date).toLocaleDateString('ro-RO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>

            {/* Next Inspection */}
            {inspection.next_inspection_date && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Următoarea Scadență
                </label>
                <p className="text-lg font-medium text-gray-900">
                  {new Date(inspection.next_inspection_date).toLocaleDateString('ro-RO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            )}

            {/* Inspector */}
            {(inspection.inspector_name || inspection.inspector) && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Inspector
                </label>
                <p className="text-lg font-medium text-gray-900">
                  {inspection.inspector_name || inspection.inspector?.full_name || 'N/A'}
                </p>
              </div>
            )}

            {/* Frecvență */}
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Frecvență Inspecție
              </label>
              <p className="text-lg font-medium text-gray-900">
                {equipment?.inspection_frequency_months} {equipment?.inspection_frequency_months === 1 ? 'lună' : 'luni'}
              </p>
            </div>
          </div>

          {/* Findings / Notes */}
          {inspection.findings && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">
                Observații / Note
              </label>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-900 whitespace-pre-wrap">{inspection.findings}</p>
              </div>
            </div>
          )}

          {/* Certificate Preview/Download */}
          {inspection.certificate_url && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">
                Certificat Inspecție
              </label>
              
              {/* Download Button */}
              <div className="mb-3">
                <a
                  href={inspection.certificate_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Descarcă Certificat
                </a>
              </div>

              {/* Preview */}
              <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                {isPDF ? (
                  <iframe
                    src={inspection.certificate_url}
                    className="w-full h-[600px]"
                    title="Certificate Preview"
                  />
                ) : isImage ? (
                  <img
                    src={inspection.certificate_url}
                    alt="Certificate"
                    className="w-full h-auto"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                    <FileText className="w-16 h-16 mb-3" />
                    <p>Preview nu este disponibil pentru acest tip de fișier</p>
                    <p className="text-sm mt-1">Folosește butonul "Descarcă" de mai sus</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Created Info */}
          <div className="pt-4 border-t border-gray-200 text-sm text-gray-500">
            <p>
              Înregistrat de{' '}
              <span className="font-medium text-gray-700">
                {inspection.creator?.full_name || 'N/A'}
              </span>{' '}
              la{' '}
              <span className="font-medium text-gray-700">
                {new Date(inspection.created_at).toLocaleDateString('ro-RO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="btn-secondary">
            Închide
          </button>
        </div>
      </div>
    </div>
  )
}
