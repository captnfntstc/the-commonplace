import React, { useRef, useState } from 'react'
import { User, Upload, Check, Crop, ImageIcon, Move, X } from 'lucide-react'
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog'

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

interface AvatarCropperDialogProps {
  imageUrl: string
  onCancel: () => void
  onApply: (url: string) => void
}

export const AvatarCropperDialog: React.FC<AvatarCropperDialogProps> = ({
  imageUrl,
  onCancel,
  onApply,
}) => {
  const [cropZoom, setCropZoom] = useState(1)
  const [cropX, setCropX] = useState(0)
  const [cropY, setCropY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dialogRef = useAccessibleDialog<HTMLElement>({ open: true, onClose: onCancel })
  const dragStartRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    cropX: number
    cropY: number
  } | null>(null)

  const clampPosition = (value: number) => Math.max(-1, Math.min(1, value))

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      cropX,
      cropY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current
    if (!dragStart || dragStart.pointerId !== event.pointerId) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const travel = Math.max(1, bounds.width * 0.42)
    setCropX(clampPosition(dragStart.cropX - (event.clientX - dragStart.clientX) / travel))
    setCropY(clampPosition(dragStart.cropY - (event.clientY - dragStart.clientY) / travel))
  }

  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current?.pointerId !== event.pointerId) return
    dragStartRef.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handlePositionKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const movement = event.shiftKey ? 0.12 : 0.04
    if (event.key === 'ArrowLeft') setCropX((value) => clampPosition(value - movement))
    else if (event.key === 'ArrowRight') setCropX((value) => clampPosition(value + movement))
    else if (event.key === 'ArrowUp') setCropY((value) => clampPosition(value - movement))
    else if (event.key === 'ArrowDown') setCropY((value) => clampPosition(value + movement))
    else return
    event.preventDefault()
  }

  const applyCrop = () => {
    const image = new Image()
    image.onload = () => {
      const outputSize = 512
      const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / cropZoom
      const availableX = Math.max(0, image.naturalWidth - cropSize)
      const availableY = Math.max(0, image.naturalHeight - cropSize)
      const sourceX = availableX * ((cropX + 1) / 2)
      const sourceY = availableY * ((cropY + 1) / 2)
      const canvas = document.createElement('canvas')
      canvas.width = outputSize
      canvas.height = outputSize

      const context = canvas.getContext('2d')
      if (!context) return

      context.fillStyle = '#17120d'
      context.fillRect(0, 0, outputSize, outputSize)
      context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, outputSize, outputSize)
      onApply(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.src = imageUrl
  }

  return (
    <div className="avatar-cropper-backdrop" onClick={onCancel}>
      <section
        ref={dialogRef}
        className="avatar-cropper-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-cropper-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="avatar-cropper-header">
          <div>
            <span><Crop aria-hidden="true" /> Adjust photo</span>
            <h3 id="avatar-cropper-title">Resize your profile picture</h3>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close profile picture resizer">
            <X aria-hidden="true" />
          </button>
        </header>

        <div
          className={`avatar-cropper-preview ${isDragging ? 'is-dragging' : ''}`}
          role="img"
          tabIndex={0}
          aria-label="Profile picture crop preview. Drag the photo or use arrow keys to reposition it."
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          onKeyDown={handlePositionKeyDown}
        >
          <img
            src={imageUrl}
            alt=""
            style={{
              objectPosition: `${50 + cropX * 50}% ${50 + cropY * 50}%`,
              transformOrigin: `${50 + cropX * 50}% ${50 + cropY * 50}%`,
              transform: `scale(${cropZoom})`,
            }}
          />
          <span aria-hidden="true" />
        </div>

        <p className="avatar-cropper-drag-hint">
          <Move aria-hidden="true" /> Drag the photo to reposition it
        </p>

        <div className="avatar-cropper-controls">
          <label>
            <span>Zoom</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={cropZoom}
              onChange={(event) => setCropZoom(Number(event.target.value))}
              aria-label="Avatar zoom"
            />
          </label>
        </div>

        <footer className="avatar-cropper-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="confirm" onClick={applyCrop}>Use Photo</button>
        </footer>
      </section>
    </div>
  )
}

interface CoverCropperDialogProps {
  imageUrl: string
  onCancel: () => void
  onApply: (url: string) => void
}

