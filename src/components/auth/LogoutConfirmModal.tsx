import { AnimatePresence, motion } from 'framer-motion'
import { LogOut } from 'lucide-react'
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog'

interface LogoutConfirmModalProps {
  open: boolean
  loading?: boolean
  error?: string
  onCancel: () => void
  onConfirm: () => void
}

export function LogoutConfirmModal({
  open,
  loading = false,
  error,
  onCancel,
  onConfirm,
}: LogoutConfirmModalProps) {
  const dialogRef = useAccessibleDialog<HTMLElement>({
    open,
    onClose: onCancel,
    closeOnEscape: !loading,
  })

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="logout-confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !loading) onCancel()
          }}
        >
          <motion.section
            ref={dialogRef}
            className="logout-confirm-modal"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            tabIndex={-1}
          >
            <span className="logout-confirm-icon" aria-hidden="true">
              <LogOut />
            </span>
            <h2 id="logout-confirm-title">Sign out?</h2>
            <p>You&apos;ll be returned to the login screen.</p>
            {error && <div className="logout-confirm-error" role="alert">{error}</div>}
            <div className="logout-confirm-actions">
              <button type="button" className="logout-confirm-cancel" onClick={onCancel} disabled={loading}>
                Cancel
              </button>
              <button type="button" className="logout-confirm-submit" onClick={onConfirm} disabled={loading} autoFocus>
                {loading ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
