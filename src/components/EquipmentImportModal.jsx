import { useState } from 'react'
import { X, Upload, ArrowRight, Check, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

export default function EquipmentImportModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const [step, setStep] = useState(1) // 1: Upload, 2: Mapping, 3: Preview, 4: Import
  const [file, setFile] = useState(null)
  const [excelColumns, setExcelColumns] = useState([])
  const [excelData, setExcelData] = useState([])
  const [columnMapping, setColumnMapping] = useState({})
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState(null)

  const requiredFields = [
    { key: 'name', label: 'Name *', required: true },
    { key: 'serial_number', label: 'Serial Number', required: false },
    { key: 'inventory_number', label: 'Nr. Inventar', required: false },
    { key: 'model', label: 'Model', required: false },
    { key: 'manufacturer', label: 'Manufacturer', required: false },
    { key: 'location_name', label: 'Location (will create if not exists)', required: false },
    { key: 'purchase_date', label: 'Purchase Date (YYYY-MM-DD)', required: false },
    { key: 'warranty_expiry', label: 'Warranty Expiry (YYYY-MM-DD)', required: false },
    { key: 'status', label: 'Status (operational/maintenance/retired)', required: false },
    { key: 'notes', label: 'Notes', required: false },
  ]

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0]
    if (!uploadedFile) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        if (data.length < 2) {
          alert('Excel file must have at least a header row and one data row')
          return
        }

        const headers = data[0]
        const rows = data.slice(1).filter(row => row.some(cell => cell !== null && cell !== ''))

        setExcelColumns(headers)
        setExcelData(rows)
        setFile(uploadedFile)
        
        // Auto-map columns based on name similarity
        const autoMapping = {}
        headers.forEach((header, index) => {
          const headerLower = (header || '').toString().toLowerCase().trim()
          const match = requiredFields.find(field => 
            headerLower === field.key.toLowerCase() ||
            headerLower === field.label.toLowerCase() ||
            headerLower.includes(field.key.toLowerCase())
          )
          if (match) {
            autoMapping[match.key] = index
          }
        })
        setColumnMapping(autoMapping)
        setStep(2)
      } catch (error) {
        console.error('Error reading Excel:', error)
        alert('Error reading Excel file. Please check the file format.')
      }
    }
    reader.readAsBinaryString(uploadedFile)
  }

  const handleMapping = (fieldKey, columnIndex) => {
    setColumnMapping(prev => ({
      ...prev,
      [fieldKey]: columnIndex === '' ? undefined : parseInt(columnIndex)
    }))
  }

  const validateMapping = () => {
    return columnMapping.name !== undefined
  }

  const getPreviewData = () => {
    return excelData.slice(0, 5).map(row => {
      const mapped = {}
      Object.keys(columnMapping).forEach(key => {
        const colIndex = columnMapping[key]
        if (colIndex !== undefined) {
          mapped[key] = row[colIndex]
        }
      })
      return mapped
    })
  }

  const handleImport = async () => {
    setImporting(true)
    const results = { success: 0, failed: 0, errors: [] }

    try {
      // Get existing locations
      const { data: existingLocations } = await supabase
        .from('locations')
        .select('id, name')

      const locationMap = {}
      existingLocations?.forEach(loc => {
        locationMap[loc.name.toLowerCase()] = loc.id
      })

      for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i]
        
        try {
          const equipment = {}
          
          // Map all columns
          Object.keys(columnMapping).forEach(key => {
            const colIndex = columnMapping[key]
            if (colIndex !== undefined && row[colIndex] !== undefined && row[colIndex] !== '') {
              equipment[key] = row[colIndex]
            }
          })

          // Validate required fields
          if (!equipment.name || equipment.name.trim() === '') {
            results.failed++
            results.errors.push(`Row ${i + 2}: Name is required`)
            continue
          }

          // Handle location
          let locationId = null
          if (equipment.location_name) {
            const locationNameLower = equipment.location_name.toLowerCase()
            
            if (locationMap[locationNameLower]) {
              locationId = locationMap[locationNameLower]
            } else {
              // Create new location
              const { data: newLocation, error: locError } = await supabase
                .from('locations')
                .insert([{ 
                  name: equipment.location_name,
                  created_by: user.id 
                }])
                .select()
                .single()

              if (locError) {
                results.failed++
                results.errors.push(`Row ${i + 2}: Failed to create location: ${locError.message}`)
                continue
              }

              locationId = newLocation.id
              locationMap[locationNameLower] = locationId
            }
          }

          // Validate status
          if (equipment.status) {
            const validStatuses = ['operational', 'maintenance', 'retired']
            if (!validStatuses.includes(equipment.status.toLowerCase())) {
              equipment.status = 'operational'
            } else {
              equipment.status = equipment.status.toLowerCase()
            }
          } else {
            equipment.status = 'operational'
          }

          // Prepare equipment data
          const equipmentData = {
            name: equipment.name.trim(),
            status: equipment.status,
            created_by: user.id
          }

          // Only add optional fields if they exist in mapping
          if (equipment.serial_number) equipmentData.serial_number = equipment.serial_number.toString().trim()
          if (equipment.inventory_number) equipmentData.inventory_number = equipment.inventory_number.toString().trim()
          if (equipment.model) equipmentData.model = equipment.model.toString().trim()
          if (equipment.manufacturer) equipmentData.manufacturer = equipment.manufacturer.toString().trim()
          if (locationId) equipmentData.location_id = locationId
          if (equipment.purchase_date) equipmentData.purchase_date = equipment.purchase_date
          if (equipment.warranty_expiry) equipmentData.warranty_expiry = equipment.warranty_expiry
          if (equipment.notes) equipmentData.notes = equipment.notes

          // Insert equipment
          const { error: eqError } = await supabase
            .from('equipment')
            .insert([equipmentData])

          if (eqError) {
            results.failed++
            results.errors.push(`Row ${i + 2}: ${eqError.message}`)
          } else {
            results.success++
          }

        } catch (error) {
          results.failed++
          results.errors.push(`Row ${i + 2}: ${error.message}`)
        }
      }

      setImportResults(results)
      setStep(4)

    } catch (error) {
      console.error('Import error:', error)
      alert('Import failed: ' + error.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Import Equipment from Excel</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-8">
            {['Upload', 'Map Columns', 'Preview', 'Import'].map((label, index) => (
              <div key={index} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step > index + 1 ? 'bg-green-600 text-white' :
                  step === index + 1 ? 'bg-blue-600 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {step > index + 1 ? <Check className="w-5 h-5" /> : index + 1}
                </div>
                <span className={`ml-2 text-sm font-medium ${step === index + 1 ? 'text-blue-600' : 'text-gray-600'}`}>
                  {label}
                </span>
                {index < 3 && <ArrowRight className="w-4 h-4 mx-4 text-gray-400" />}
              </div>
            ))}
          </div>

          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">Upload Excel File</p>
                <p className="text-sm text-gray-600 mb-4">
                  Select an .xlsx file with equipment data
                </p>
                <label className="btn-primary cursor-pointer inline-block">
                  Choose File
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 mb-2">Excel Format Requirements:</p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• First row must contain column headers</li>
                  <li>• At minimum, include a "Name" column (required)</li>
                  <li>• Dates should be in YYYY-MM-DD format</li>
                  <li>• Status should be: operational, maintenance, or retired</li>
                  <li>• Locations will be created automatically if they don't exist</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <p className="text-gray-600 mb-4">
                  Map your Excel columns to equipment fields. Fields marked with * are required.
                </p>
                <div className="space-y-3">
                  {requiredFields.map(field => (
                    <div key={field.key} className="flex items-center gap-4">
                      <label className="w-1/3 text-sm font-medium text-gray-700">
                        {field.label}
                      </label>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <select
                        value={columnMapping[field.key] ?? ''}
                        onChange={(e) => handleMapping(field.key, e.target.value)}
                        className="flex-1 input"
                      >
                        <option value="">-- Do not import --</option>
                        {excelColumns.map((col, index) => (
                          <option key={index} value={index}>
                            {col || `Column ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <button onClick={() => setStep(1)} className="btn-secondary">
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!validateMapping()}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next: Preview
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <p className="text-gray-600 mb-4">Preview of first 5 rows:</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(columnMapping).filter(k => columnMapping[k] !== undefined).map(key => (
                          <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                            {requiredFields.find(f => f.key === key)?.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getPreviewData().map((row, index) => (
                        <tr key={index}>
                          {Object.keys(columnMapping).filter(k => columnMapping[k] !== undefined).map(key => (
                            <td key={key} className="px-4 py-2 text-sm text-gray-900">
                              {row[key] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Total rows to import: {excelData.length}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <button onClick={() => setStep(2)} className="btn-secondary" disabled={importing}>
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="btn-primary inline-flex items-center"
                >
                  {importing ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Importing...</span>
                    </>
                  ) : (
                    'Start Import'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Results */}
          {step === 4 && importResults && (
            <div className="space-y-6">
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                  importResults.failed === 0 ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  {importResults.failed === 0 ? (
                    <Check className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-yellow-600" />
                  )}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Import Complete</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="card bg-green-50 border-green-200">
                  <p className="text-sm text-green-600 font-medium">Successfully Imported</p>
                  <p className="text-3xl font-bold text-green-900">{importResults.success}</p>
                </div>
                <div className="card bg-red-50 border-red-200">
                  <p className="text-sm text-red-600 font-medium">Failed</p>
                  <p className="text-3xl font-bold text-red-900">{importResults.failed}</p>
                </div>
              </div>

              {importResults.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <p className="text-sm font-medium text-red-900 mb-2">Errors:</p>
                  <ul className="text-sm text-red-800 space-y-1">
                    {importResults.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <button
                  onClick={() => {
                    onSuccess?.()
                    onClose()
                  }}
                  className="btn-primary"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
