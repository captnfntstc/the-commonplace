import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  MessageSquare,
  MessageSquareOff,
  Send,
  Heart,
  Trash2,
  CornerUpLeft,
  CornerDownRight,
  Eye,
  EyeOff,
  Flag,
  MoreHorizontal,
  Edit3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { ReportDialog } from '../Reports/ReportDialog'
import { showToast as showAppToast } from '../../utils/toast'

export interface CollectionReply {
  id: string
  authorName: string
  authorHandle: string
  text: string
  createdAt: number
  likesCount?: number
  isLiked?: boolean
  isHidden?: boolean
}

export interface CollectionComment {
  id: string
  collectionId: string
  authorName: string
  authorHandle: string
  text: string
  createdAt: number
  likesCount?: number
  isLiked?: boolean
  isHidden?: boolean
  replies?: CollectionReply[]
}

interface CollectionCommentsSectionProps {
  collectionId: string
  collectionName: string
  currentUserHandle: string
  commentsDisabled: boolean
  isCollectionOwner?: boolean
  creatorHandle?: string
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getStorageKey(collectionId: string): string {
  return `tcp.collection_comments.${collectionId}`
}

function getReportedKey(collectionId: string): string {
  return `tcp.collection_reported_comments.${collectionId}`
}

function loadStoredComments(collectionId: string): CollectionComment[] {
  try {
    const raw = localStorage.getItem(getStorageKey(collectionId))
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (err) {
    console.error('Failed to parse collection comments', err)
  }

  // Initial seed comments
  return [
    {
      id: `seed-1-${collectionId}`,
      collectionId,
      authorName: 'captnfntstc',
      authorHandle: 'captnfntstc',
      text: 'Such a curated and thoughtful collection. Love the pacing between the films and records here.',
      createdAt: Date.now() - 1000 * 60 * 60 * 36,
      likesCount: 3,
      replies: [
        {
          id: `seed-r1-${collectionId}`,
          authorName: 'The Commonplace Admin',
          authorHandle: 'tcpadmin',
          text: 'Completely agree, the sequence has incredible rhythm.',
          createdAt: Date.now() - 1000 * 60 * 60 * 18,
          likesCount: 1,
        },
      ],
    },
    {
      id: `seed-2-${collectionId}`,
      collectionId,
      authorName: 'The Commonplace Admin',
      authorHandle: 'tcpadmin',
      text: 'Verified selection. Great commonplace notebook curation.',
      createdAt: Date.now() - 1000 * 60 * 60 * 6,
      likesCount: 2,
      replies: [],
    },
  ]
}

function saveStoredComments(collectionId: string, comments: CollectionComment[]) {
  try {
    localStorage.setItem(getStorageKey(collectionId), JSON.stringify(comments))
  } catch (err) {
    console.error('Failed to save collection comments', err)
  }
}

export const CollectionCommentsSection: React.FC<CollectionCommentsSectionProps> = ({
  collectionId,
  collectionName: _collectionName,
  currentUserHandle,
  commentsDisabled,
  isCollectionOwner = false,
  creatorHandle = '',
}) => {
  const [comments, setComments] = useState<CollectionComment[]>(() => loadStoredComments(collectionId))
  const [inputText, setInputText] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [expandedReplyCommentIds, setExpandedReplyCommentIds] = useState<Set<string>>(new Set())
  const [activeMenu, setActiveMenu] = useState<{
    id: string
    type: 'comment' | 'reply'
    commentId: string
    replyId?: string
    rect: DOMRect
  } | null>(null)

  // Textarea refs for resetting heights
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Section collapse state
  const [isSectionCollapsed, setIsSectionCollapsed] = useState(false)

  // Show more / less state for long comments
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Inline editing state
  const [editingTarget, setEditingTarget] = useState<{
    id: string
    type: 'comment' | 'reply'
    parentCommentId?: string
  } | null>(null)
  const [editingText, setEditingText] = useState('')

  // Report Dialog state
  const [reportTarget, setReportTarget] = useState<{
    targetType: 'comment' | 'reply'
    targetId: string
    targetLabel: string
  } | null>(null)

  // Reported comments/replies hidden for this user session
  const [reportedIds, setReportedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(getReportedKey(collectionId))
      return new Set(raw ? JSON.parse(raw) : [])
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    setComments(loadStoredComments(collectionId))
  }, [collectionId])

  useEffect(() => {
    if (!activeMenu) return
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('.comment-dropdown-menu.is-portaled')) return
      setActiveMenu(null)
    }
    const handleScrollOrResize = () => {
      setActiveMenu(null)
    }
    window.addEventListener('click', handleOutsideClick)
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      window.removeEventListener('click', handleOutsideClick)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [activeMenu])

