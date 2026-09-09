import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  User,
  Calendar,
  BookOpen,
  Heart,
  MessageSquare,
  Bookmark,
  Send,
  CornerUpLeft,
  Trash2,
  Flag,
  AlertCircle,
} from 'lucide-react'
import { FormattedText } from './FormattedText'
import { StarRating } from './CardHeader'
import { formatFullDateTime } from '../../utils/dateUtils'
import { getDropCapParts } from './dropCap'
import { insertMention, mentionAtCursor, type MentionMatch } from './mentions'
import { getEntryTypeIcon } from '../../utils/mediaIcons'
import { useAuth } from '../../context/AuthContext'
import { ReportDialog } from '../Reports/ReportDialog'
import {
  hideReportedInteraction,
  isInteractionOwner,
  isReportedInteractionHidden,
} from './commentPermissions'
import {
  canUseCloudData,
  createPostComment,
  createPostReply,
  deletePostComment,
  deletePostReply,
  loadMutualFollowers,
  loadPostComments,
  togglePostCommentLike,
  togglePostReplyLike,
  submitContentReport,
  type PublicUserSummary,
} from '../../services/cloudData'

export interface OverlayEntry {
  id: string
  type: 'book' | 'album' | 'song' | 'film' | 'tv' | 'game'
  title: string
  creator: string
  provider: string
  providerId: string
  genre?: string
  rating: number
  favoritePassage: string
  reflection: string
  reflectionAlign?: 'left' | 'center' | 'right' | 'justify'
  passageAlign?: 'left' | 'center' | 'right' | 'justify'
  enableDropCap?: boolean
  year?: string
  coverUrl?: string
  summary?: string
  explicit?: boolean
  createdAt: string
  updatedAt: string
  coverTone: string
  authorHandle?: string
}

interface ReplyItem {
  id: string
  authorId?: string
  authorHandle?: string
  replyToUserId?: string
  replyToHandle?: string
  replyToName?: string
  replyToInteractionId?: string
  author: string
  initials: string
  text: string
  createdAt: string
  likesCount?: number
  isLiked?: boolean
}

interface CommentItem {
  id: string
  authorId?: string
  authorHandle?: string
  author: string
  initials: string
  text: string
  createdAt: string
  likesCount?: number
  isLiked?: boolean
  replies: ReplyItem[]
}

interface ReplyTarget {
  commentId: string
  interactionId: string
  authorId?: string
  authorHandle?: string
  author: string
}

type InteractionReportTarget = {
  targetType: 'comment' | 'reply'
  targetId: string
  parentCommentId?: string
  targetHandle?: string
  targetLabel: string
}

const EMPTY_COMMENTS: CommentItem[] = []

interface CardOverlayModalProps {
  entry: OverlayEntry | null
  onClose: () => void
  focusCommentId?: string
  focusReplyId?: string
  focusRequestId?: string
  isLiked?: boolean
  isSaved?: boolean
  likeCount?: number
  onToggleLike?: () => void
  onToggleSave?: () => void
  onOpenProfile?: (handle: string) => void
  currentUserHandle?: string
}

const typeIconMap = {
  book: getEntryTypeIcon('book'),
  album: getEntryTypeIcon('album'),
  song: getEntryTypeIcon('song'),
  film: getEntryTypeIcon('film'),
  game: getEntryTypeIcon('game'),
  tv: getEntryTypeIcon('tv'),
}

const CURRENT_USER = 'jimboii'

function formatCommentTimestamp(value: string) {
  if (!value || /ago$|just now/i.test(value)) return value
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString()
}

