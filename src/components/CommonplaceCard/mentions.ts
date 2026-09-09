export type MentionMatch = {
  commentId: string
  query: string
  start: number
  end: number
}

export function mentionAtCursor(
  commentId: string,
  value: string,
  cursor: number,
): MentionMatch | null {
  const beforeCursor = value.slice(0, cursor)
  const match = beforeCursor.match(/(^|\s)@([a-z0-9_]*)$/i)
  if (!match) return null
  return {
    commentId,
    query: match[2].toLowerCase(),
    start: beforeCursor.lastIndexOf('@'),
    end: cursor,
  }
}

export function insertMention(value: string, match: MentionMatch, handle: string) {
  const inserted = `@${handle.replace(/^@/, '')} `
  const replaceEnd = value[match.end] === ' ' ? match.end + 1 : match.end
  return {
    value: `${value.slice(0, match.start)}${inserted}${value.slice(replaceEnd)}`,
    cursor: match.start + inserted.length,
  }
}