export const CoverCropperDialog: React.FC<CoverCropperDialogProps> = ({
  imageUrl,
  onCancel,
  onApply,
}) => {
  const [cropZoom, setCropZoom] = useState(1)
  const [cropX, setCropX] = useState(0)
  const [cropY, setCropY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dialogRef = useAccessibleDialog<HTMLElement>({ open: true, onClose: onCancel })
  const dragStartRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    cropX: number
    cropY: number
  } | null>(null)

  const clampPosition = (value: number) => Math.max(-1, Math.min(1, value))

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      cropX,
      cropY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current
    if (!dragStart || dragStart.pointerId !== event.pointerId) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const horizontalTravel = Math.max(1, bounds.width * 0.42)
    const verticalTravel = Math.max(1, bounds.height * 0.42)
    setCropX(clampPosition(dragStart.cropX - (event.clientX - dragStart.clientX) / horizontalTravel))
    setCropY(clampPosition(dragStart.cropY - (event.clientY - dragStart.clientY) / verticalTravel))
  }

  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current?.pointerId !== event.pointerId) return
    dragStartRef.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handlePositionKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const movement = event.shiftKey ? 0.12 : 0.04
    if (event.key === 'ArrowLeft') setCropX((value) => clampPosition(value - movement))
    else if (event.key === 'ArrowRight') setCropX((value) => clampPosition(value + movement))
    else if (event.key === 'ArrowUp') setCropY((value) => clampPosition(value - movement))
    else if (event.key === 'ArrowDown') setCropY((value) => clampPosition(value + movement))
    else return
    event.preventDefault()
  }

  const applyCrop = () => {
    const image = new Image()
    image.onload = () => {
      const outputWidth = 1600
      const outputHeight = 500
      const aspectRatio = outputWidth / outputHeight
      const imageAspectRatio = image.naturalWidth / image.naturalHeight
      const baseWidth = imageAspectRatio > aspectRatio
        ? image.naturalHeight * aspectRatio
        : image.naturalWidth
      const baseHeight = imageAspectRatio > aspectRatio
        ? image.naturalHeight
        : image.naturalWidth / aspectRatio
      const cropWidth = baseWidth / cropZoom
      const cropHeight = baseHeight / cropZoom
      const availableX = Math.max(0, image.naturalWidth - cropWidth)
      const availableY = Math.max(0, image.naturalHeight - cropHeight)
      const sourceX = availableX * ((cropX + 1) / 2)
      const sourceY = availableY * ((cropY + 1) / 2)
      const canvas = document.createElement('canvas')
      canvas.width = outputWidth
      canvas.height = outputHeight

      const context = canvas.getContext('2d')
      if (!context) return

      context.fillStyle = '#17120d'
      context.fillRect(0, 0, outputWidth, outputHeight)
      context.drawImage(
        image,
        sourceX,
        sourceY,
        cropWidth,
        cropHeight,
        0,
        0,
        outputWidth,
        outputHeight,
      )
      onApply(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.src = imageUrl
  }

  return (
    <div className="avatar-cropper-backdrop" onClick={onCancel}>
      <section
        ref={dialogRef}
        className="avatar-cropper-dialog cover-cropper-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cover-cropper-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="avatar-cropper-header">
          <div>
            <span><ImageIcon aria-hidden="true" /> Adjust cover</span>
            <h3 id="cover-cropper-title">Position your cover photo</h3>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close cover photo adjuster">
            <X aria-hidden="true" />
          </button>
        </header>

        <div
          className={`cover-cropper-preview ${isDragging ? 'is-dragging' : ''}`}
          role="img"
          tabIndex={0}
          aria-label="Cover photo crop preview. Drag the photo or use arrow keys to reposition it."
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          onKeyDown={handlePositionKeyDown}
        >
          <img
            src={imageUrl}
            alt=""
            style={{
              objectPosition: `${50 + cropX * 50}% ${50 + cropY * 50}%`,
              transformOrigin: `${50 + cropX * 50}% ${50 + cropY * 50}%`,
              transform: `scale(${cropZoom})`,
            }}
          />
          <span aria-hidden="true" />
        </div>

        <p className="avatar-cropper-drag-hint">
          <Move aria-hidden="true" /> Drag the cover to reposition it
        </p>

        <div className="avatar-cropper-controls">
          <label>
            <span>Zoom</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={cropZoom}
              onChange={(event) => setCropZoom(Number(event.target.value))}
              aria-label="Cover zoom"
            />
          </label>
        </div>

        <footer className="avatar-cropper-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="confirm" onClick={applyCrop}>Use Cover</button>
        </footer>
      </section>
    </div>
  )
}

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  avatarUrl,
  onChangeAvatar,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cropImage, setCropImage] = useState('')
  const [uploadError, setUploadError] = useState('')

  const closeCropper = () => setCropImage('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''
    setUploadError('')

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Please choose an image smaller than 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        setCropImage(event.target.result as string)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="avatar-uploader-container">
      <div className="avatar-uploader-left">
        <div className="avatar-circle-preview">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile Avatar" className="avatar-circle-img" referrerPolicy="no-referrer" />
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
          {uploadError && <span className="avatar-upload-error" role="alert">{uploadError}</span>}
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
                  <img src={preset.url} alt={preset.label} referrerPolicy="no-referrer" />
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

      {cropImage && (
        <AvatarCropperDialog
          imageUrl={cropImage}
          onCancel={closeCropper}
          onApply={(url) => {
            onChangeAvatar(url)
            closeCropper()
          }}
        />
      )}
    </div>
  )
}
