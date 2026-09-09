import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Flag } from 'lucide-react'

type ReportTargetType = 'profile' | 'post' | 'comment' | 'reply'

const REPORT_REASONS: Record<ReportTargetType, Array<{ value: string; label: string }>> = {
  profile: [
    { value: 'harassment_or_bullying', label: 'Harassment or bullying' },
    { value: 'hate_or_discrimination', label: 'Hate or discrimination' },
    { value: 'impersonation', label: 'Impersonation' },
    { value: 'spam_or_scam', label: 'Spam, scam, or suspicious behavior' },
    { value: 'underage_user', label: 'User may be under 16' },
    { value: 'self_harm_concern', label: 'Concern for their immediate safety' },
    { value: 'other', label: 'Something else' },
  ],
  post: [
    { value: 'harassment_or_bullying', label: 'Harassment or bullying' },
    { value: 'hate_or_discrimination', label: 'Hate or discrimination' },
    { value: 'sexual_content', label: 'Sexual or exploitative content' },
    { value: 'violence_or_threats', label: 'Violence or credible threats' },
    { value: 'privacy_violation', label: 'Privacy violation or personal information' },
    { value: 'spam_or_scam', label: 'Spam, scam, or misleading content' },
    { value: 'copyright', label: 'Copyright or intellectual property concern' },
    { value: 'self_harm_concern', label: 'Self-harm or suicide concern' },
    { value: 'other', label: 'Something else' },
  ],
  comment: [
    { value: 'harassment_or_bullying', label: 'Harassment or bullying' },
    { value: 'hate_or_discrimination', label: 'Hate or discrimination' },
    { value: 'sexual_content', label: 'Sexual or exploitative content' },
    { value: 'violence_or_threats', label: 'Violence or credible threats' },
    { value: 'privacy_violation', label: 'Privacy violation or personal information' },
    { value: 'spam_or_scam', label: 'Spam, scam, or misleading content' },
    { value: 'other', label: 'Something else' },
  ],
  reply: [
    { value: 'harassment_or_bullying', label: 'Harassment or bullying' },
    { value: 'hate_or_discrimination', label: 'Hate or discrimination' },
    { value: 'sexual_content', label: 'Sexual or exploitative content' },
    { value: 'violence_or_threats', label: 'Violence or credible threats' },
    { value: 'privacy_violation', label: 'Privacy violation or personal information' },
    { value: 'spam_or_scam', label: 'Spam, scam, or misleading content' },
    { value: 'other', label: 'Something else' },
  ],
}

interface ReportDialogProps {
  open: boolean
  targetType: ReportTargetType
  targetLabel: string
  onClose: () => void
  onSubmit: (reason: string, details: string) => Promise<void>
}

export const ReportDialog: React.FC<ReportDialogProps> = ({
  open,
  targetType,
  targetLabel,
  onClose,
  onSubmit,
}) => {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const closeAndReset = () => {
    setReason('')
    setDetails('')
    setError('')
    onClose()
  }

  if (!open) return null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!reason) {
      setError('Choose a reason for your report.')
      return
    }
    try {
      setLoading(true)
      setError('')
      await onSubmit(reason, details.trim())
      setReason('')
      setDetails('')
    } catch (submitError) {
      setError((submitError as Error)?.message || 'Unable to submit this report.')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop report-dialog-backdrop" onClick={() => !loading && closeAndReset()}>
      <form
        className="settings-modal report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="report-dialog-icon"><Flag aria-hidden="true" /></div>
        <h2 id="report-dialog-title">Report {targetType}</h2>
        <p>
          Tell us what is wrong with <strong>{targetLabel}</strong>. Reports are private and will be queued for review.
        </p>

        <label htmlFor="report-reason">Reason</label>
        <select
          id="report-reason"
          className="dark-setting-input"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
            setError('')
          }}
          required
        >
          <option value="">Select a reason</option>
          {REPORT_REASONS[targetType].map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <label htmlFor="report-details">Additional details <span>(optional)</span></label>
        <textarea
          id="report-details"
          className="dark-setting-textarea"
          rows={4}
          maxLength={1000}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Share enough context to help a reviewer understand what happened."
        />
        <span className="report-dialog-count">{details.length}/1000</span>

        {error && (
          <p className="report-dialog-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="settings-delete-account-actions">
          <button type="button" className="save-bar-cancel-btn" onClick={closeAndReset} disabled={loading}>Cancel</button>
          <button type="submit" className="settings-danger-button" disabled={!reason || loading}>
            {loading ? 'Submitting...' : 'Submit report'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
