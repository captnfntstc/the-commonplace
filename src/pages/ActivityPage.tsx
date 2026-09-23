import React, { useRef, useState } from 'react'
import { Activity, BookOpen, Bookmark, Heart, MessageSquare, Users } from 'lucide-react'
import { SettingsSection } from '../components/Settings/SettingsSection'
import type { Entry } from '../features/entries/model'
import {
  loadPostComments,
  loadPostEntry,
  type CloudCommentReply,
  type PostEngagement,
} from '../services/cloudData'
import { formatFullDateTime, formatRelativeTime } from '../utils/dateUtils'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'

type ActivityEntryFocus = {
  commentId?: string
  replyId?: string
}

type CommentActivity = ActivityEntryFocus & {
  id: string
  entry: Entry
  interaction: CloudCommentReply
  kind: 'Comment' | 'Reply'
}

interface ActivityPageProps {
  entries: Entry[]
  availableEntries: Entry[]
  engagements: Record<string, PostEngagement>
  likedEntryIds: string[]
  likedCount: number
  savedCount: number
  followingCount: number
  currentUserId?: string
  currentUserHandle?: string
  onOpenEntry: (entry: Entry, focus?: ActivityEntryFocus) => void
}

export const ActivityPage: React.FC<ActivityPageProps> = ({
  entries,
  availableEntries,
  engagements,
  likedEntryIds,
  likedCount,
  savedCount,
  followingCount,
  currentUserId,
  currentUserHandle,
  onOpenEntry,
}) => {
  const [activeActivityModal, setActiveActivityModal] = useState<'likes' | 'comments' | null>(null)
  const [activityModalLoading, setActivityModalLoading] = useState(false)
  const [activityModalError, setActivityModalError] = useState('')
  const [likedActivityEntries, setLikedActivityEntries] = useState<Entry[]>([])
  const [commentActivity, setCommentActivity] = useState<CommentActivity[]>([])
  const activityRequestRef = useRef(0)
  const likesReceived = entries.reduce((total, entry) => total + (engagements[entry.id]?.likeCount || 0), 0)
  const commentsReceived = entries.reduce((total, entry) => total + (engagements[entry.id]?.commentCount || 0), 0)
  const recentEntries = [...entries]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 8)

  const stats = [
    { label: 'Catalog entries', value: entries.length, Icon: BookOpen },
    { label: 'Likes received', value: likesReceived, Icon: Heart },
    { label: 'Comments received', value: commentsReceived, Icon: MessageSquare },
    { label: 'Items you liked', value: likedCount, Icon: Activity },
    { label: 'Saved entries', value: savedCount, Icon: Bookmark },
    { label: 'Following', value: followingCount, Icon: Users },
  ]

  const resolveLikedEntries = async () => {
    const knownEntries = new Map(
      [...availableEntries, ...entries].map((entry) => [entry.id, entry]),
    )
    const resolved = await Promise.all(likedEntryIds.map(async (entryId) => {
      const known = knownEntries.get(entryId)
      if (known) return known
      try {
        return await loadPostEntry(entryId)
      } catch {
        return null
      }
    }))
    return resolved.filter((entry): entry is Entry => Boolean(entry))
  }

  const openLikedEntries = async () => {
    const requestId = ++activityRequestRef.current
    setActiveActivityModal('likes')
    setActivityModalLoading(true)
    setActivityModalError('')
    try {
      const resolved = await resolveLikedEntries()
      if (activityRequestRef.current === requestId) setLikedActivityEntries(resolved)
    } catch {
      if (activityRequestRef.current === requestId) {
        setActivityModalError('Your liked entries could not be loaded right now.')
      }
    } finally {
      if (activityRequestRef.current === requestId) setActivityModalLoading(false)
    }
  }

  const openCommentHistory = async () => {
    const requestId = ++activityRequestRef.current
    setActiveActivityModal('comments')
    setActivityModalLoading(true)
    setActivityModalError('')
    try {
      const resolvedLikes = await resolveLikedEntries()
      const candidateEntries = [...new Map(
        [...availableEntries, ...entries, ...resolvedLikes].map((entry) => [entry.id, entry]),
      ).values()]
      const normalizedHandle = currentUserHandle?.replace(/^@/, '').toLowerCase()
      const belongsToCurrentUser = (interaction: CloudCommentReply) => (
        Boolean(currentUserId && interaction.authorId === currentUserId)
        || Boolean(normalizedHandle && interaction.authorHandle?.replace(/^@/, '').toLowerCase() === normalizedHandle)
      )
      const histories = await Promise.all(candidateEntries.map(async (entry) => {
        try {
          const comments = await loadPostComments(entry.id, currentUserId)
          return comments.flatMap((comment): CommentActivity[] => {
            const items: CommentActivity[] = []
            if (belongsToCurrentUser(comment)) {
              items.push({
                id: `${entry.id}:comment:${comment.id}`,
                entry,
                interaction: comment,
                kind: 'Comment',
                commentId: comment.id,
              })
            }
            comment.replies.forEach((reply) => {
              if (!belongsToCurrentUser(reply)) return
              items.push({
                id: `${entry.id}:reply:${reply.id}`,
                entry,
                interaction: reply,
                kind: 'Reply',
                commentId: comment.id,
                replyId: reply.id,
              })
            })
            return items
          })
        } catch {
          return []
        }
      }))
      const sortedHistory = histories.flat().sort((left, right) => (
        new Date(right.interaction.createdAt).getTime() - new Date(left.interaction.createdAt).getTime()
      ))
      if (activityRequestRef.current === requestId) setCommentActivity(sortedHistory)
    } catch {
      if (activityRequestRef.current === requestId) {
        setActivityModalError('Your comment history could not be loaded right now.')
      }
    } finally {
      if (activityRequestRef.current === requestId) setActivityModalLoading(false)
    }
  }

  const closeActivityModal = () => {
    activityRequestRef.current += 1
    setActiveActivityModal(null)
    setActivityModalLoading(false)
    setActivityModalError('')
  }
  const activityDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: Boolean(activeActivityModal),
    onClose: closeActivityModal,
  })

  return (
    <main className="page-wrapper account-utility-page">
      <div className="account-utility-container">
        <header className="activity-page-heading">
          <h1>Activity</h1>
          <p>A private overview of your catalog and interactions.</p>
        </header>

        <section className="activity-stat-grid" aria-label="Activity summary">
          {stats.map(({ label, value, Icon }) => (
            <article className="activity-stat-card" key={label}>
              <Icon aria-hidden="true" />
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </section>

        <div className="activity-log-section">
          <SettingsSection title="Personal Activity Logs" description="View entries you have liked or commented on.">
            <div className="activity-log-actions">
              <button
                type="button"
                className="secondary-action-btn"
                onClick={openLikedEntries}
              >
                <span>❤️ View My Liked Entries</span>
              </button>
              <button
                type="button"
                className="secondary-action-btn"
                onClick={openCommentHistory}
              >
                <span>💬 View My Comments History</span>
              </button>
            </div>
          </SettingsSection>
        </div>

        <section className="account-utility-section">
          <div className="account-utility-section-heading">
            <div>
              <h2>Recently published</h2>
              <p>Your latest additions to the catalog.</p>
            </div>
          </div>
          {recentEntries.length > 0 ? (
            <div className="activity-entry-list">
              {recentEntries.map((entry) => (
                <button type="button" key={entry.id} onClick={() => onOpenEntry(entry)}>
                  <span className="activity-entry-cover">
                    {entry.coverUrl
                      ? <img src={entry.coverUrl} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                      : <BookOpen aria-hidden="true" />}
                  </span>
                  <span className="activity-entry-copy">
                    <strong>{entry.title}</strong>
                    <small>{entry.creator || entry.type}</small>
                  </span>
                  <span className="activity-entry-date" title={formatFullDateTime(entry.createdAt)}>
                    {formatRelativeTime(entry.createdAt)}
                  </span>
                  <span className="activity-entry-engagement">
                    <Heart aria-hidden="true" /> {engagements[entry.id]?.likeCount || 0}
                    <MessageSquare aria-hidden="true" /> {engagements[entry.id]?.commentCount || 0}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="account-utility-empty">
              <BookOpen aria-hidden="true" />
              <p>Your published entries will appear here.</p>
            </div>
          )}
        </section>
      </div>

      {activeActivityModal && (
        <div className="modal-backdrop" onClick={closeActivityModal}>
          <div
            ref={activityDialogRef}
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-log-modal-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-header">
              <h2 id="activity-log-modal-title">
                {activeActivityModal === 'likes' ? '❤️ My Liked Entries' : '💬 My Comments & Replies'}
              </h2>
            </div>
            <p className="activity-log-modal-description">
              {activeActivityModal === 'likes'
                ? 'Below is the list of entries you have recently liked across The Commonplace.'
                : 'Below is your recent comment activity and replies across reviews.'}
            </p>
            {activityModalLoading ? (
              <div className="activity-log-modal-empty" role="status">Loading your activity…</div>
            ) : activityModalError ? (
              <div className="activity-log-modal-empty is-error" role="alert">{activityModalError}</div>
            ) : activeActivityModal === 'likes' ? (
              likedActivityEntries.length > 0 ? (
                <div className="activity-entry-list activity-log-entry-list">
                  {likedActivityEntries.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      onClick={() => {
                        closeActivityModal()
                        onOpenEntry(entry)
                      }}
                    >
                      <span className="activity-entry-cover">
                        {entry.coverUrl
                          ? <img src={entry.coverUrl} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                          : <BookOpen aria-hidden="true" />}
                      </span>
                      <span className="activity-entry-copy">
                        <strong>{entry.title}</strong>
                        <small>{entry.creator || entry.type}</small>
                      </span>
                      <span className="activity-entry-date">Liked</span>
                      <span className="activity-entry-engagement"><Heart fill="currentColor" aria-hidden="true" /></span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="activity-log-modal-empty">No liked entries yet.</div>
              )
            ) : commentActivity.length > 0 ? (
              <div className="activity-comment-history">
                {commentActivity.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      closeActivityModal()
                      onOpenEntry(item.entry, { commentId: item.commentId, replyId: item.replyId })
                    }}
                  >
                    <span className="activity-comment-meta">
                      <strong>{item.kind} on {item.entry.title}</strong>
                      <small title={formatFullDateTime(item.interaction.createdAt)}>
                        {formatRelativeTime(item.interaction.createdAt)}
                      </small>
                    </span>
                    <span className="activity-comment-text">{item.interaction.text}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="activity-log-modal-empty">No comments or replies found in your available entries.</div>
            )}
            <div className="activity-log-modal-actions">
              <button type="button" className="ghost-btn" onClick={closeActivityModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
