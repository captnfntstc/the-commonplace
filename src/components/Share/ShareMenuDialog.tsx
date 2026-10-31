import React, { useState } from 'react'
import {
  X,
  Copy,
  Check,
  Mail,
  MessageCircle,
  Send,
  Share2,
} from 'lucide-react'
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog'
import './ShareMenuDialog.css'

export interface ShareTargetInfo {
  title: string
  url: string
  text?: string
  typeLabel?: string // e.g. 'Comment', 'Reply', 'Collection', 'Media'
}

interface ShareMenuDialogProps {
  isOpen: boolean
  onClose: () => void
  target: ShareTargetInfo | null
  onToast?: (message: string) => void
}

export const ShareMenuDialog: React.FC<ShareMenuDialogProps> = ({
  isOpen,
  onClose,
  target,
  onToast,
}) => {
  const [copied, setCopied] = useState(false)
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open: isOpen, onClose })

  if (!isOpen || !target) return null

  const { title, url, text = '', typeLabel = 'Link' } = target

  // Shorten / format URL for clean presentation display
  const displayUrl = url.length > 55 ? `${url.slice(0, 52)}...` : url

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const tempInput = document.createElement('input')
        tempInput.value = url
        document.body.appendChild(tempInput)
        tempInput.select()
        document.execCommand('copy')
        document.body.removeChild(tempInput)
      }
      setCopied(true)
      onToast?.(`${typeLabel} link copied to clipboard!`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      onToast?.('Failed to copy link')
    }
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: text || title,
          url,
        })
        onClose()
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          onToast?.('Unable to share')
        }
      }
    }
  }

  const sharePlatforms = [
    {
      id: 'email',
      name: 'Email',
      icon: <Mail size={18} aria-hidden="true" />,
      color: '#ea4335',
      href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text ? `${text}\n\n${url}` : url)}`,
    },
    {
      id: 'messenger',
      name: 'Messenger',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.03 2 11c0 2.87 1.5 5.42 3.86 7.08l-.58 2.68a.75.75 0 0 0 .96.87l3.05-1.01c.88.25 1.79.38 2.71.38 5.52 0 10-4.03 10-9s-4.48-9-10-9zm1.06 12.16l-2.58-2.75-5.04 2.75 5.54-5.88 2.64 2.75 4.98-2.75-5.54 5.88z" />
        </svg>
      ),
      color: '#0084ff',
      href: `https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=291494419107518&redirect_uri=${encodeURIComponent(url)}`,
      target: '_blank',
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: <MessageCircle size={18} aria-hidden="true" />,
      color: '#25d366',
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${title ? `${title} - ` : ''}${url}`)}`,
      target: '_blank',
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: <Send size={18} aria-hidden="true" />,
      color: '#229ed9',
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      target: '_blank',
    },
    {
      id: 'x',
      name: 'X (Twitter)',
      icon: (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      color: '#f5f5f5',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      target: '_blank',
    },
    {
      id: 'reddit',
      name: 'Reddit',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .868.182 1.17.476 1.162-.828 2.766-1.371 4.531-1.464l.896-4.208a.313.313 0 0 1 .37-.243l3.245.682a1.251 1.251 0 0 1 1.016-.491zm-8.868 6.947c-.68 0-1.233.553-1.233 1.234 0 .68.553 1.233 1.233 1.233.68 0 1.233-.553 1.233-1.233 0-.681-.553-1.234-1.233-1.234zm7.716 0c-.68 0-1.233.553-1.233 1.234 0 .68.553 1.233 1.233 1.233.68 0 1.233-.553 1.233-1.233 0-.681-.553-1.234-1.233-1.234zm-5.464 3.737a.313.313 0 0 0-.222.534c.732.732 1.905.732 2.637 0a.313.313 0 0 0-.444-.444c-.49.49-1.285.49-1.775 0a.313.313 0 0 0-.196-.09z" />
        </svg>
      ),
      color: '#ff4500',
      href: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
      target: '_blank',
    },
  ]

  return (
    <div className="tcp-share-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="tcp-share-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="tcp-share-modal-header">
          <div className="tcp-share-header-title-wrap">
            <Share2 size={16} className="tcp-share-header-icon" aria-hidden="true" />
            <h3 id="share-modal-title">Share {typeLabel}</h3>
          </div>
          <button
            type="button"
            className="tcp-share-close-btn"
            onClick={onClose}
            aria-label="Close share dialog"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Direct Share Platforms Grid */}
        <div className="tcp-share-platforms-section">
          <span className="tcp-share-section-label">Share directly to</span>
          <div className="tcp-share-grid">
            {sharePlatforms.map((platform) => (
              <a
                key={platform.id}
                href={platform.href}
                target={platform.target || '_self'}
                rel="noopener noreferrer"
                className="tcp-share-platform-btn"
                onClick={() => {
                  setTimeout(() => onClose(), 200)
                }}
              >
                <span
                  className="tcp-share-platform-icon-box"
                  style={{ color: platform.color }}
                >
                  {platform.icon}
                </span>
                <span className="tcp-share-platform-name">{platform.name}</span>
              </a>
            ))}

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                className="tcp-share-platform-btn"
                onClick={() => void handleNativeShare()}
              >
                <span className="tcp-share-platform-icon-box" style={{ color: 'var(--accent, #c9a96e)' }}>
                  <Share2 size={18} aria-hidden="true" />
                </span>
                <span className="tcp-share-platform-name">More apps</span>
              </button>
            )}
          </div>
        </div>

        {/* Dedicated Copy Link Section */}
        <div className="tcp-share-copy-section">
          <span className="tcp-share-section-label">Copy link</span>
          <div className="tcp-share-copy-box">
            <input
              type="text"
              readOnly
              value={displayUrl}
              className="tcp-share-copy-input"
              aria-label="Link to share"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              className={`tcp-share-copy-btn ${copied ? 'is-copied' : ''}`}
              onClick={() => void handleCopyLink()}
              aria-label={copied ? 'Link copied' : 'Copy link'}
            >
              {copied ? (
                <>
                  <Check size={14} aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} aria-hidden="true" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
