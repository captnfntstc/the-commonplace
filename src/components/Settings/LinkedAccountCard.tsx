import React from 'react'
import { Loader2 } from 'lucide-react'

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

export type ProviderInfo = {
  id: string
  name: string
  description: string
  icon: React.ReactNode
}

interface LinkedAccountCardProps {
  provider: ProviderInfo
  status: ConnectionStatus
  onToggle: () => void
}

export const LinkedAccountCard: React.FC<LinkedAccountCardProps> = ({
  provider,
  status,
  onToggle,
}) => {
  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'

  return (
    <div className={`linked-account-card-editorial ${status}`}>
      <div className="card-left-section">
        {/* Monochrome Brand Icon */}
        <div className="provider-monochrome-icon">{provider.icon}</div>

        {/* Provider Title & Description */}
        <div className="provider-details">
          <h4 className="provider-name">{provider.name}</h4>
          <p className="provider-desc">{provider.description}</p>
        </div>
      </div>

      <div className="card-right-section">
        {/* Connection Status Badge */}
        <div className={`connection-status-badge ${status}`}>
          {isConnecting ? (
            <>
              <Loader2 aria-hidden="true" className="connecting-spinner" />
              <span>Connecting…</span>
            </>
          ) : isConnected ? (
            <>
              <span className="status-dot connected" aria-hidden="true" />
              <span>Connected</span>
            </>
          ) : (
            <>
              <span className="status-dot disconnected" aria-hidden="true" />
              <span>Not Connected</span>
            </>
          )}
        </div>

        {/* Action Button */}
        <button
          type="button"
          className={`account-action-btn ${isConnected ? 'disconnect' : 'connect'}`}
          onClick={onToggle}
          disabled={isConnecting}
        >
          {isConnecting ? (
            'Connecting…'
          ) : isConnected ? (
            'Disconnect'
          ) : (
            'Connect'
          )}
        </button>
      </div>
    </div>
  )
}
