import React, { useRef } from 'react'
import { User, Upload, Check } from 'lucide-react'

interface AvatarUploaderProps {
  avatarUrl: string
  onChangeAvatar: (url: string) => void
}

const AVATAR_PRESETS = [
  { id: 'default', label: 'Default', url: '' },
  { id: 'reader', label: 'Reader', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop' },
  { id: 'collector', label: 'Collector', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop' },
  { id: 'scholar', label: 'Scholar', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop' },
]

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  avatarUrl,
  onChangeAvatar,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        onChangeAvatar(event.target.result as string)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="avatar-uploader-container">
      <div className="avatar-uploader-left">
        <div className="avatar-circle-preview">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile Avatar" className="avatar-circle-img" />
          ) : (
            <User aria-hidden="true" className="avatar-placeholder-icon" />
          )}
        </div>
        <div className="avatar-actions">
          <button
            type="button"
            className="secondary-action-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload aria-hidden="true" />
            <span>Change Avatar</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <span className="upload-hint">JPG, PNG or GIF. 2MB max.</span>
        </div>
      </div>

      <div className="avatar-presets-bar">
        <span className="presets-label">Avatar Presets:</span>
        <div className="avatar-presets-row">
          {AVATAR_PRESETS.map((preset) => {
            const isSelected = avatarUrl === preset.url
            return (
              <button
                key={preset.id}
                type="button"
                className={`avatar-preset-btn ${isSelected ? 'selected' : ''}`}
                onClick={() => onChangeAvatar(preset.url)}
              >
                {preset.url ? (
                  <img src={preset.url} alt={preset.label} />
                ) : (
                  <User aria-hidden="true" />
                )}
                {isSelected && (
                  <span className="preset-check-icon">
                    <Check aria-hidden="true" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
