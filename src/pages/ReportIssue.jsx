import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { AlertTriangle, CheckCircle, Wrench, MapPin } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ReportIssue() {
  const { equipmentId } = useParams()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    reporterName: '',
    reporterEmail: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Fetch equipment details
  const { data: equipment, isLoading } = useQuery({
    queryKey: ['equipment-public', equipmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select(`
          *,
          location:locations(name, building)
        `)
        .eq('id', equipmentId)
        .single()
      
      if (error) throw error
      return data
    },
  })

  const createWorkOrderMutation = useMutation({
    mutationFn: async (data) => {
      // Create work order without authentication (public endpoint)
      const { error } = await supabase
        .from('work_orders')
        .insert([{
          title: data.title,
          description: `${data.description}\n\n---\nReported by: ${data.reporterName}\nEmail: ${data.reporterEmail}`,
          equipment_id: equipmentId,
          priority: data.priority,
          status: 'open',
          type: 'corrective',
        }])
      
      if (error) throw error
    },
    onSuccess: () => {
      setSubmitted(true)
    },
    onError: (err) => {
      setError(err.message || 'Failed to submit report')
    },
  })

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.title.trim()) {
      setError('Please describe the issue')
      return
    }

    if (!formData.reporterName.trim()) {
      setError('Please enter your name')
      return
    }

    await createWorkOrderMutation.mutateAsync(formData)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!equipment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="card max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Equipment Not Found
          </h2>
          <p className="text-gray-600">
            The equipment you're trying to report an issue for could not be found.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="card max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Issue Reported Successfully!
          </h2>
          <p className="text-gray-600 mb-6">
            Thank you for reporting this issue. Our maintenance team has been notified and will address it as soon as possible.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left">
            <p className="text-sm font-medium text-gray-700">Equipment:</p>
            <p className="text-lg font-semibold text-gray-900">{equipment.name}</p>
            {equipment.location && (
              <p className="text-sm text-gray-600 mt-1">
                📍 {equipment.location.name}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Report Equipment Issue
          </h1>
          <p className="text-gray-600">
            Let us know what's wrong and we'll fix it
          </p>
        </div>

        {/* Equipment Info */}
        <div className="card mb-6">
          <div className="flex items-start">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
              <Wrench className="w-6 h-6 text-primary-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">{equipment.name}</h2>
              {equipment.serial_number && (
                <p className="text-sm text-gray-600 mt-1">
                  SN: {equipment.serial_number}
                </p>
              )}
              {equipment.location && (
                <div className="flex items-center text-sm text-gray-600 mt-2">
                  <MapPin className="w-4 h-4 mr-1" />
                  {equipment.location.name}
                  {equipment.location.building && ` - ${equipment.location.building}`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Report Form */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Issue Details
          </h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Issue Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                What's the problem? <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                value={formData.title}
                onChange={handleChange}
                className="input"
                placeholder="e.g., Machine won't start, Strange noise, Leaking"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Additional details
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="input"
                placeholder="Describe what happened, when it started, any error messages..."
              />
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                How urgent is this?
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="input"
              >
                <option value="low">Low - Can wait</option>
                <option value="medium">Medium - Should be fixed soon</option>
                <option value="high">High - Affecting operations</option>
                <option value="critical">Critical - Safety hazard / Total failure</option>
              </select>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Your Contact Information
              </h4>

              {/* Reporter Name */}
              <div className="mb-4">
                <label htmlFor="reporterName" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="reporterName"
                  name="reporterName"
                  type="text"
                  required
                  value={formData.reporterName}
                  onChange={handleChange}
                  className="input"
                  placeholder="John Doe"
                />
              </div>

              {/* Reporter Email */}
              <div>
                <label htmlFor="reporterEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email (optional)
                </label>
                <input
                  id="reporterEmail"
                  name="reporterEmail"
                  type="email"
                  value={formData.reporterEmail}
                  onChange={handleChange}
                  className="input"
                  placeholder="john@example.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  We'll notify you when the issue is resolved
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={createWorkOrderMutation.isLoading}
            >
              {createWorkOrderMutation.isLoading ? (
                <span className="flex items-center justify-center">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Submitting...</span>
                </span>
              ) : (
                'Submit Issue Report'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Powered by Pernador Maintain
        </p>
      </div>
    </div>
  )
}
