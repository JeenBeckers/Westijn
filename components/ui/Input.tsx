import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helpText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helpText, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-harvest-dark">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2 bg-harvest-surface border rounded text-harvest-dark
            placeholder:text-harvest-muted text-sm
            focus:outline-none focus:ring-2 focus:ring-harvest-green focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-harvest-error' : 'border-harvest-bg'}
            ${className}
          `}
          {...props}
        />
        {helpText && !error && (
          <p className="text-xs text-harvest-muted">{helpText}</p>
        )}
        {error && (
          <p className="text-xs text-harvest-error">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
