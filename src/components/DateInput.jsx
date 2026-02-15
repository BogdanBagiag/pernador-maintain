import { useState, useEffect } from 'react'

/**
 * DateInput Component - Format dd/mm/yyyy
 * 
 * Convertește între formatul vizual dd/mm/yyyy și formatul ISO yyyy-mm-dd
 * pentru compatibilitate cu baza de date
 */
export default function DateInput({ 
  value, 
  onChange, 
  required = false, 
  className = '', 
  placeholder = 'dd/mm/yyyy',
  disabled = false,
  min,
  max
}) {
  // Convert ISO date (yyyy-mm-dd) to display format (dd/mm/yyyy)
  const isoToDisplay = (isoDate) => {
    if (!isoDate) return ''
    try {
      const [year, month, day] = isoDate.split('-')
      return `${day}/${month}/${year}`
    } catch {
      return ''
    }
  }

  // Convert display format (dd/mm/yyyy) to ISO (yyyy-mm-dd)
  const displayToISO = (displayDate) => {
    if (!displayDate) return ''
    try {
      // Remove any non-digit characters except /
      const cleaned = displayDate.replace(/[^\d/]/g, '')
      
      // Split by /
      const parts = cleaned.split('/')
      if (parts.length !== 3) return ''
      
      const [day, month, year] = parts
      
      // Validate
      const d = parseInt(day, 10)
      const m = parseInt(month, 10)
      const y = parseInt(year, 10)
      
      if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) {
        return ''
      }
      
      // Return ISO format
      const dayStr = day.padStart(2, '0')
      const monthStr = month.padStart(2, '0')
      return `${year}-${monthStr}-${dayStr}`
    } catch {
      return ''
    }
  }

  // Local state for display value
  const [displayValue, setDisplayValue] = useState(isoToDisplay(value))

  // Update display value when prop value changes
  useEffect(() => {
    setDisplayValue(isoToDisplay(value))
  }, [value])

  // Handle input change
  const handleChange = (e) => {
    let input = e.target.value
    
    // Remove any non-digit characters except /
    input = input.replace(/[^\d/]/g, '')
    
    // Auto-add slashes
    if (input.length === 2 && displayValue.length === 1) {
      input += '/'
    }
    if (input.length === 5 && displayValue.length === 4) {
      input += '/'
    }
    
    // Limit length to 10 characters (dd/mm/yyyy)
    if (input.length > 10) {
      input = input.substring(0, 10)
    }
    
    setDisplayValue(input)
    
    // If complete date (10 characters), convert to ISO and call onChange
    if (input.length === 10) {
      const isoDate = displayToISO(input)
      if (isoDate) {
        onChange({ target: { value: isoDate } })
      }
    } else if (input.length === 0) {
      // If cleared, propagate empty value
      onChange({ target: { value: '' } })
    }
  }

  // Handle blur - validate and format
  const handleBlur = () => {
    if (displayValue.length === 10) {
      const isoDate = displayToISO(displayValue)
      if (isoDate) {
        // Valid date - ensure it's formatted correctly
        setDisplayValue(isoToDisplay(isoDate))
      } else {
        // Invalid date - clear it
        setDisplayValue('')
        onChange({ target: { value: '' } })
      }
    } else if (displayValue.length > 0 && displayValue.length < 10) {
      // Incomplete date - clear it
      setDisplayValue('')
      onChange({ target: { value: '' } })
    }
  }

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      className={className || "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"}
      pattern="\d{2}/\d{2}/\d{4}"
      title="Format: dd/mm/yyyy (ex: 25/12/2024)"
    />
  )
}

/**
 * Helper function to get today's date in ISO format
 */
export const getTodayISO = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Helper function to format ISO date for display (dd/mm/yyyy)
 */
export const formatDateForDisplay = (isoDate) => {
  if (!isoDate) return ''
  try {
    const [year, month, day] = isoDate.split('-')
    return `${day}/${month}/${year}`
  } catch {
    return ''
  }
}

/**
 * Helper function to add days to an ISO date
 */
export const addDays = (isoDate, days) => {
  const date = new Date(isoDate)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