export const CardOverlayModal: React.FC<CardOverlayModalProps> = ({
  entry,
  onClose,
  focusCommentId,
  focusReplyId,
  focusRequestId,
  isLiked = false,
  isSaved = false,
  likeCount = 0,
  onToggleLike,
  onToggleSave,
  onOpenProfile,
  currentUserHandle,
}) => {
  const { currentUser } = useAuth()
  const cloudUserId = currentUser?.uid || null
  const currentAuthor = currentUser?.displayName || currentUser?.email?.split('@')[0] || CURRENT_USER
  const currentInitials = currentAuthor
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U'
  const activeEntryId = entry?.id || ''
  const [commentState, setCommentState] = useState<{ entryId: string; items: CommentItem[] }>({
    entryId: activeEntryId,
    items: [],
  })
  const comments = commentState.entryId === activeEntryId ? commentState.items : EMPTY_COMMENTS
  const setComments = (update: React.SetStateAction<CommentItem[]>) => {
    setCommentState((previous) => {
      const currentItems = previous.entryId === activeEntryId ? previous.items : []
      return {
        entryId: activeEntryId,
        items: typeof update === 'function' ? update(currentItems) : update,
      }
    })
  }

  const [newCommentText, setNewCommentText] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [mutualFollowers, setMutualFollowers] = useState<PublicUserSummary[]>([])
  const [replyMention, setReplyMention] = useState<MentionMatch | null>(null)
  const replyInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const commentItemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const replyItemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [visibleCommentsCount, setVisibleCommentsCount] = useState(5)
  const [visibleRepliesCount, setVisibleRepliesCount] = useState<Record<string, number>>({})
  const [focusedInteractionId, setFocusedInteractionId] = useState<string | null>(null)
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false)
  const [reportToast, setReportToast] = useState<string | null>(null)
  const [postReportOpen, setPostReportOpen] = useState(false)
  const [interactionReportTarget, setInteractionReportTarget] = useState<InteractionReportTarget | null>(null)
  useEffect(() => {
    if (!activeEntryId || !cloudUserId || !canUseCloudData(cloudUserId)) return
    let cancelled = false
    void loadPostComments(activeEntryId, cloudUserId)
      .then((items) => {
        if (cancelled) return
        const visibleItems = items
          .filter((comment) => !isReportedInteractionHidden(cloudUserId, activeEntryId, 'comment', comment.id))
          .map((comment) => ({
            ...comment,
            replies: comment.replies.filter((reply) => (
              !isReportedInteractionHidden(cloudUserId, activeEntryId, 'reply', reply.id)
            )),
          }))
        setCommentState({ entryId: activeEntryId, items: visibleItems })
      })
      .catch((error) => console.error('Unable to load comments from Firebase.', error))
    return () => {
      cancelled = true
    }
  }, [activeEntryId, cloudUserId])

  useEffect(() => {
    if (!focusCommentId || comments.length === 0) return
    const orderedComments = sortOrder === 'newest' ? [...comments].reverse() : comments
    const commentIndex = orderedComments.findIndex(({ id }) => id === focusCommentId)
    if (commentIndex < 0) return

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const target = (focusReplyId && replyItemRefs.current[focusReplyId])
          || commentItemRefs.current[focusCommentId]
        if (!target) return
        setFocusedInteractionId(focusReplyId || focusCommentId)
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target.focus({ preventScroll: true })
      })
    })
    const highlightTimer = window.setTimeout(() => setFocusedInteractionId(null), 2200)
    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
      window.clearTimeout(highlightTimer)
    }
  }, [comments, focusCommentId, focusReplyId, focusRequestId, sortOrder])

  useEffect(() => {
    if (!activeEntryId || !cloudUserId || !canUseCloudData(cloudUserId)) {
      return
    }
    let cancelled = false
    void loadMutualFollowers(cloudUserId)
      .then((users) => {
        if (!cancelled) setMutualFollowers(users)
      })
      .catch((error) => console.error('Unable to load mutual followers for mentions.', error))
    return () => {
      cancelled = true
    }
  }, [activeEntryId, cloudUserId])

  const mentionResults = replyMention
    ? mutualFollowers.filter((user) => {
        const query = replyMention.query
        return user.handle.includes(query) || user.name.toLowerCase().includes(query)
      }).slice(0, 6)
    : []

  const selectReplyMention = (user: PublicUserSummary) => {
    if (!replyMention) return
    const { commentId } = replyMention
    const currentText = replyTexts[commentId] || ''
    const insertion = insertMention(currentText, replyMention, user.handle)
    setReplyTexts((previous) => ({ ...previous, [commentId]: insertion.value }))
    setReplyMention(null)
    requestAnimationFrame(() => {
      const input = replyInputRefs.current[commentId]
      input?.focus()
      input?.setSelectionRange(insertion.cursor, insertion.cursor)
    })
  }

  const hasUnsavedChanges = (): boolean => {
    if (newCommentText.trim().length > 0) return true
    return Object.values(replyTexts).some((t) => t && t.trim().length > 0)
  }

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges()) {
      setShowUnsavedConfirm(true)
    } else {
      onClose()
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const hasDraft = newCommentText.trim().length > 0
        || Object.values(replyTexts).some((text) => text && text.trim().length > 0)
      if (hasDraft) setShowUnsavedConfirm(true)
      else onClose()
    }
    if (entry) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [entry, newCommentText, onClose, replyTexts])

  if (!entry) return null

  const currentAuthorHandle = currentAuthor.replace(/^@/, '')
  const isPostOwner = !entry.authorHandle
    || entry.authorHandle.replace(/^@/, '') === (currentUserHandle || currentAuthorHandle).replace(/^@/, '')
  const displayAuthorHandle = (entry.authorHandle || currentAuthorHandle).replace(/^@/, '')

  const IconComponent = typeIconMap[entry.type] || BookOpen

  const showDropCap = Boolean(entry.enableDropCap)
  const { firstChar, restText, isEmoji, isLowercase } = getDropCapParts(entry.reflection)
  const isSquare = entry.type === 'album' || entry.type === 'song'

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCommentText.trim()) return
    const item: CommentItem = {
      // eslint-disable-next-line react-hooks/purity -- Generated only when the submit event runs.
      id: `c-${Date.now()}`,
      authorId: cloudUserId || undefined,
      authorHandle: currentUserHandle?.replace(/^@/, ''),
      author: currentAuthor,
      initials: currentInitials,
      text: newCommentText.trim(),
      createdAt: new Date().toISOString(),
      likesCount: 0,
      isLiked: false,
      replies: [],
    }
    setComments((prev) => [...prev, item])
    if (cloudUserId) {
      void createPostComment(entry.id, cloudUserId, item, entry.title)
        .catch((error) => console.error('Unable to save comment to Firebase.', error))
    }
    setNewCommentText('')
  }

  const handleReplySubmit = (commentId: string) => {
    const text = (replyTexts[commentId] || '').trim()
    if (!text) return
    const reply: ReplyItem = {
      // eslint-disable-next-line react-hooks/purity -- Generated only when the submit event runs.
      id: `r-${Date.now()}`,
      authorId: cloudUserId || undefined,
      authorHandle: currentUserHandle?.replace(/^@/, ''),
      replyToUserId: replyTarget?.commentId === commentId ? replyTarget.authorId : undefined,
      replyToHandle: replyTarget?.commentId === commentId ? replyTarget.authorHandle : undefined,
      replyToName: replyTarget?.commentId === commentId ? replyTarget.author : undefined,
      replyToInteractionId: replyTarget?.commentId === commentId ? replyTarget.interactionId : commentId,
      author: currentAuthor,
      initials: currentInitials,
      text,
      createdAt: new Date().toISOString(),
      likesCount: 0,
      isLiked: false,
    }
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c))
    )
    if (cloudUserId) {
      void createPostReply(entry.id, commentId, cloudUserId, reply)
        .catch((error) => console.error('Unable to save reply to Firebase.', error))
    }
    setReplyTexts((prev) => ({ ...prev, [commentId]: '' }))
    setReplyingToId(null)
    setReplyTarget(null)
    setReplyMention(null)
  }

  const toggleCommentLike = (commentId: string) => {
    const comment = comments.find((item) => item.id === commentId)
    const nextLiked = !comment?.isLiked
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const nextLiked = !c.isLiked
          return {
            ...c,
            isLiked: nextLiked,
            likesCount: (c.likesCount || 0) + (nextLiked ? 1 : -1),
          }
        }
        return c
      })
    )
    if (cloudUserId) {
      void togglePostCommentLike(entry.id, commentId, cloudUserId, nextLiked)
        .catch((error) => console.error('Unable to sync comment like to Firebase.', error))
    }
  }

  const toggleReplyLike = (commentId: string, replyId: string) => {
    const reply = comments.find((item) => item.id === commentId)?.replies.find((item) => item.id === replyId)
    const nextLiked = !reply?.isLiked
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            replies: c.replies.map((r) => {
              if (r.id === replyId) {
                const nextLiked = !r.isLiked
                return {
                  ...r,
                  isLiked: nextLiked,
                  likesCount: (r.likesCount || 0) + (nextLiked ? 1 : -1),
                }
              }
              return r
            }),
          }
        }
        return c
      })
    )
    if (cloudUserId) {
      void togglePostReplyLike(entry.id, commentId, replyId, cloudUserId, nextLiked)
        .catch((error) => console.error('Unable to sync reply like to Firebase.', error))
    }
  }

  const handleDeleteComment = (commentId: string) => {
    const comment = comments.find((item) => item.id === commentId)
    if (!comment || !isInteractionOwner(comment, cloudUserId, currentUserHandle)) return
    if (!window.confirm('Delete this comment?')) return
    if (!cloudUserId) {
      setComments((prev) => prev.filter((item) => item.id !== commentId))
      return
    }
    void deletePostComment(entry.id, commentId, cloudUserId)
      .then(() => setComments((prev) => prev.filter((item) => item.id !== commentId)))
      .catch((error) => console.error('Unable to delete comment from Firebase.', error))
  }

  const handleDeleteReply = (commentId: string, replyId: string) => {
    const reply = comments.find((item) => item.id === commentId)?.replies.find((item) => item.id === replyId)
    if (!reply || !isInteractionOwner(reply, cloudUserId, currentUserHandle)) return
    if (!window.confirm('Delete this reply?')) return
    const removeReply = () => setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? { ...comment, replies: comment.replies.filter((item) => item.id !== replyId) }
          : comment
      )
    )
    if (!cloudUserId) {
      removeReply()
      return
    }
    void deletePostReply(entry.id, commentId, replyId, cloudUserId)
      .then(removeReply)
      .catch((error) => console.error('Unable to delete reply from Firebase.', error))
  }

  const sortedComments = sortOrder === 'newest' ? [...comments].reverse() : comments
  const focusedCommentIndex = focusCommentId
    ? sortedComments.findIndex(({ id }) => id === focusCommentId)
    : -1
  const effectiveVisibleCommentsCount = Math.max(visibleCommentsCount, focusedCommentIndex + 1)
  const visibleComments = sortedComments.slice(0, effectiveVisibleCommentsCount)

  return (
    <AnimatePresence>
      <div className="overlay-modal-root">
        <motion.div
          className="overlay-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCloseAttempt}
        />

        <motion.div
          className={`overlay-modal tone-${entry.coverTone}`}
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label={entry.title}
        >
          {/* Toast Notification */}
          <AnimatePresence>
            {reportToast && (
              <motion.div
                className="report-toast"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Flag size={13} />
                <span>{reportToast}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Top bar: icon | read-time | (spacer) | stars | close ── */}
          <div className="overlay-topbar">
            <div className="overlay-topbar-left">
              <span className="overlay-type-icon" aria-label={entry.type}>
                <IconComponent aria-hidden="true" />
              </span>
              <span className="overlay-topbar-divider" aria-hidden="true" />
              <button
                type="button"
                className="overlay-author-pill"
                onClick={() => onOpenProfile?.(displayAuthorHandle)}
                title={`View @${displayAuthorHandle}'s profile`}
              >
                <User aria-hidden="true" />
                <span>@{displayAuthorHandle}</span>
              </button>
              {entry.createdAt && (
                <>
                  <span className="overlay-topbar-divider" aria-hidden="true" />
                  <span className="overlay-datetime-pill">
                    <Calendar aria-hidden="true" />
                    <span>{formatFullDateTime(entry.createdAt)}</span>
                  </span>
                </>
              )}
            </div>

            <div className="overlay-topbar-right">
              <StarRating rating={entry.rating} />
              <button
                className="overlay-close-btn"
                type="button"
                onClick={handleCloseAttempt}
                aria-label="Close reading view"
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* ── Cover + Metadata ── */}
          <div className="overlay-card-media">
            <div className={`overlay-cover-wrapper ${isSquare ? 'is-square' : ''}`}>
              {entry.coverUrl ? (
                <img src={entry.coverUrl} alt={entry.title} className="overlay-cover-img" referrerPolicy="no-referrer" />
              ) : (
                <div className="overlay-cover-fallback">
                  <IconComponent />
                </div>
              )}
            </div>

            <div className="overlay-card-details">
              <h2 className="overlay-title">
                <span>{entry.title}</span>
                {(entry.type === 'song' || entry.type === 'album') && entry.explicit && (
                  <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>
                )}
              </h2>
              {entry.creator && <p className="overlay-creator">{entry.creator}</p>}
              {entry.genre && <span className="overlay-genre-pill">{entry.genre}</span>}
              {entry.provider && entry.provider !== 'Manual' && (
                <p className="overlay-provider">
                  {entry.provider}{entry.year ? ` (${entry.year})` : ''}
                </p>
              )}

              {entry.favoritePassage && (
                <div className="overlay-favorite-passage">
                  <span className="overlay-passage-quote" aria-hidden="true">&#x201C;</span>
                  <div className="overlay-passage-text">
                    <FormattedText text={entry.favoritePassage} align={entry.passageAlign} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Reflection body ── */}
          {entry.reflection && (
            <div className="overlay-reflection-body">
              {showDropCap ? (
                <div className="dropcap-container">
                  <span className={`dropcap-letter ${isEmoji ? 'is-emoji' : ''} ${isLowercase ? 'is-lowercase' : ''}`}>
                    {firstChar}
                  </span>
                  <span className="dropcap-body">
                    <FormattedText text={restText} align={entry.reflectionAlign} />
                  </span>
                </div>
              ) : (
                <FormattedText text={entry.reflection} align={entry.reflectionAlign} />
              )}
            </div>
          )}

          {/* ── Social bar ── */}
          <div className="overlay-social-bar">
            <div className="overlay-social-left">
              <button
                type="button"
                className={`overlay-icon-action ${isLiked ? 'is-liked' : ''}`}
                onClick={onToggleLike}
                title={isLiked ? 'Unlike' : 'Like'}
              >
                <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                <span>{likeCount}</span>
              </button>

              <button
                type="button"
                className={`overlay-icon-action ${isSaved ? 'is-saved' : ''}`}
                onClick={onToggleSave}
                title={isSaved ? 'Unsave' : 'Save entry'}
              >
                <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />
              </button>

              {!isPostOwner && (
                <button
                  type="button"
                  className="overlay-icon-action"
                  onClick={() => setPostReportOpen(true)}
                  title="Report post"
                  aria-label="Report post"
                >
                  <Flag size={15} />
                </button>
              )}
            </div>

            <span className="overlay-comment-count">
              <MessageSquare size={15} />
              <span>({comments.length})</span>
            </span>
          </div>

          {/* ── Comments & Discussion ── */}
          <div className="overlay-comments-section">
            <div className="overlay-comments-header">
              <h3>Comments &amp; Discussion ({comments.length})</h3>
              <button
                type="button"
                className="overlay-sort-btn"
                onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              >
                {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
                <span className="overlay-sort-chevron">▾</span>
              </button>
            </div>

            <div className="overlay-comments-list">
              {visibleComments.map((c) => {
                const canDeleteC = isInteractionOwner(c, cloudUserId, currentUserHandle)
                const canReportC = Boolean(cloudUserId && !canDeleteC)
                const focusedReplyIndex = c.id === focusCommentId && focusReplyId
                  ? c.replies.findIndex(({ id }) => id === focusReplyId)
                  : -1
                const maxReplies = Math.max(visibleRepliesCount[c.id] || 3, focusedReplyIndex + 1)
                const visibleReplies = c.replies.slice(0, maxReplies)

                return (
                  <div
                    key={c.id}
                    ref={(item) => { commentItemRefs.current[c.id] = item }}
                    className={`overlay-comment-item ${focusedInteractionId === c.id ? 'is-notification-target' : ''}`}
                    tabIndex={-1}
                  >
                    <div className="overlay-comment-avatar">{c.initials}</div>
                    <div className="overlay-comment-body">
                      <div className="overlay-comment-meta">
                        {c.authorHandle && onOpenProfile ? (
                          <button
                            type="button"
                            className="overlay-comment-author overlay-comment-author-link"
                            onClick={() => onOpenProfile(c.authorHandle || '')}
                          >
                            {c.author}
                          </button>
                        ) : (
                          <span className="overlay-comment-author">{c.author}</span>
                        )}
                        <span className="overlay-comment-time">{formatCommentTimestamp(c.createdAt)}</span>
                      </div>
                      <p className="overlay-comment-text">{c.text}</p>

                      {/* Comment Action Bar */}
                      <div className="comment-actions-bar">
                        <button
                          type="button"
                          className={`comment-action-btn ${c.isLiked ? 'is-liked' : ''}`}
                          onClick={() => toggleCommentLike(c.id)}
                          title={c.isLiked ? 'Unlike' : 'Like'}
                        >
                          <Heart size={12} fill={c.isLiked ? 'currentColor' : 'none'} />
                          <span>{c.likesCount || 0}</span>
                        </button>
                        <button
                          type="button"
                          className="comment-action-btn"
                          onClick={() => {
                            const isClosing = replyingToId === c.id
                            setReplyingToId(isClosing ? null : c.id)
                            setReplyTarget(isClosing ? null : {
                              commentId: c.id,
                              interactionId: c.id,
                              authorId: c.authorId,
                              authorHandle: c.authorHandle,
                              author: c.author,
                            })
                            setReplyMention(null)
                            if (replyingToId !== c.id) {
                              setReplyTexts((prev) => ({
                                ...prev,
                                [c.id]: prev[c.id] || '',
                              }))
                            }
                          }}
                        >
                          <CornerUpLeft size={12} />
                          <span>{replyingToId === c.id ? 'Cancel' : 'Reply'}</span>
                        </button>
                        {canDeleteC && (
                          <button
                            type="button"
                            className="comment-action-btn danger"
                            onClick={() => handleDeleteComment(c.id)}
                            title="Delete comment"
                            aria-label="Delete comment"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        {canReportC && (
                          <button
                            type="button"
                            className="comment-action-btn danger"
                            onClick={() => setInteractionReportTarget({
                              targetType: 'comment',
                              targetId: c.id,
                              targetHandle: c.authorHandle,
                              targetLabel: `comment by ${c.authorHandle ? `@${c.authorHandle.replace(/^@/, '')}` : c.author}`,
                            })}
                            title="Report comment"
                            aria-label="Report comment"
                          >
                            <Flag size={12} />
                            <span>Report</span>
                          </button>
                        )}
                      </div>

                      {/* Inline reply form */}
                      {replyingToId === c.id && (
                        <form
                          className="overlay-reply-form"
                          onSubmit={(e) => {
                            e.preventDefault()
                            handleReplySubmit(c.id)
                          }}
                        >
                          <div className="overlay-reply-avatar">JB</div>
                          <textarea
                            ref={(input) => { replyInputRefs.current[c.id] = input }}
                            className="overlay-reply-input"
                            placeholder={`Reply to ${replyTarget?.commentId === c.id ? replyTarget.author : c.author}…`}
                            value={replyTexts[c.id] || ''}
                            rows={1}
                            spellCheck={false}
                            onChange={(e) => {
                              const val = e.target.value
                              setReplyTexts((prev) => ({ ...prev, [c.id]: val }))
                              setReplyMention(mentionAtCursor(c.id, val, e.target.selectionStart))
                              e.target.style.height = 'auto'
                              e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape' && replyMention?.commentId === c.id) {
                                e.preventDefault()
                                setReplyMention(null)
                                return
                              }
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                if (replyMention?.commentId === c.id && mentionResults[0]) {
                                  selectReplyMention(mentionResults[0])
                                  return
                                }
                                handleReplySubmit(c.id)
                              }
                            }}
                            autoFocus
                          />
                          {replyMention?.commentId === c.id && (
                            <div className="reply-mention-menu" role="listbox" aria-label="Mention a mutual follower">
                              {mentionResults.length > 0 ? mentionResults.map((user) => (
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected="false"
                                  key={user.uid}
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => selectReplyMention(user)}
                                >
                                  <span className="reply-mention-avatar" aria-hidden="true">
                                    {user.avatarUrl
                                      ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                                      : user.name.slice(0, 1).toUpperCase()}
                                  </span>
                                  <span className="reply-mention-identity">
                                    <strong>{user.name}</strong>
                                    <small>@{user.handle}</small>
                                  </span>
                                </button>
                              )) : (
                                <p>No matching mutual followers</p>
                              )}
                            </div>
                          )}
                          <button type="submit" className="overlay-reply-send" aria-label="Send reply">
                            <Send size={12} />
                          </button>
                        </form>
                      )}

                      {/* Nested replies list */}
                      {c.replies.length > 0 && (
                        <div className="overlay-replies-list">
                          {visibleReplies.map((r) => {
                            const canDeleteR = isInteractionOwner(r, cloudUserId, currentUserHandle)
                            const canReportR = Boolean(cloudUserId && !canDeleteR)
                            return (
                              <div
                                key={r.id}
                                ref={(item) => { replyItemRefs.current[r.id] = item }}
                                className={`overlay-reply-item ${focusedInteractionId === r.id ? 'is-notification-target' : ''}`}
                                tabIndex={-1}
                              >
                                <div className="overlay-reply-avatar-sm">{r.initials}</div>
                                <div className="overlay-reply-body">
                                  <div className="overlay-comment-meta">
                                    {r.authorHandle && onOpenProfile ? (
                                      <button
                                        type="button"
                                        className="overlay-comment-author overlay-comment-author-link"
                                        onClick={() => onOpenProfile(r.authorHandle || '')}
                                      >
                                        {r.author}
                                      </button>
                                    ) : (
                                      <span className="overlay-comment-author">{r.author}</span>
                                    )}
                                    <span className="overlay-comment-time">{formatCommentTimestamp(r.createdAt)}</span>
                                  </div>
                                  <p className="overlay-comment-text">{r.text}</p>
                                  <div className="comment-actions-bar">
                                    <button
                                      type="button"
                                      className={`comment-action-btn ${r.isLiked ? 'is-liked' : ''}`}
                                      onClick={() => toggleReplyLike(c.id, r.id)}
                                    >
                                      <Heart size={11} fill={r.isLiked ? 'currentColor' : 'none'} />
                                      <span>{r.likesCount || 0}</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="comment-action-btn"
                                      onClick={() => {
                                        setReplyingToId(c.id)
                                        setReplyTarget({
                                          commentId: c.id,
                                          interactionId: r.id,
                                          authorId: r.authorId,
                                          authorHandle: r.authorHandle,
                                          author: r.author,
                                        })
                                        setReplyMention(null)
                                        setReplyTexts((prev) => ({
                                          ...prev,
                                          [c.id]: prev[c.id] || '',
                                        }))
                                      }}
                                    >
                                      <CornerUpLeft size={11} />
                                      <span>Reply</span>
                                    </button>
                                    {canDeleteR && (
                                      <button
                                        type="button"
                                        className="comment-action-btn danger"
                                        onClick={() => handleDeleteReply(c.id, r.id)}
                                        title="Delete reply"
                                        aria-label="Delete reply"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    )}
                                    {canReportR && (
                                      <button
                                        type="button"
                                        className="comment-action-btn danger"
                                        onClick={() => setInteractionReportTarget({
                                          targetType: 'reply',
                                          targetId: r.id,
                                          parentCommentId: c.id,
                                          targetHandle: r.authorHandle,
                                          targetLabel: `reply by ${r.authorHandle ? `@${r.authorHandle.replace(/^@/, '')}` : r.author}`,
                                        })}
                                        title="Report reply"
                                        aria-label="Report reply"
                                      >
                                        <Flag size={11} />
                                        <span>Report</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                          {c.replies.length > maxReplies && (
                            <button
                              type="button"
                              className="load-more-replies-btn"
                              onClick={() =>
                                setVisibleRepliesCount((prev) => ({
                                  ...prev,
                                  [c.id]: (prev[c.id] || 3) + 5,
                                }))
                              }
                            >
                              Show more replies ({c.replies.length - maxReplies} remaining)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Load More Comments button */}
            {sortedComments.length > visibleCommentsCount && (
              <button
                type="button"
                className="load-more-comments-btn"
                onClick={() => setVisibleCommentsCount((v) => v + 5)}
              >
                Load More Comments ({sortedComments.length - visibleCommentsCount} remaining)
              </button>
            )}

            {/* Main comment form */}
            <form onSubmit={handlePostComment} className="overlay-comment-form">
              <textarea
                className="overlay-comment-textarea"
                placeholder="Write a comment…"
                value={newCommentText}
                rows={1}
                spellCheck={false}
                onChange={(e) => {
                  setNewCommentText(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handlePostComment(e)
                  }
                }}
              />
              <button type="submit" className="primary-btn overlay-post-btn">
                <Send size={14} />
                <span>Post</span>
              </button>
            </form>
          </div>
        </motion.div>

        {/* Unsaved Changes Confirmation Modal */}
        <AnimatePresence>
          {showUnsavedConfirm && (
            <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={() => setShowUnsavedConfirm(false)}>
              <motion.div
                className="settings-modal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 380, padding: 24 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: 'var(--accent)' }}>
                  <AlertCircle size={20} />
                  <h3 style={{ margin: 0, fontSize: 16, fontFamily: "'Playfair Display', serif" }}>Unsaved Comment</h3>
                </div>
                <p style={{ fontSize: 13, color: 'var(--secondary)', lineHeight: 1.5, margin: '0 0 20px 0' }}>
                  You have an unfinished comment or reply. Are you sure you want to discard it?
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setShowUnsavedConfirm(false)}
                  >
                    Keep Editing
                  </button>
                  <button
                    type="button"
                    className="primary-btn"
                    style={{ background: '#e57373', borderColor: '#e57373', color: '#fff' }}
                    onClick={() => {
                      setShowUnsavedConfirm(false)
                      setNewCommentText('')
                      setReplyTexts({})
                      onClose()
                    }}
                  >
                    Discard &amp; Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <ReportDialog
          open={postReportOpen}
          targetType="post"
          targetLabel={`“${entry.title}” by @${displayAuthorHandle}`}
          onClose={() => setPostReportOpen(false)}
          onSubmit={async (reason, details) => {
            if (!cloudUserId) throw new Error('Sign in to report this post.')
            await submitContentReport(cloudUserId, {
              targetType: 'post',
              targetId: entry.id,
              targetHandle: displayAuthorHandle,
              reason,
              details,
            })
            setPostReportOpen(false)
            setReportToast('Report submitted. Thank you for helping keep The Commonplace safe.')
            window.setTimeout(() => setReportToast(null), 3500)
          }}
        />
        <ReportDialog
          open={Boolean(interactionReportTarget)}
          targetType={interactionReportTarget?.targetType || 'comment'}
          targetLabel={interactionReportTarget?.targetLabel || 'this interaction'}
          onClose={() => setInteractionReportTarget(null)}
          onSubmit={async (reason, details) => {
            if (!cloudUserId || !interactionReportTarget) {
              throw new Error('Sign in to report this interaction.')
            }
            const target = interactionReportTarget
            await submitContentReport(cloudUserId, {
              targetType: target.targetType,
              targetId: target.targetId,
              targetHandle: target.targetHandle,
              postId: entry.id,
              parentCommentId: target.parentCommentId,
              reason,
              details,
            })
            hideReportedInteraction(cloudUserId, entry.id, target.targetType, target.targetId)
            if (target.targetType === 'comment') {
              setComments((previous) => previous.filter((comment) => comment.id !== target.targetId))
            } else {
              setComments((previous) => previous.map((comment) =>
                comment.id === target.parentCommentId
                  ? { ...comment, replies: comment.replies.filter((reply) => reply.id !== target.targetId) }
                  : comment
              ))
            }
            setInteractionReportTarget(null)
            setReportToast(`Report submitted. The ${target.targetType} has been hidden.`)
            window.setTimeout(() => setReportToast(null), 3500)
          }}
        />
      </div>
    </AnimatePresence>
  )
}
