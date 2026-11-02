import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  BookOpen,
  Bookmark,
  Calendar,
  Compass,
  Eye,
  Heart,
  MessageSquare,
  Search,
  Sparkles,
  Trash2,
  Users,
  Send,
  ExternalLink,
} from 'lucide-react'
import type { Entry } from '../features/entries/model'
import {
  loadPostComments,
  loadPostEntry,
  type CloudCommentReply,
  type PostEngagement,
} from '../services/cloudData'
import {
  getReadingHistory,
  clearReadingHistory,
  getVisitedProfiles,
  clearVisitedProfiles,
  getRecentSearches,
  type ReadingHistoryItem,
  type VisitedProfileItem,
} from '../services/activityHistory'
import type { RecentSearchItem } from '../components/Search/PrimarySearch'
import { formatFullDateTime, formatRelativeTime } from '../utils/dateUtils'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'

export type ActivityEntryFocus = {
  commentId?: string
  replyId?: string
}

export type CommentActivity = ActivityEntryFocus & {
  id: string
  entry: Entry
  interaction: CloudCommentReply
  kind: 'Comment' | 'Reply'
}

export interface ActivityPageProps {
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
  onOpenProfile?: (handle: string) => void
  onOpenSearch?: (query?: string) => void
}

export const ActivityPage: React.FC<ActivityPageProps> = ({
  entries,
  availableEntries,
  engagements,
  likedEntryIds,
  likedCount,
  savedCount,
  currentUserId,
  currentUserHandle,
  onOpenEntry,
  onOpenProfile,
  onOpenSearch,
}) => {
  // Modal states (preserves deep inspector & test compatibility)
  const [activeActivityModal, setActiveActivityModal] = useState<'likes' | 'comments' | null>(null)
  const [activityModalLoading, setActivityModalLoading] = useState(false)
  const [activityModalError, setActivityModalError] = useState('')
  const [likedActivityEntries, setLikedActivityEntries] = useState<Entry[]>([])
  const [commentActivity, setCommentActivity] = useState<CommentActivity[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)

  // Local activity state (reading history, visited profiles, recent searches initialized lazily)
  const [readingHistory, setReadingHistory] = useState<ReadingHistoryItem[]>(() => getReadingHistory())
  const [visitedProfiles, setVisitedProfiles] = useState<VisitedProfileItem[]>(() => getVisitedProfiles())
  const [recentSearches] = useState<RecentSearchItem[]>(() => getRecentSearches())
  const [now] = useState(() => Date.now())

  // Section tabs & filters
  const [postFilter, setPostFilter] = useState<'7days' | 'all'>('7days')
  const [interactionTab, setInteractionTab] = useState<'likes' | 'comments' | 'reading'>('likes')

  const activityRequestRef = useRef(0)

  // Aggregate metrics
  const likesReceived = useMemo(() => (
    entries.reduce((total, entry) => total + (engagements[entry.id]?.likeCount || 0), 0)
  ), [entries, engagements])

  const commentsReceived = useMemo(() => (
    entries.reduce((total, entry) => total + (engagements[entry.id]?.commentCount || 0), 0)
  ), [entries, engagements])

  // Filter posts in the last 7 days
  const postsLast7Days = useMemo(() => {
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    return [...entries]
      .filter((entry) => new Date(entry.createdAt).getTime() >= sevenDaysAgo)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [entries, now])

  const sortedAllEntries = useMemo(() => {
    return [...entries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [entries])

  const displayedPosts = postFilter === '7days' ? postsLast7Days : sortedAllEntries

  // Resolve liked entries
  const resolveLikedEntries = React.useCallback(async () => {
    const knownEntries = new Map(
      [...availableEntries, ...entries].map((entry) => [entry.id, entry]),
    )
    const resolved = await Promise.all(
      likedEntryIds.map(async (entryId) => {
        const known = knownEntries.get(entryId)
        if (known) return known
        try {
          return await loadPostEntry(entryId)
        } catch {
          return null
        }
      }),
    )
    return resolved.filter((entry): entry is Entry => Boolean(entry))
  }, [availableEntries, entries, likedEntryIds])

  // Pre-load likes and comments for inline display and telemetry
  useEffect(() => {
    let isCancelled = false
    const loadInlineInteractions = async () => {
      try {
        const resolved = await resolveLikedEntries()
        if (!isCancelled) setLikedActivityEntries(resolved)
      } catch {
        // Silently continue
      }

      setCommentsLoading(true)
      try {
        const knownEntries = [...new Map(
          [...availableEntries, ...entries].map((entry) => [entry.id, entry]),
        ).values()]
        const normalizedHandle = currentUserHandle?.replace(/^@/, '').toLowerCase()
        const belongsToCurrentUser = (interaction: CloudCommentReply) => (
          Boolean(currentUserId && interaction.authorId === currentUserId)
          || Boolean(normalizedHandle && interaction.authorHandle?.replace(/^@/, '').toLowerCase() === normalizedHandle)
        )

        const histories = await Promise.all(
          knownEntries.map(async (entry) => {
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
          }),
        )

        const sortedHistory = histories.flat().sort((a, b) => (
          new Date(b.interaction.createdAt).getTime() - new Date(a.interaction.createdAt).getTime()
        ))

        if (!isCancelled) setCommentActivity(sortedHistory)
      } catch {
        // Silently continue
      } finally {
        if (!isCancelled) setCommentsLoading(false)
      }
    }

    loadInlineInteractions()
    return () => {
      isCancelled = true
    }
  }, [availableEntries, entries, likedEntryIds, currentUserId, currentUserHandle, resolveLikedEntries])

  // Open modal handlers (matches existing test assertions)
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

  // Clear local traces handlers
  const handleClearReadingHistory = () => {
    clearReadingHistory()
    setReadingHistory([])
  }

  const handleClearVisitedProfiles = () => {
    clearVisitedProfiles()
    setVisitedProfiles([])
  }

  // Find entry for reading item
  const handleOpenReadingItem = (item: ReadingHistoryItem) => {
    const found = availableEntries.find((e) => e.id === item.id) || entries.find((e) => e.id === item.id)
    if (found) {
      onOpenEntry(found)
    } else {
      // Fallback synthetic entry object to let reader view display
      onOpenEntry({
        id: item.id,
        ownerId: '',
        title: item.title,
        creator: item.creator || '',
        type: (item.type as any) || 'book',
        provider: 'Manual',
        providerId: item.id,
        rating: 0,
        coverTone: 'gold',
        coverUrl: item.coverUrl,
        favoritePassage: '',
        reflection: '',
        createdAt: item.openedAt,
        updatedAt: item.openedAt,
      })
    }
  }

  // 8 Balanced glance metrics for an even 4x2 grid
  const glanceStats = [
    { label: 'Catalog Entries', value: entries.length, Icon: BookOpen, helper: 'Published in library' },
    { label: 'Likes Received', value: likesReceived, Icon: Heart, helper: 'On your entries' },
    { label: 'Likes Given', value: likedCount, Icon: Sparkles, helper: 'Entries appreciated' },
    { label: 'Comments Received', value: commentsReceived, Icon: MessageSquare, helper: 'Across your entries' },
    { label: 'Comments Given', value: commentActivity.length, Icon: Send, helper: 'Discussions shared' },
    { label: 'Reading Traces', value: readingHistory.length, Icon: Eye, helper: 'Opened in reader' },
    { label: 'Profiles Visited', value: visitedProfiles.length, Icon: Users, helper: 'Curators discovered' },
    { label: 'Saved Shelf', value: savedCount, Icon: Bookmark, helper: 'Bookmarks collected' },
  ]

  return (
    <main className="page-wrapper account-utility-page activity-page-wrapper">
      <div
        className="account-utility-container activity-redesign-container"
        aria-hidden={Boolean(activeActivityModal)}
      >
        {/* Header - Profile/Entity Inspired */}
        <header className="activity-hero-header">
          <div className="activity-badge-pill">
            <Activity size={14} aria-hidden="true" />
            <span>Activity & Engagement · Private to you</span>
          </div>
          <div className="activity-title-group">
            <h1 className="activity-main-heading">Activity</h1>
            <p className="activity-hero-subheading">
              A private overview of your thoughts, catalog additions, and interactions over the last 7 days.
            </p>
          </div>
        </header>

        {/* AT-A-GLANCE METRICS (Strictly Numbers Only, Non-Clickable, Even 4x2 Grid) */}
        <section
          className="activity-glance-section"
          aria-label="Activity telemetry overview"
          role="status"
        >
          <div className="activity-glance-grid">
            {glanceStats.map(({ label, value, Icon, helper }) => (
              <article className="activity-glance-card" key={label}>
                <div className="activity-glance-top">
                  <span className="activity-glance-label">{label}</span>
                  <div className="activity-glance-icon-wrap" aria-hidden="true">
                    <Icon size={14} />
                  </div>
                </div>
                <div className="activity-glance-number">{value}</div>
                <span className="activity-glance-helper">{helper}</span>
              </article>
            ))}
          </div>
        </section>

        {/* SECTION 1: POSTS IN THE LAST 7 DAYS */}
        <section className="activity-section-card" aria-labelledby="posts-last-7-days-heading">
          <div className="activity-section-header">
            <div className="activity-section-title-wrap">
              <span className="activity-section-pill">
                <Calendar size={13} aria-hidden="true" />
                <span>Posts & Catalog Additions</span>
              </span>
              <h2 id="posts-last-7-days-heading" className="activity-section-title">
                {postFilter === '7days' ? 'Posts in the Last 7 Days' : 'All Published Entries'}
              </h2>
              <p className="activity-section-desc">
                Your published thoughts and reviews logged across The Commonplace.
              </p>
            </div>

            {/* Filter Pill Controls */}
            <div className="activity-filter-pills" role="tablist" aria-label="Posts filter">
              <button
                type="button"
                role="tab"
                aria-selected={postFilter === '7days'}
                className={`activity-filter-pill ${postFilter === '7days' ? 'is-active' : ''}`}
                onClick={() => setPostFilter('7days')}
              >
                <span>Last 7 Days</span>
                <span className="activity-pill-count">{postsLast7Days.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={postFilter === 'all'}
                className={`activity-filter-pill ${postFilter === 'all' ? 'is-active' : ''}`}
                onClick={() => setPostFilter('all')}
              >
                <span>All Published</span>
                <span className="activity-pill-count">{entries.length}</span>
              </button>
            </div>
          </div>

          {/* Posts Display */}
          {displayedPosts.length > 0 ? (
            <div className="activity-posts-grid">
              {displayedPosts.map((entry) => {
                const engagement = engagements[entry.id]
                return (
                  <button
                    type="button"
                    key={entry.id}
                    className="activity-post-card"
                    onClick={() => onOpenEntry(entry)}
                  >
                    <div className="activity-post-cover">
                      {entry.coverUrl ? (
                        <img
                          src={entry.coverUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="activity-post-fallback-cover">
                          <BookOpen size={18} aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    <div className="activity-post-info">
                      <div className="activity-post-meta-top">
                        <span className="activity-post-type-tag">{entry.type}</span>
                        <span
                          className="activity-post-time"
                          title={formatFullDateTime(entry.createdAt)}
                        >
                          {formatRelativeTime(entry.createdAt)}
                        </span>
                      </div>
                      <strong className="activity-post-title">{entry.title}</strong>
                      <span className="activity-post-creator">
                        {entry.creator || 'Personal catalog entry'}
                      </span>
                    </div>

                    <div className="activity-post-engagement">
                      <span className="activity-engagement-chip" title="Likes">
                        <Heart size={12} aria-hidden="true" />
                        <span>{engagement?.likeCount || 0}</span>
                      </span>
                      <span className="activity-engagement-chip" title="Comments">
                        <MessageSquare size={12} aria-hidden="true" />
                        <span>{engagement?.commentCount || 0}</span>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="activity-empty-box">
              <Calendar size={28} className="activity-empty-icon" aria-hidden="true" />
              <h3>No posts published in the last 7 days</h3>
              <p>
                Entries you publish over the past week will automatically appear here.
              </p>
              {entries.length > 0 && postFilter === '7days' && (
                <button
                  type="button"
                  className="activity-empty-btn"
                  onClick={() => setPostFilter('all')}
                >
                  View All {entries.length} Published Entries
                </button>
              )}
            </div>
          )}
        </section>

        {/* SECTION 2: INTERACTIONS STREAM (Likes, Comments, Reading/Preview History) */}
        <section className="activity-section-card" aria-labelledby="interactions-stream-heading">
          <div className="activity-section-header">
            <div className="activity-section-title-wrap">
              <span className="activity-section-pill">
                <Sparkles size={13} aria-hidden="true" />
                <span>Personal Activity Logs</span>
              </span>
              <h2 id="interactions-stream-heading" className="activity-section-title">
                Your Interactions & Reading Trace
              </h2>
              <p className="activity-section-desc">
                Review entries you have liked, discussions you joined, and items opened in reading view.
              </p>
            </div>

            {/* Segmented Tabs & Modal Triggers */}
            <div className="activity-tab-row">
              <div className="activity-segmented-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={interactionTab === 'likes'}
                  className={`activity-tab-btn ${interactionTab === 'likes' ? 'is-active' : ''}`}
                  onClick={() => setInteractionTab('likes')}
                >
                  <Heart size={13} aria-hidden="true" />
                  <span>Likes</span>
                  <span className="activity-pill-count">{likedEntryIds.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={interactionTab === 'comments'}
                  className={`activity-tab-btn ${interactionTab === 'comments' ? 'is-active' : ''}`}
                  onClick={() => setInteractionTab('comments')}
                >
                  <MessageSquare size={13} aria-hidden="true" />
                  <span>Comments</span>
                  <span className="activity-pill-count">{commentActivity.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={interactionTab === 'reading'}
                  className={`activity-tab-btn ${interactionTab === 'reading' ? 'is-active' : ''}`}
                  onClick={() => setInteractionTab('reading')}
                >
                  <Eye size={13} aria-hidden="true" />
                  <span>Reading Trace</span>
                  <span className="activity-pill-count">{readingHistory.length}</span>
                </button>
              </div>

              {/* Accessible Action Buttons (Ensures compatibility with existing test suites) */}
              <div className="activity-action-triggers">
                <button
                  type="button"
                  className="activity-action-pill-btn"
                  onClick={openLikedEntries}
                >
                  <span>❤️ View My Liked Entries</span>
                </button>
                <button
                  type="button"
                  className="activity-action-pill-btn"
                  onClick={openCommentHistory}
                >
                  <span>💬 View My Comments History</span>
                </button>
              </div>
            </div>
          </div>

          {/* TAB 1: LIKES */}
          {interactionTab === 'likes' && (
            <div className="activity-tab-content">
              {likedActivityEntries.length > 0 ? (
                <div className="activity-stream-list">
                  {likedActivityEntries.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      className="activity-stream-item"
                      onClick={() => onOpenEntry(entry)}
                    >
                      <div className="activity-stream-cover">
                        {entry.coverUrl ? (
                          <img
                            src={entry.coverUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <BookOpen size={16} aria-hidden="true" />
                        )}
                      </div>
                      <div className="activity-stream-info">
                        <strong className="activity-stream-title">{entry.title}</strong>
                        <span className="activity-stream-creator">
                          {entry.creator || entry.type}
                        </span>
                      </div>
                      <div className="activity-stream-badge is-liked">
                        <Heart size={12} fill="currentColor" aria-hidden="true" />
                        <span>Liked</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="activity-empty-box">
                  <Heart size={26} className="activity-empty-icon" aria-hidden="true" />
                  <h3>No liked entries yet</h3>
                  <p>When you appreciate entries across the community, they will be archived here.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMMENTS */}
          {interactionTab === 'comments' && (
            <div className="activity-tab-content">
              {commentsLoading ? (
                <div className="activity-empty-box">
                  <p>Loading your comment history…</p>
                </div>
              ) : commentActivity.length > 0 ? (
                <div className="activity-stream-list">
                  {commentActivity.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="activity-stream-item is-comment-item"
                      onClick={() =>
                        onOpenEntry(item.entry, {
                          commentId: item.commentId,
                          replyId: item.replyId,
                        })
                      }
                    >
                      <div className="activity-comment-left-icon">
                        <MessageSquare size={16} aria-hidden="true" />
                      </div>
                      <div className="activity-stream-info">
                        <div className="activity-comment-header-row">
                          <strong className="activity-stream-title">
                            {item.kind} on {item.entry.title}
                          </strong>
                          <span
                            className="activity-stream-time"
                            title={formatFullDateTime(item.interaction.createdAt)}
                          >
                            {formatRelativeTime(item.interaction.createdAt)}
                          </span>
                        </div>
                        <p className="activity-comment-quote">
                          &ldquo;{item.interaction.text}&rdquo;
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="activity-empty-box">
                  <MessageSquare size={26} className="activity-empty-icon" aria-hidden="true" />
                  <h3>No comments or replies found</h3>
                  <p>Your thoughts and discussion replies will be tracked here.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: READING VIEW HISTORY */}
          {interactionTab === 'reading' && (
            <div className="activity-tab-content">
              <div className="activity-reading-notice">
                <span>
                  📖 History is recorded when you open an entry into its dedicated reading view.
                </span>
                {readingHistory.length > 0 && (
                  <button
                    type="button"
                    className="activity-clear-btn"
                    onClick={handleClearReadingHistory}
                    title="Clear reading history"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    <span>Clear Trace</span>
                  </button>
                )}
              </div>

              {readingHistory.length > 0 ? (
                <div className="activity-stream-list">
                  {readingHistory.map((item) => (
                    <button
                      type="button"
                      key={`${item.id}-${item.openedAt}`}
                      className="activity-stream-item"
                      onClick={() => handleOpenReadingItem(item)}
                    >
                      <div className="activity-stream-cover">
                        {item.coverUrl ? (
                          <img
                            src={item.coverUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <BookOpen size={16} aria-hidden="true" />
                        )}
                      </div>
                      <div className="activity-stream-info">
                        <strong className="activity-stream-title">{item.title}</strong>
                        <span className="activity-stream-creator">
                          {item.creator || item.type}
                        </span>
                      </div>
                      <div className="activity-stream-badge is-reading">
                        <Eye size={12} aria-hidden="true" />
                        <span>Opened {formatRelativeTime(item.openedAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="activity-empty-box">
                  <Eye size={26} className="activity-empty-icon" aria-hidden="true" />
                  <h3>No reading trace yet</h3>
                  <p>
                    Open an entry into full reading view to automatically trace your reading sessions.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* SECTION 3: EXPLORATION TRACE (Recent Searches & Visited Profiles) */}
        <section className="activity-section-card" aria-labelledby="exploration-trace-heading">
          <div className="activity-section-header">
            <div className="activity-section-title-wrap">
              <span className="activity-section-pill">
                <Compass size={13} aria-hidden="true" />
                <span>Exploration & Discoveries</span>
              </span>
              <h2 id="exploration-trace-heading" className="activity-section-title">
                Curator Profiles & Search Trace
              </h2>
              <p className="activity-section-desc">
                Curator profiles you visited and queries retained from your search tab.
              </p>
            </div>
          </div>

          <div className="activity-exploration-grid">
            {/* SUB-SECTION A: VISITED PROFILES */}
            <div className="activity-exploration-panel">
              <div className="activity-panel-header">
                <div className="activity-panel-title">
                  <Users size={15} aria-hidden="true" />
                  <h3>Profiles Visited</h3>
                  <span className="activity-pill-count">{visitedProfiles.length}</span>
                </div>
                {visitedProfiles.length > 0 && (
                  <button
                    type="button"
                    className="activity-clear-btn"
                    onClick={handleClearVisitedProfiles}
                    title="Clear visited profiles"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {visitedProfiles.length > 0 ? (
                <div className="activity-profiles-chips">
                  {visitedProfiles.map((profile) => (
                    <button
                      type="button"
                      key={profile.handle}
                      className="activity-profile-chip"
                      onClick={() => onOpenProfile?.(profile.handle)}
                      title={`Visit @${profile.handle}`}
                    >
                      <div className="activity-profile-avatar-circle">
                        {profile.avatarUrl ? (
                          <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <span>{profile.handle.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="activity-profile-chip-copy">
                        <strong className="activity-profile-chip-handle">
                          @{profile.handle}
                        </strong>
                        <span className="activity-profile-chip-time">
                          {formatRelativeTime(profile.visitedAt)}
                        </span>
                      </div>
                      <ExternalLink size={12} className="activity-chip-arrow" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="activity-panel-empty">
                  <Users size={20} aria-hidden="true" />
                  <p>No visited curator profiles recorded yet.</p>
                </div>
              )}
            </div>

            {/* SUB-SECTION B: RECENT SEARCHES */}
            <div className="activity-exploration-panel">
              <div className="activity-panel-header">
                <div className="activity-panel-title">
                  <Search size={15} aria-hidden="true" />
                  <h3>Recent Searches</h3>
                  <span className="activity-pill-count">{recentSearches.length}</span>
                </div>
              </div>

              {recentSearches.length > 0 ? (
                <div className="activity-searches-chips">
                  {recentSearches.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="activity-search-chip"
                      onClick={() => onOpenSearch?.(item.name)}
                      title={`Search "${item.name}"`}
                    >
                      <Search size={12} aria-hidden="true" />
                      <span className="activity-search-chip-query">{item.name}</span>
                      <span className="activity-search-chip-type">{item.type}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="activity-panel-empty">
                  <Search size={20} aria-hidden="true" />
                  <p>No active searches saved from the search tab.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ACCESSIBLE MODAL FOR FULL DEEP SEARCH (Likes / Comments) */}
      {activeActivityModal && (
        <div className="modal-backdrop" onClick={closeActivityModal}>
          <div
            ref={activityDialogRef}
            className="settings-modal activity-modal-dialog"
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
                        {entry.coverUrl ? (
                          <img
                            src={entry.coverUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <BookOpen aria-hidden="true" />
                        )}
                      </span>
                      <span className="activity-entry-copy">
                        <strong>{entry.title}</strong>
                        <small>{entry.creator || entry.type}</small>
                      </span>
                      <span className="activity-entry-date">Liked</span>
                      <span className="activity-entry-engagement">
                        <Heart fill="currentColor" aria-hidden="true" />
                      </span>
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
              <div className="activity-log-modal-empty">
                No comments or replies found in your available entries.
              </div>
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