  // Reset textarea heights when content is cleared
  useEffect(() => {
    if (!inputText && commentTextareaRef.current) {
      commentTextareaRef.current.style.height = 'auto'
    }
  }, [inputText])

  useEffect(() => {
    if (!replyText && replyTextareaRef.current) {
      replyTextareaRef.current.style.height = 'auto'
    }
  }, [replyText])

  // Prompt confirmation on refresh/navigation when user has typed text in comments/replies
  useEffect(() => {
    const hasUnsavedContent = Boolean(
      inputText.trim() ||
      replyText.trim() ||
      editingText.trim()
    )
    if (!hasUnsavedContent) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'You have an unsaved comment. If you leave or refresh, your text will disappear.'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [inputText, replyText, editingText])

  const showToast = (msg: string, kind?: 'success' | 'error') => {
    showAppToast(msg, kind)
  }

  const toggleRepliesExpanded = (commentId: string) => {
    setExpandedReplyCommentIds((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) next.delete(commentId)
      else next.add(commentId)
      return next
    })
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target
    target.style.height = 'auto'
    target.style.height = `${Math.min(target.scrollHeight, 180)}px`
  }

  const toggleMenu = (
    type: 'comment' | 'reply',
    commentId: string,
    replyId: string | undefined,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation()
    const key = replyId ? `reply-${replyId}` : `comment-${commentId}`
    if (activeMenu?.id === key) {
      setActiveMenu(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setActiveMenu({
      id: key,
      type,
      commentId,
      replyId,
      rect,
    })
  }

  const getPortalMenuStyle = (rect: DOMRect): React.CSSProperties => {
    const menuEstimatedHeight = 160
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < menuEstimatedHeight && rect.top > menuEstimatedHeight

    // Align right edge of menu with right edge of the button
    const right = Math.max(12, window.innerWidth - rect.right)

    return {
      position: 'fixed',
      zIndex: 99999,
      right: `${right}px`,
      top: openUpward ? 'auto' : `${Math.round(rect.bottom + 4)}px`,
      bottom: openUpward ? `${Math.round(window.innerHeight - rect.top + 4)}px` : 'auto',
    }
  }

  const startEditing = (type: 'comment' | 'reply', id: string, currentText: string, parentCommentId?: string) => {
    setEditingTarget({ id, type, parentCommentId })
    setEditingText(currentText)
    setActiveMenu(null)
  }

  const cancelEditing = () => {
    setEditingTarget(null)
    setEditingText('')
  }

  const saveEditing = () => {
    if (!editingTarget) return
    const trimmed = editingText.trim()
    if (!trimmed) {
      showToast('Comment cannot be empty.')
      return
    }

    try {
      if (editingTarget.type === 'comment') {
        const updated = comments.map((c) =>
          c.id === editingTarget.id ? { ...c, text: trimmed } : c
        )
        setComments(updated)
        saveStoredComments(collectionId, updated)
      } else if (editingTarget.type === 'reply' && editingTarget.parentCommentId) {
        const updated = comments.map((c) => {
          if (c.id === editingTarget.parentCommentId) {
            const updatedReplies = (c.replies || []).map((r) =>
              r.id === editingTarget.id ? { ...r, text: trimmed } : r
            )
            return { ...c, replies: updatedReplies }
          }
          return c
        })
        setComments(updated)
        saveStoredComments(collectionId, updated)
      }
      cancelEditing()
      showToast('Comment updated.')
    } catch {
      showToast('An error has occurred.')
    }
  }

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed) return

    try {
      const newComment: CollectionComment = {
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        collectionId,
        authorName: currentUserHandle || 'Reader',
        authorHandle: currentUserHandle || 'reader',
        text: trimmed,
        createdAt: Date.now(),
        likesCount: 0,
        isLiked: false,
        replies: [],
      }

      const updated = [newComment, ...comments]
      setComments(updated)
      saveStoredComments(collectionId, updated)
      setInputText('')
      if (commentTextareaRef.current) {
        commentTextareaRef.current.style.height = 'auto'
      }
    } catch {
      showToast('An error has occurred.')
    }
  }

