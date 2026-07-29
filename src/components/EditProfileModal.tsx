import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { User, X, Save, AtSign, FileText } from 'lucide-react'

export type UserProfileData = {
  name: string
  handle: string
  bio: string
}

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
  profile: UserProfileData
  onSave: (updated: UserProfileData) => void
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSave,
}) => {
  const [name, setName] = useState(profile.name)
  const [handle, setHandle] = useState(profile.handle.replace(/^@/, ''))
  const [bio, setBio] = useState(profile.bio)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: name.trim() || 'jimboii',
      handle: handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim() || 'jimboii'}`,
      bio: bio.trim(),
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="settings-modal edit-profile-modal"
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <div className="settings-header-title">
            <User aria-hidden="true" />
            <h2>Edit Profile</h2>
          </div>
          <button
            type="button"
            className="composer-close-icon"
            onClick={onClose}
            aria-label="Close edit profile"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-profile-form">
          <div className="form-group">
            <label htmlFor="edit-name">
              <User aria-hidden="true" />
              <span>Display Name</span>
            </label>
            <input
              id="edit-name"
              type="text"
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. jimboii"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-handle">
              <AtSign aria-hidden="true" />
              <span>User Handle</span>
            </label>
            <input
              id="edit-handle"
              type="text"
              className="text-input"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. jimboii"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-bio">
              <FileText aria-hidden="true" />
              <span>Bio & Description</span>
            </label>
            <textarea
              id="edit-bio"
              className="text-input bio-textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about your favorite books, music, and films..."
              rows={3}
            />
          </div>

          <div className="edit-profile-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-btn"
            >
              <Save aria-hidden="true" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
