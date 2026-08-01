import React, { useState, useId } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  error?: string
  hint?: string
  leadingIcon?: React.ReactNode
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, hint, leadingIcon, id: idProp, ...props }, ref) => {
    const generatedId = useId()
    const id = idProp ?? generatedId
    const [visible, setVisible] = useState(false)

    return (
      <div className="form-input-group">
        <label htmlFor={id} className="form-input-label">
          {label}
        </label>
        <div className={`form-input-shell ${error ? 'error' : ''}`}>
          {leadingIcon && (
            <span className="form-input-leading-icon" aria-hidden="true">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            type={visible ? 'text' : 'password'}
            className="form-input-field"
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            {...props}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            tabIndex={0}
          >
            {visible ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </button>
        </div>
        {hint && !error && (
          <p id={`${id}-hint`} className="form-input-hint">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${id}-error`} role="alert" className="form-input-error">
            {error}
          </p>
        )}
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'