  const handleAddReply = (commentId: string) => {
    const trimmed = replyText.trim()
    if (!trimmed) return

    try {
      const newReply: CollectionReply = {
        id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        authorName: currentUserHandle || 'Reader',
        authorHandle: currentUserHandle || 'reader',
        text: trimmed,
        createdAt: Date.now(),
        likesCount: 0,
        isLiked: false,
      }

      const updated = comments.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            replies: [...(c.replies || []), newReply],
          }
        }
        return c
      })

      setComments(updated)
      saveStoredComments(collectionId, updated)
      setReplyText('')
      setReplyingToId(null)
      setExpandedReplyCommentIds((prev) => new Set(prev).add(commentId))
      if (replyTextareaRef.current) {
        replyTextareaRef.current.style.height = 'auto'
      }
    } catch {
      showToast('An error has occurred.')
    }
  }

  const handleToggleCommentLike = (commentId: string) => {
    const updated = comments.map((c) => {
      if (c.id === commentId) {
        const isLiked = !c.isLiked
        const likesCount = (c.likesCount || 0) + (isLiked ? 1 : -1)
        return { ...c, isLiked, likesCount: Math.max(0, likesCount) }
      }
      return c
    })
    setComments(updated)
    saveStoredComments(collectionId, updated)
  }

  const handleToggleReplyLike = (commentId: string, replyId: string) => {
    const updated = comments.map((c) => {
      if (c.id === commentId) {
        const updatedReplies = (c.replies || []).map((r) => {
          if (r.id === replyId) {
            const isLiked = !r.isLiked
            const likesCount = (r.likesCount || 0) + (isLiked ? 1 : -1)
            return { ...r, isLiked, likesCount: Math.max(0, likesCount) }
          }
          return r
        })
        return { ...c, replies: updatedReplies }
      }
      return c
    })
    setComments(updated)
    saveStoredComments(collectionId, updated)
  }

  const handleDeleteComment = (commentId: string) => {
    const updated = comments.filter((c) => c.id !== commentId)
    setComments(updated)
    saveStoredComments(collectionId, updated)
  }

  const handleDeleteReply = (commentId: string, replyId: string) => {
    const updated = comments.map((c) => {
      if (c.id === commentId) {
        return {
          ...c,
          replies: (c.replies || []).filter((r) => r.id !== replyId),
        }
      }
      return c
    })
    setComments(updated)
    saveStoredComments(collectionId, updated)
  }

  const handleToggleHideComment = (commentId: string) => {
    if (!isCollectionOwner) return
    const updated = comments.map((c) => {
      if (c.id === commentId) {
        return { ...c, isHidden: !c.isHidden }
      }
      return c
    })
    setComments(updated)
    saveStoredComments(collectionId, updated)
  }

  const handleToggleHideReply = (commentId: string, replyId: string) => {
    if (!isCollectionOwner) return
    const updated = comments.map((c) => {
      if (c.id === commentId) {
        const updatedReplies = (c.replies || []).map((r) => {
          if (r.id === replyId) {
            return { ...r, isHidden: !r.isHidden }
          }
          return r
        })
        return { ...c, replies: updatedReplies }
      }
      return c
    })
    setComments(updated)
    saveStoredComments(collectionId, updated)
  }

  const openReportDialog = (targetType: 'comment' | 'reply', targetId: string, label: string) => {
    setReportTarget({
      targetType,
      targetId,
      targetLabel: label,
    })
  }

  const handleReportSubmit = async (reason: string, details: string) => {
    if (!reportTarget) return
    const id = reportTarget.targetId
    setReportedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      try {
        localStorage.setItem(getReportedKey(collectionId), JSON.stringify([...next]))
      } catch {
        /* Storage can be unavailable */
      }
      return next
    })
    try {
      const storageKey = `tcp.collection_reports.${collectionId}`
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]')
      existing.push({
        targetType: reportTarget.targetType,
        targetId: id,
        reason,
        details,
        reportedAt: Date.now(),
        reportedBy: currentUserHandle || 'anonymous',
      })
      localStorage.setItem(storageKey, JSON.stringify(existing))
    } catch {
      /* Storage can be unavailable */
    }
    setReportTarget(null)
    showToast('Report submitted. Thank you for keeping our community safe.')
  }

  const normalizedUserHandle = currentUserHandle.replace(/^@/, '').toLowerCase()

  // Filter out reported comments or comments hidden from public (unless collection owner)
  const visibleComments = comments
    .filter((c) => !reportedIds.has(c.id))
    .filter((c) => isCollectionOwner || !c.isHidden)
    .map((c) => ({
      ...c,
      replies: (c.replies || [])
        .filter((r) => !reportedIds.has(r.id))
        .filter((r) => isCollectionOwner || !r.isHidden),
    }))

  const totalInteractionsCount = visibleComments.reduce(
    (acc, curr) => acc + 1 + (curr.replies?.length || 0),
    0,
  )

  const renderPortaledMenu = () => {
    if (!activeMenu || typeof document === 'undefined') return null

    if (activeMenu.type === 'comment') {
      const comment = comments.find((c) => c.id === activeMenu.commentId)
      if (!comment) return null

      const isAuthor =
        comment.authorHandle.replace(/^@/, '').toLowerCase() === normalizedUserHandle
      const canDelete = isAuthor || isCollectionOwner
      const canHide = isCollectionOwner
      const canReport = !isAuthor

      return createPortal(
        <div
          className="comment-dropdown-menu is-portaled"
          style={getPortalMenuStyle(activeMenu.rect)}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          {isAuthor && (
            <button
              type="button"
              className="comment-dropdown-item"
              onClick={() => startEditing('comment', comment.id, comment.text)}
              role="menuitem"
            >
              <Edit3 size={13} aria-hidden="true" />
              <span>Edit comment</span>
            </button>
          )}

          {canHide && (
            <button
              type="button"
              className="comment-dropdown-item"
              onClick={() => {
                setActiveMenu(null)
                handleToggleHideComment(comment.id)
              }}
              role="menuitem"
            >
              {comment.isHidden ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
              <span>{comment.isHidden ? 'Unhide from visitors' : 'Hide from visitors'}</span>
            </button>
          )}

          {canReport && (
            <button
              type="button"
              className="comment-dropdown-item"
              onClick={() => {
                setActiveMenu(null)
                openReportDialog('comment', comment.id, `comment by @${comment.authorHandle.replace(/^@/, '')}`)
              }}
              role="menuitem"
            >
              <Flag size={13} aria-hidden="true" />
              <span>Report comment</span>
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              className="comment-dropdown-item danger"
              onClick={() => {
                setActiveMenu(null)
                handleDeleteComment(comment.id)
              }}
              role="menuitem"
            >
              <Trash2 size={13} aria-hidden="true" />
              <span>Delete comment</span>
            </button>
          )}
        </div>,
        document.body
      )
    }

    if (activeMenu.type === 'reply') {
      const parentComment = comments.find((c) => c.id === activeMenu.commentId)
      const reply = parentComment?.replies?.find((r) => r.id === activeMenu.replyId)
      if (!parentComment || !reply) return null

      const isReplyAuthor =
        reply.authorHandle.replace(/^@/, '').toLowerCase() === normalizedUserHandle
      const canDeleteR = isReplyAuthor || isCollectionOwner
      const canHideR = isCollectionOwner
      const canReportR = !isReplyAuthor

      return createPortal(
        <div
          className="comment-dropdown-menu is-portaled"
          style={getPortalMenuStyle(activeMenu.rect)}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          {isReplyAuthor && (
            <button
              type="button"
              className="comment-dropdown-item"
              onClick={() => startEditing('reply', reply.id, reply.text, parentComment.id)}
              role="menuitem"
            >
              <Edit3 size={12} aria-hidden="true" />
              <span>Edit reply</span>
            </button>
          )}

          {canHideR && (
            <button
              type="button"
              className="comment-dropdown-item"
              onClick={() => {
                setActiveMenu(null)
                handleToggleHideReply(parentComment.id, reply.id)
              }}
              role="menuitem"
            >
              {reply.isHidden ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
              <span>{reply.isHidden ? 'Unhide from visitors' : 'Hide from visitors'}</span>
            </button>
          )}

          {canReportR && (
            <button
              type="button"
              className="comment-dropdown-item"
              onClick={() => {
                setActiveMenu(null)
                openReportDialog('reply', reply.id, `reply by @${reply.authorHandle.replace(/^@/, '')}`)
              }}
              role="menuitem"
            >
              <Flag size={12} aria-hidden="true" />
              <span>Report reply</span>
            </button>
          )}

          {canDeleteR && (
            <button
              type="button"
              className="comment-dropdown-item danger"
              onClick={() => {
                setActiveMenu(null)
                handleDeleteReply(parentComment.id, reply.id)
              }}
              role="menuitem"
            >
              <Trash2 size={12} aria-hidden="true" />
              <span>Delete reply</span>
            </button>
          )}
        </div>,
        document.body
      )
    }

    return null
  }

  return (
    <div className="collection-comments-panel-widget">
      {/* Header with Collapse toggle */}
      <div
        className="comments-widget-header"
        onClick={() => setIsSectionCollapsed((prev) => !prev)}
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer' }}
        title={isSectionCollapsed ? 'Expand comments' : 'Collapse comments'}
      >
        <div className="comments-header-title">
          <MessageSquare size={14} aria-hidden="true" />
          <span>Comments</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="comments-count-pill">{totalInteractionsCount}</span>
          <button
            type="button"
            className="comments-collapse-toggle-btn"
            onClick={(e) => {
              e.stopPropagation()
              setIsSectionCollapsed((prev) => !prev)
            }}
            aria-label={isSectionCollapsed ? 'Expand comments' : 'Collapse comments'}
          >
            {isSectionCollapsed ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {commentsDisabled ? (
        <div className="comments-disabled-box">
          <MessageSquareOff size={18} aria-hidden="true" />
          <p>Comments are disabled for this collection.</p>
        </div>
      ) : !isSectionCollapsed && (
        <>
          <form className="comments-composer-form" onSubmit={handleAddComment}>
            <div className="comments-input-wrap">
              <textarea
                ref={commentTextareaRef}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value)
                  handleTextareaInput(e)
                }}
                placeholder="Add a comment on this collection..."
                rows={2}
                aria-label="Add a comment"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    handleAddComment(e)
                  }
                }}
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="comments-send-btn"
                aria-label="Post comment"
                title="Post comment"
              >
                <Send size={13} aria-hidden="true" />
              </button>
            </div>
          </form>

          <div className="comments-list-stream">
            {visibleComments.length === 0 ? (
              <p className="comments-empty-text">No comments yet. Be the first to share your thoughts!</p>
            ) : (
              visibleComments.map((comment) => {
                const isExpanded = expandedIds.has(comment.id)
                const isLongComment = comment.text.length > 240
                const isEditingThisComment = editingTarget?.type === 'comment' && editingTarget?.id === comment.id

                const replies = comment.replies || []
                const hasReplies = replies.length > 0
                const cleanCreator = (creatorHandle || '').replace(/^@/, '').trim().toLowerCase()
                const isRepliesExpanded = expandedReplyCommentIds.has(comment.id)

                // Find creator's first direct reply
                const creatorReply = cleanCreator
                  ? replies.find((r) => r.authorHandle.replace(/^@/, '').trim().toLowerCase() === cleanCreator)
                  : undefined

                // Visible replies: if expanded, show all; if collapsed, only creator's first reply (if any)
                const visibleReplies = isRepliesExpanded
                  ? replies
                  : creatorReply
                    ? [creatorReply]
                    : []

                return (
                  <article
                    key={comment.id}
                    className={`collection-comment-item ${comment.isHidden ? 'is-hidden-comment' : ''}`}
                  >
                    <div className="comment-header-line">
                      <span className="comment-author-avatar" aria-hidden="true">
                        {comment.authorName.charAt(0).toUpperCase()}
                      </span>
                      <div className="comment-author-meta">
                        <div className="comment-author-title-row">
                          <strong className="comment-author-name">{comment.authorName}</strong>
                          {cleanCreator && comment.authorHandle.replace(/^@/, '').trim().toLowerCase() === cleanCreator && (
                            <span className="comment-creator-badge" title="Collection Curator">Curator</span>
                          )}
                          {comment.isHidden && (
                            <span className="comment-hidden-badge" title="Hidden from public by curator">
                              Hidden
                            </span>
                          )}
                        </div>
                        <span className="comment-author-handle">@{comment.authorHandle.replace(/^@/, '')}</span>
                      </div>
                      <time className="comment-time">{formatRelativeTime(comment.createdAt)}</time>
                    </div>

                    {isEditingThisComment ? (
                      <div className="comment-inline-edit-box">
                        <textarea
                          className="comment-inline-edit-textarea"
                          value={editingText}
                          onChange={(e) => {
                            setEditingText(e.target.value)
                            handleTextareaInput(e)
                          }}
                          autoFocus
                          aria-label="Edit comment"
                        />
                        <div className="comment-inline-edit-actions">
                          <button
                            type="button"
                            className="comment-inline-edit-cancel"
                            onClick={cancelEditing}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="comment-inline-edit-save"
                            disabled={!editingText.trim()}
                            onClick={saveEditing}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="comment-body-text">
                          {isLongComment && !isExpanded
                            ? `${comment.text.slice(0, 240)}...`
                            : comment.text}
                        </p>

                        {isLongComment && (
                          <button
                            type="button"
                            className="comment-toggle-expand-btn"
                            onClick={() => toggleExpand(comment.id)}
                          >
                            {isExpanded ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </>
                    )}

                    <div className="comment-footer-actions">
                      <button
                        type="button"
                        className={`comment-action-pill ${comment.isLiked ? 'liked' : ''}`}
                        onClick={() => handleToggleCommentLike(comment.id)}
                        aria-label={comment.isLiked ? 'Unlike comment' : 'Like comment'}
                        title={comment.isLiked ? 'Unlike' : 'Like'}
                      >
                        <Heart size={12} fill={comment.isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
                        <span>{comment.likesCount || 0}</span>
                      </button>

                      <button
                        type="button"
                        className="comment-action-pill"
                        onClick={() => {
                          if (replyingToId === comment.id) {
                            setReplyingToId(null)
                            setReplyText('')
                          } else {
                            setReplyingToId(comment.id)
                            setReplyText('')
                            setExpandedReplyCommentIds((prev) => new Set(prev).add(comment.id))
                          }
                        }}
                        aria-label="Reply to comment"
                        title="Reply"
                      >
                        <CornerUpLeft size={12} aria-hidden="true" />
                        <span>Reply</span>
                      </button>

                      <div className="comment-ellipsis-wrap">
                        <button
                          type="button"
                          className="comment-action-pill comment-ellipsis-btn"
                          onClick={(e) => toggleMenu('comment', comment.id, undefined, e)}
                          aria-label="More options"
                          title="More options"
                        >
                          <MoreHorizontal size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Reply Composer */}
                    {replyingToId === comment.id && (
                      <form
                        className="comment-reply-composer"
                        onSubmit={(e) => {
                          e.preventDefault()
                          handleAddReply(comment.id)
                        }}
                      >
                        <textarea
                          ref={replyTextareaRef}
                          value={replyText}
                          onChange={(e) => {
                            setReplyText(e.target.value)
                            handleTextareaInput(e)
                          }}
                          placeholder={`Reply to @${comment.authorHandle.replace(/^@/, '')}...`}
                          rows={2}
                          autoFocus
                          aria-label="Reply text"
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                              handleAddReply(comment.id)
                            }
                          }}
                        />
                        <div className="reply-composer-actions">
                          <button
                            type="button"
                            className="reply-composer-cancel"
                            onClick={() => {
                              setReplyingToId(null)
                              setReplyText('')
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={!replyText.trim()}
                            className="reply-composer-submit"
                          >
                            <Send size={11} aria-hidden="true" />
                            <span>Reply</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Replies Toggle Controls */}
                    {!isRepliesExpanded && creatorReply && replies.length > 1 && (
                      <button
                        type="button"
                        className="comment-replies-toggle-btn"
                        onClick={() => toggleRepliesExpanded(comment.id)}
                        aria-expanded={false}
                      >
                        <CornerDownRight size={11} aria-hidden="true" />
                        <span>
                          View {replies.length - 1} other {replies.length - 1 === 1 ? 'reply' : 'replies'}
                        </span>
                      </button>
                    )}

                    {!isRepliesExpanded && !creatorReply && hasReplies && (
                      <button
                        type="button"
                        className="comment-replies-toggle-btn"
                        onClick={() => toggleRepliesExpanded(comment.id)}
                        aria-expanded={false}
                      >
                        <CornerDownRight size={11} aria-hidden="true" />
                        <span>
                          View {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                        </span>
                      </button>
                    )}

                    {isRepliesExpanded && hasReplies && (
                      <button
                        type="button"
                        className="comment-replies-toggle-btn"
                        onClick={() => toggleRepliesExpanded(comment.id)}
                        aria-expanded={true}
                      >
                        <ChevronUp size={11} aria-hidden="true" />
                        <span>Hide replies</span>
                      </button>
                    )}

                    {/* Replies Thread */}
                    {visibleReplies.length > 0 && (
                      <div className="comment-replies-list">
                        {visibleReplies.map((reply) => {
                          const isReplyExpanded = expandedIds.has(reply.id)
                          const isLongReply = reply.text.length > 240
                          const isEditingThisReply = editingTarget?.type === 'reply' && editingTarget?.id === reply.id

                          return (
                            <div
                              key={reply.id}
                              className={`comment-reply-item ${reply.isHidden ? 'is-hidden-comment' : ''}`}
                            >
                              <div className="comment-header-line">
                                <span className="comment-author-avatar-sm" aria-hidden="true">
                                  {reply.authorName.charAt(0).toUpperCase()}
                                </span>
                                <div className="comment-author-meta">
                                  <div className="comment-author-title-row">
                                    <strong className="comment-author-name">{reply.authorName}</strong>
                                    {cleanCreator && reply.authorHandle.replace(/^@/, '').trim().toLowerCase() === cleanCreator && (
                                      <span className="comment-creator-badge" title="Collection Curator">Curator</span>
                                    )}
                                    {reply.isHidden && (
                                      <span className="comment-hidden-badge" title="Hidden from public by curator">
                                        Hidden
                                      </span>
                                    )}
                                  </div>
                                  <span className="comment-author-handle">@{reply.authorHandle.replace(/^@/, '')}</span>
                                </div>
                                <time className="comment-time">{formatRelativeTime(reply.createdAt)}</time>
                              </div>

                              {isEditingThisReply ? (
                                <div className="comment-inline-edit-box">
                                  <textarea
                                    className="comment-inline-edit-textarea"
                                    value={editingText}
                                    onChange={(e) => {
                                      setEditingText(e.target.value)
                                      handleTextareaInput(e)
                                    }}
                                    autoFocus
                                    aria-label="Edit reply"
                                  />
                                  <div className="comment-inline-edit-actions">
                                    <button
                                      type="button"
                                      className="comment-inline-edit-cancel"
                                      onClick={cancelEditing}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="comment-inline-edit-save"
                                      disabled={!editingText.trim()}
                                      onClick={saveEditing}
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="comment-body-text">
                                    {isLongReply && !isReplyExpanded
                                      ? `${reply.text.slice(0, 240)}...`
                                      : reply.text}
                                  </p>

                                  {isLongReply && (
                                    <button
                                      type="button"
                                      className="comment-toggle-expand-btn"
                                      onClick={() => toggleExpand(reply.id)}
                                    >
                                      {isReplyExpanded ? 'Show less' : 'Show more'}
                                    </button>
                                  )}
                                </>
                              )}

                              <div className="comment-footer-actions">
                                <button
                                  type="button"
                                  className={`comment-action-pill ${reply.isLiked ? 'liked' : ''}`}
                                  onClick={() => handleToggleReplyLike(comment.id, reply.id)}
                                  aria-label={reply.isLiked ? 'Unlike reply' : 'Like reply'}
                                  title={reply.isLiked ? 'Unlike' : 'Like'}
                                >
                                  <Heart size={11} fill={reply.isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
                                  <span>{reply.likesCount || 0}</span>
                                </button>

                                <div className="comment-ellipsis-wrap">
                                  <button
                                    type="button"
                                    className="comment-action-pill comment-ellipsis-btn"
                                    onClick={(e) => toggleMenu('reply', comment.id, reply.id, e)}
                                    aria-label="More options"
                                    title="More options"
                                  >
                                    <MoreHorizontal size={12} aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Report dialog modal: asks why the comment is being reported */}
      <ReportDialog
        open={Boolean(reportTarget)}
        targetType={reportTarget?.targetType === 'reply' ? 'comment' : 'comment'}
        targetLabel={reportTarget?.targetLabel || 'comment'}
        onClose={() => setReportTarget(null)}
        onSubmit={handleReportSubmit}
      />

      {/* Portaled Ellipsis Menu: renders directly into document.body outside any container */}
      {renderPortaledMenu()}
    </div>
  )
}

export default CollectionCommentsSection
