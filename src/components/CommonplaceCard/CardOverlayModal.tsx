import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Calendar,
  BookOpen,
  Heart,
  Bookmark,
  Send,
  CornerUpLeft,
  Trash2,
  Flag,
  Pencil,
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
  ownerId?: string
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

interface EntryReadingPageProps {
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
  onEdit?: () => void
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

export const EntryReadingPage: React.FC<EntryReadingPageProps> = ({
  entry,
  focusCommentId,
  focusReplyId,
  focusRequestId,
  isLiked = false,
  isSaved = false,
  likeCount = 0,
  onToggleLike,
  onToggleSave,
  onEdit,
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

  useEffect(() => {
    if (activeEntryId) window.scrollTo({ top: 0, behavior: 'auto' })
  }, [activeEntryId])

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

  if (!entry) return null

  const currentAuthorHandle = currentAuthor.replace(/^@/, '')
  const displayAuthorHandle = (entry.authorHandle || currentAuthorHandle).replace(/^@/, '')

  const IconComponent = typeIconMap[entry.type] || BookOpen

  const showDropCap = Boolean(entry.enableDropCap)
  const { firstChar, restText, isEmoji, isLowercase } = getDropCapParts(entry.reflection)
  const isSquare = entry.type === 'album' || entry.type === 'song'
  const entryTypeLabel = {
    book: 'Book',
    album: 'Album',
    song: 'Song',
    film: 'Film',
    tv: 'Show',
    game: 'Game',
  }[entry.type]
  const passageLabel = entry.type === 'song' || entry.type === 'album'
    ? 'Notable lyrics'
    : entry.type === 'book'
      ? 'Notable passage'
      : 'Notable line'

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
    <main className={`entry-reading-page tone-${entry.coverTone}`}>
      <div className="entry-reading-frame">
        <motion.article
          className="entry-reading-article"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          aria-labelledby="entry-reading-title"
        >
          {/* Toast Notification */}
          <AnimatePresence>
            {reportToast && (
              <motion.div
                className="report-toast entry-reading-toast"
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
          <header className="entry-reading-hero">
            <div className="entry-reading-primary">
              <div className="entry-reading-art-column">
              <div className={`entry-reading-cover ${isSquare ? 'is-square' : ''}`}>
                {entry.coverUrl ? (
                  <img src={entry.coverUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="entry-reading-cover-fallback" aria-label={`No cover available for ${entry.title}`}>
                    <IconComponent aria-hidden="true" />
                  </div>
                )}
              </div>
            </div>

              <div className="entry-reading-intro">
              <div className="entry-reading-meta-row">
                <div className="entry-reading-kicker">
                  <span>{entryTypeLabel}</span>
                  {entry.genre && <><i aria-hidden="true" /><span>{entry.genre}</span></>}
                  {entry.year && <><i aria-hidden="true" /><span>{entry.year}</span></>}
                </div>
                <div className="entry-reading-actions" aria-label="Entry actions">
                  <button
                    type="button"
                    className={isLiked ? 'is-liked has-count' : 'has-count'}
                    onClick={onToggleLike}
                    aria-label={isLiked ? `Unlike, ${likeCount} likes` : `Like, ${likeCount} likes`}
                    title={isLiked ? 'Unlike' : 'Like'}
                    aria-pressed={isLiked}
                  >
                    <Heart aria-hidden="true" fill={isLiked ? 'currentColor' : 'none'} />
                    <span>{likeCount}</span>
                  </button>
                  <button
                    type="button"
                    className={isSaved ? 'is-saved' : ''}
                    onClick={onToggleSave}
                    aria-label={isSaved ? 'Unsave entry' : 'Save entry'}
                    title={isSaved ? 'Unsave entry' : 'Save entry'}
                    aria-pressed={isSaved}
                  >
                    <Bookmark aria-hidden="true" fill={isSaved ? 'currentColor' : 'none'} />
                  </button>
                  {onEdit ? (
                    <button type="button" onClick={onEdit} aria-label="Edit entry" title="Edit entry">
                      <Pencil aria-hidden="true" />
                    </button>
                  ) : (
                    <button type="button" onClick={() => setPostReportOpen(true)} aria-label="Report entry" title="Report entry">
                      <Flag aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              <h1 id="entry-reading-title">
                {entry.title}
                {(entry.type === 'song' || entry.type === 'album') && entry.explicit && (
                  <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>
                )}
              </h1>
              {entry.creator && <p className="entry-reading-creator">{entry.creator}</p>}
              <div className="entry-reading-rating" aria-label={`Rated ${entry.rating} out of 5`}>
                <StarRating rating={entry.rating} />
                <span>{entry.rating > 0 ? `${entry.rating}/5` : 'Not rated'}</span>
              </div>
              <div className="entry-reading-byline">
                <button type="button" onClick={() => onOpenProfile?.(displayAuthorHandle)} title={`View @${displayAuthorHandle}'s profile`}>
                  <span className="entry-reading-avatar" aria-hidden="true"><User /></span>
                  <strong>@{displayAuthorHandle}</strong>
                </button>
                {entry.createdAt && (
                  <span className="entry-reading-date"><Calendar aria-hidden="true" /><span>{formatFullDateTime(entry.createdAt)}</span></span>
                )}
              </div>
            </div>
            </div>

            {entry.favoritePassage && (
              <blockquote className="entry-reading-quote">
                <span className="entry-reading-quote-mark" aria-hidden="true">&#x201C;</span>
                <div><span>{passageLabel}</span><FormattedText text={entry.favoritePassage} align={entry.passageAlign} /></div>
              </blockquote>
            )}
          </header>

          <div className="entry-reading-body-grid">
            <section className="entry-reading-reflection" aria-labelledby="entry-reflection-heading">
              <div className="entry-reading-section-heading"><span>Personal notes</span><h2 id="entry-reflection-heading">Reflection</h2></div>
              {entry.reflection ? (
                <div className="entry-reading-prose">
                  {showDropCap ? (
                    <div className="dropcap-container">
                      <span className={`dropcap-letter ${isEmoji ? 'is-emoji' : ''} ${isLowercase ? 'is-lowercase' : ''}`}>{firstChar}</span>
                      <span className="dropcap-body"><FormattedText text={restText} align={entry.reflectionAlign} reflowPlainText /></span>
                    </div>
                  ) : <FormattedText text={entry.reflection} align={entry.reflectionAlign} reflowPlainText />}
                </div>
              ) : <p className="entry-reading-empty-reflection">No written reflection was added to this entry.</p>}
            </section>
          </div>

          {/* ── Cover + Metadata ── */}
          {/* ── Reflection body ── */}
          {/* ── Social bar ── */}
          {/* ── Comments & Discussion ── */}
          <section className="entry-reading-discussion" aria-labelledby="entry-discussion-heading">
            <div className="entry-reading-discussion-intro">
              <span>Community</span>
              <h2 id="entry-discussion-heading">Join the discussion</h2>
              <p>{comments.length === 0 ? 'Be the first to leave a thoughtful response.' : `${comments.length} ${comments.length === 1 ? 'response' : 'responses'} so far.`}</p>
            </div>
            <div className="overlay-comments-header entry-reading-sort-row">
              <span className="entry-reading-response-count">Responses ({comments.length})</span>
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
          </section>
        </motion.article>
      </div>

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
      </main>
  )
}

// Backward-compatible export for permission-focused component tests and any
// integrations that have not migrated to the dedicated page name yet.
export const CardOverlayModal = EntryReadingPage
