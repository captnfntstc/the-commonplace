import React, { useState, useEffect } from 'react'
import {
  MessageSquare,
  MessageSquareOff,
  Send,
  Heart,
  Trash2,
  CornerUpLeft,
  Eye,
  EyeOff,
  Flag,
  MoreHorizontal,
  Share2,
} from 'lucide-react'
import { ReportDialog } from '../Reports/ReportDialog'

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
  currentUserHandle,
  commentsDisabled,
  isCollectionOwner = false,
}) => {
  const [comments, setComments] = useState<CollectionComment[]>(() => loadStoredComments(collectionId))
  const [inputText, setInputText] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
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
    if (!activeMenuId) return
    const handleOutsideClick = () => setActiveMenuId(null)
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [activeMenuId])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleShareComment = async (type: 'comment' | 'reply', id: string) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#${type}-${id}`
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        showToast('Comment link copied to clipboard!')
      } else {
        showToast('Comment link ready.')
      }
    } catch {
      showToast('Comment link ready.')
    }
  }

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed) return

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
  }

  const handleAddReply = (commentId: string) => {
    const trimmed = replyText.trim()
    if (!trimmed) return

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
      } catch {}
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
    } catch {}
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

  return (
    <div className="collection-comments-panel-widget">
      <div className="comments-widget-header">
        <div className="comments-header-title">
          <MessageSquare size={14} aria-hidden="true" />
          <span>Comments</span>
        </div>
        <span className="comments-count-pill">{totalInteractionsCount}</span>
      </div>

      {toastMessage && (
        <div className="collection-comments-toast" role="status">
          <Flag size={12} aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {commentsDisabled ? (
        <div className="comments-disabled-box">
          <MessageSquareOff size={18} aria-hidden="true" />
          <p>Comments are disabled for this collection.</p>
        </div>
      ) : (
        <>
          <form className="comments-composer-form" onSubmit={handleAddComment}>
            <div className="comments-input-wrap">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Add a comment on this collection..."
                rows={2}
                maxLength={500}
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
                const isAuthor =
                  comment.authorHandle.replace(/^@/, '').toLowerCase() === normalizedUserHandle
                const canDelete = isAuthor || isCollectionOwner
                const canHide = isCollectionOwner
                const canReport = !isAuthor

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
                        <strong className="comment-author-name">{comment.authorName}</strong>
                        <span className="comment-author-handle">@{comment.authorHandle.replace(/^@/, '')}</span>
                        {comment.isHidden && (
                          <span className="comment-hidden-badge" title="Hidden from public by curator">
                            Hidden
                          </span>
                        )}
                      </div>
                      <time className="comment-time">{formatRelativeTime(comment.createdAt)}</time>
                    </div>

                    <p className="comment-body-text">{comment.text}</p>

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
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveMenuId((prev) => (prev === `comment-${comment.id}` ? null : `comment-${comment.id}`))
                            }}
                            aria-label="More options"
                            title="More options"
                          >
                            <MoreHorizontal size={13} aria-hidden="true" />
                          </button>

                          {activeMenuId === `comment-${comment.id}` && (
                            <div className="comment-dropdown-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="comment-dropdown-item"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  void handleShareComment('comment', comment.id)
                                }}
                                role="menuitem"
                              >
                                <Share2 size={13} aria-hidden="true" />
                                <span>Share comment</span>
                              </button>

                              {canHide && (
                                <button
                                  type="button"
                                  className="comment-dropdown-item"
                                  onClick={() => {
                                    setActiveMenuId(null)
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
                                    setActiveMenuId(null)
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
                                    setActiveMenuId(null)
                                    handleDeleteComment(comment.id)
                                  }}
                                  role="menuitem"
                                >
                                  <Trash2 size={13} aria-hidden="true" />
                                  <span>Delete comment</span>
                                </button>
                              )}
                            </div>
                          )}
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
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Reply to @${comment.authorHandle.replace(/^@/, '')}...`}
                          rows={2}
                          maxLength={300}
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

                    {/* Replies Thread */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="comment-replies-list">
                        {comment.replies.map((reply) => {
                          const isReplyAuthor =
                            reply.authorHandle.replace(/^@/, '').toLowerCase() === normalizedUserHandle
                          const canDeleteR = isReplyAuthor || isCollectionOwner
                          const canHideR = isCollectionOwner
                          const canReportR = !isReplyAuthor

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
                                  <strong className="comment-author-name">{reply.authorName}</strong>
                                  <span className="comment-author-handle">@{reply.authorHandle.replace(/^@/, '')}</span>
                                  {reply.isHidden && (
                                    <span className="comment-hidden-badge" title="Hidden from public by curator">
                                      Hidden
                                    </span>
                                  )}
                                </div>
                                <time className="comment-time">{formatRelativeTime(reply.createdAt)}</time>
                              </div>

                              <p className="comment-body-text">{reply.text}</p>

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
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setActiveMenuId((prev) => (prev === `reply-${reply.id}` ? null : `reply-${reply.id}`))
                                      }}
                                      aria-label="More options"
                                      title="More options"
                                    >
                                      <MoreHorizontal size={12} aria-hidden="true" />
                                    </button>

                                    {activeMenuId === `reply-${reply.id}` && (
                                      <div className="comment-dropdown-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          className="comment-dropdown-item"
                                          onClick={() => {
                                            setActiveMenuId(null)
                                            void handleShareComment('reply', reply.id)
                                          }}
                                          role="menuitem"
                                        >
                                          <Share2 size={12} aria-hidden="true" />
                                          <span>Share reply</span>
                                        </button>

                                        {canHideR && (
                                          <button
                                            type="button"
                                            className="comment-dropdown-item"
                                            onClick={() => {
                                              setActiveMenuId(null)
                                              handleToggleHideReply(comment.id, reply.id)
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
                                              setActiveMenuId(null)
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
                                              setActiveMenuId(null)
                                              handleDeleteReply(comment.id, reply.id)
                                            }}
                                            role="menuitem"
                                          >
                                            <Trash2 size={12} aria-hidden="true" />
                                            <span>Delete reply</span>
                                          </button>
                                        )}
                                      </div>
                                    )}
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

      {reportTarget && (
        <ReportDialog
          open={Boolean(reportTarget)}
          targetType={reportTarget.targetType}
          targetLabel={reportTarget.targetLabel}
          onClose={() => setReportTarget(null)}
          onSubmit={handleReportSubmit}
        />
      )}
    </div>
  )
}

export default CollectionCommentsSection
