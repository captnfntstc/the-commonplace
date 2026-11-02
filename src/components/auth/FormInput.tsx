import React, { useId, useRef, useImperativeHandle } from 'react'

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  /** Icon to render on the left side of the input */
  leadingIcon?: React.ReactNode
  /** Content to render on the right side of the input (e.g. eye toggle) */
  trailingSlot?: React.ReactNode
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, hint, leadingIcon, trailingSlot, id: idProp, onClick, ...props }, ref) => {
    const generatedId = useId()
    const id = idProp ?? generatedId
    const inputRef = useRef<HTMLInputElement | null>(null)

    useImperativeHandle(ref, () => inputRef.current!)

    const handleShellClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (props.type === 'date' && inputRef.current) {
        // Prevent re-triggering if the input itself was directly clicked
        if (e.target !== inputRef.current) {
          try {
            inputRef.current.showPicker?.()
          } catch {
            inputRef.current.focus()
          }
        }
      }
    }

    const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
      if (props.type === 'date') {
        try {
          e.currentTarget.showPicker?.()
        } catch {}
      }
      onClick?.(e)
    }

    return (
      <div className="form-input-group">
        <label htmlFor={id} className="form-input-label">
          {label}
        </label>
        <div
          className={`form-input-shell ${error ? 'error' : ''} ${props.type === 'date' ? 'is-date-input' : ''}`}
          onClick={handleShellClick}
        >
          {leadingIcon && (
            <span className="form-input-leading-icon" aria-hidden="true">
              {leadingIcon}
            </span>
          )}
          <input
            ref={inputRef}
            id={id}
            className="form-input-field"
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            onClick={handleInputClick}
            {...props}
          />
          {trailingSlot && (
            <span className="form-input-trailing">
              {trailingSlot}
            </span>
          )}
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
FormInput.displayName = 'FormInput'
