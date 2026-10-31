import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

export interface AuthToastProps {
  message: string | null
  onClose: () => void
  type?: 'success' | 'error' | 'info'
}

export const AuthToast: React.FC<AuthToastProps> = ({ message, onClose, type }) => {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => {
      onClose()
    }, 4000)
    return () => clearTimeout(timer)
  }, [message, onClose])

  const isError =
    type === 'error' ||
    Boolean(
      message &&
        (/error/i.test(message) ||
          /no picture/i.test(message) ||
          /failed/i.test(message) ||
          /cannot/i.test(message) ||
          /unable/i.test(message) ||
          /please/i.test(message) ||
          /invalid/i.test(message))
    )

  const toastContent = (
    <AnimatePresence>
      {message && (
        <motion.div
          className="auth-toast-wrapper"
          initial={{ opacity: 0, y: -24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.95 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          role={isError ? 'alert' : 'status'}
          aria-live="polite"
        >
          <div className={`auth-toast-card ${isError ? 'error' : ''}`}>
            <div className="auth-toast-icon">
              {isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            </div>
            <span className="auth-toast-text">{message}</span>
            <button
              type="button"
              className="auth-toast-close"
              onClick={onClose}
              aria-label="Dismiss toast notification"
            >
              <X size={15} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(toastContent, document.body)
}
