import React, { useRef } from 'react'
import { Upload, Check } from 'lucide-react'

interface CoverUploaderProps {
  coverUrl: string
  onChangeCover: (url: string) => void
}

type CoverPreset = {
  id: string
  label: string
  url: string
  thumbnailUrl: string
}

const COVER_PRESETS: CoverPreset[] = [
  {
    id: 'library',
    label: 'Library',
    url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=1200&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: 'film-grain',
    label: 'Film Grain',
    url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1200&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: 'antique',
    label: 'Antique',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    url: 'https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?q=80&w=1200&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: 'vintage-paper',
    label: 'Vintage Paper',
    url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1200&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=300&auto=format&fit=crop',
  },
]

export const CoverUploader: React.FC<CoverUploaderProps> = ({
  coverUrl,
  onChangeCover,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        onChangeCover(event.target.result as string)
      }
    }
    reader.readAsDataURL(file)
  }

  const activeUrl = coverUrl || COVER_PRESETS[0].url

  return (
    <div className="cover-uploader-container">
      {/* Banner Preview Box (Max 260px tall) */}
      <div
        className="cover-banner-preview"
        style={{ backgroundImage: `url('${activeUrl}')` }}
      >
        <button
          type="button"
          className="cover-upload-floating-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload aria-hidden="true" />
          <span>Change Cover</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          style={{ display: 'none' }}
        />
      </div>

      {/* Visual Preset Thumbnail Cards */}
      <div className="cover-presets-section">
        <span className="cover-presets-header">Banner Artwork Presets</span>
        <div className="cover-thumbnail-cards-grid">
          {COVER_PRESETS.map((preset) => {
            const isSelected = activeUrl === preset.url
            return (
              <button
                key={preset.id}
                type="button"
                className={`cover-thumbnail-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onChangeCover(preset.url)}
              >
                <div
                  className="thumbnail-card-image"
                  style={{ backgroundImage: `url('${preset.thumbnailUrl}')` }}
                />
                <div className="thumbnail-card-footer">
                  <span className="thumbnail-card-title">{preset.label}</span>
                  {isSelected && (
                    <span className="thumbnail-selected-badge">
                      <Check aria-hidden="true" />
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
