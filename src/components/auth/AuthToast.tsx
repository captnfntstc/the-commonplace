import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, X } from 'lucide-react'

interface AuthToastProps {
  message: string | null
  onClose: () => void
}

export const AuthToast: React.FC<AuthToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => {
      onClose()
    }, 4000)
    return () => clearTimeout(timer)
  }, [message, onClose])

  const toastContent = (
    <AnimatePresence>
      {message && (
        <motion.div
          className="auth-toast-wrapper"
          initial={{ opacity: 0, y: -24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.95 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          role="status"
          aria-live="polite"
        >
          <div className="auth-toast-card">
            <div className="auth-toast-icon">
              <CheckCircle2 size={18} />
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
