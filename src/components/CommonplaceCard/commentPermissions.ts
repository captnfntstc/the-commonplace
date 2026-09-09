type CommentIdentity = {
  authorId?: string
  authorHandle?: string
}

export function isInteractionOwner(
  interaction: CommentIdentity,
  currentUserId: string | null,
  currentUserHandle?: string,
) {
  if (currentUserId) return interaction.authorId === currentUserId
  const normalizedCurrentHandle = currentUserHandle?.replace(/^@/, '').toLowerCase()
  const normalizedAuthorHandle = interaction.authorHandle?.replace(/^@/, '').toLowerCase()
  return Boolean(normalizedCurrentHandle && normalizedAuthorHandle === normalizedCurrentHandle)
}

function hiddenReportsStorageKey(userId: string) {
  return `the-commonplace.hidden-reported-interactions.${userId}`
}

function hiddenReportId(postId: string, targetType: 'comment' | 'reply', targetId: string) {
  return `${postId}:${targetType}:${targetId}`
}

export function hideReportedInteraction(
  userId: string,
  postId: string,
  targetType: 'comment' | 'reply',
  targetId: string,
) {
  try {
    const storageKey = hiddenReportsStorageKey(userId)
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]')
    const hidden = new Set(Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string') : [])
    hidden.add(hiddenReportId(postId, targetType, targetId))
    localStorage.setItem(storageKey, JSON.stringify([...hidden]))
  } catch {
    // The interaction is still hidden from the current in-memory thread.
  }
}

export function isReportedInteractionHidden(
  userId: string,
  postId: string,
  targetType: 'comment' | 'reply',
  targetId: string,
) {
  try {
    const stored = JSON.parse(localStorage.getItem(hiddenReportsStorageKey(userId)) || '[]')
    return Array.isArray(stored) && stored.includes(hiddenReportId(postId, targetType, targetId))
  } catch {
    return false
  }
}
