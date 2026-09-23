import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Ban,
  Copyright,
  Ellipsis,
  Eye,
  Flag,
  HeartPulse,
  LockKeyhole,
  MessageCircle,
  Shield,
  ShieldAlert,
  UserRoundX,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog'

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

const REPORT_REASON_PRESENTATION: Record<string, {
  title: string
  description: string
  icon: LucideIcon
}> = {
  harassment_or_bullying: {
    title: 'Harassment',
    description: 'Bullying or targeted behavior',
    icon: MessageCircle,
  },
  hate_or_discrimination: {
    title: 'Hate speech',
    description: 'Attacks based on identity',
    icon: Shield,
  },
  impersonation: {
    title: 'Impersonation',
    description: 'Pretending to be someone else',
    icon: UserRoundX,
  },
  spam_or_scam: {
    title: 'Spam or scam',
    description: 'Misleading or repetitive content',
    icon: Ban,
  },
  underage_user: {
    title: 'Underage user',
    description: 'The account may belong to a child',
    icon: ShieldAlert,
  },
  self_harm_concern: {
    title: 'Self-harm concern',
    description: 'Content suggesting immediate risk',
    icon: HeartPulse,
  },
  sexual_content: {
    title: 'Explicit content',
    description: 'Nudity, sexual, or exploitative material',
    icon: Eye,
  },
  violence_or_threats: {
    title: 'Violence or threats',
    description: 'Violent content or credible threats',
    icon: ShieldAlert,
  },
  privacy_violation: {
    title: 'Privacy violation',
    description: 'Personal or identifying information',
    icon: LockKeyhole,
  },
  copyright: {
    title: 'Copyright infringement',
    description: 'Unauthorized use of content',
    icon: Copyright,
  },
  other: {
    title: 'Other',
    description: 'Something else',
    icon: Ellipsis,
  },
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
  const [otherReason, setOtherReason] = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const closeAndReset = () => {
    setReason('')
    setOtherReason('')
    setDetails('')
    setError('')
    onClose()
  }
  const dialogRef = useAccessibleDialog<HTMLFormElement>({
    open,
    onClose: closeAndReset,
    closeOnEscape: !loading,
  })

  if (!open) return null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!reason) {
      setError('Choose a reason for your report.')
      return
    }
    if (reason === 'other' && !otherReason.trim()) {
      setError('Please specify the reason for your report.')
      return
    }
    try {
      setLoading(true)
      setError('')
      const submittedDetails = reason === 'other'
        ? [`Other reason: ${otherReason.trim()}`, details.trim()].filter(Boolean).join('\n\n')
        : details.trim()
      await onSubmit(reason, submittedDetails)
      setReason('')
      setOtherReason('')
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
        ref={dialogRef}
        className="settings-modal report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        aria-describedby="report-dialog-description"
        tabIndex={-1}
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="report-dialog-close"
          aria-label="Close report dialog"
          onClick={closeAndReset}
          disabled={loading}
        >
          <X aria-hidden="true" />
        </button>

        <header className="report-dialog-header">
          <div className="report-dialog-icon"><Flag aria-hidden="true" /></div>
          <div>
            <h2 id="report-dialog-title">Report {targetType}</h2>
            <p id="report-dialog-description">
              Tell us what is wrong with <strong>{targetLabel}</strong>. Reports are private and will be reviewed by our team.
            </p>
          </div>
        </header>

        <fieldset className="report-reason-section" aria-describedby="report-reason-help">
          <legend>Reason</legend>
          <p id="report-reason-help">Select the main reason for reporting.</p>
          <div className="report-reason-grid">
            {REPORT_REASONS[targetType].map((option) => {
              const presentation = REPORT_REASON_PRESENTATION[option.value]
              const ReasonIcon = presentation.icon
              const selected = reason === option.value

              return (
                <label
                  key={option.value}
                  className={`report-reason-option${selected ? ' is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={option.value}
                    checked={selected}
                    aria-label={option.label}
                    onChange={(event) => {
                      setReason(event.target.value)
                      setError('')
                    }}
                  />
                  <ReasonIcon aria-hidden="true" />
                  <span className="report-reason-copy">
                    <strong>{presentation.title}</strong>
                    <small>{presentation.description}</small>
                  </span>
                </label>
              )
            })}
          </div>
          {reason === 'other' && (
            <div className="report-other-reason">
              <label htmlFor="report-other-reason">Please specify</label>
              <input
                id="report-other-reason"
                type="text"
                maxLength={250}
                value={otherReason}
                onChange={(event) => {
                  setOtherReason(event.target.value)
                  setError('')
                }}
                placeholder="Briefly describe the reason for reporting."
                autoFocus
                required
              />
            </div>
          )}
        </fieldset>

        <div className="report-details-section">
          <label htmlFor="report-details">Additional details <span>(optional)</span></label>
          <div className="report-details-field">
            <textarea
              id="report-details"
              rows={4}
              maxLength={1000}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Share any additional context to help our team understand what happened."
            />
            <span className="report-dialog-count">{details.length}/1000</span>
          </div>
        </div>

        {error && (
          <p className="report-dialog-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="report-dialog-actions">
          <button type="button" className="report-dialog-cancel" onClick={closeAndReset} disabled={loading}>Cancel</button>
          <button
            type="submit"
            className="report-dialog-submit"
            disabled={!reason || (reason === 'other' && !otherReason.trim()) || loading}
          >
            {loading ? 'Submitting...' : 'Submit report'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
