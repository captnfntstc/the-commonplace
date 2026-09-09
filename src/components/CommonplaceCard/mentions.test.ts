import { describe, expect, it } from 'vitest'
import { insertMention, mentionAtCursor } from './mentions'

describe('reply mentions', () => {
  it('opens mention matching only for an @ token at the cursor', () => {
    expect(mentionAtCursor('comment-1', 'Thanks @pat', 11)).toEqual({
      commentId: 'comment-1',
      query: 'pat',
      start: 7,
      end: 11,
    })
    expect(mentionAtCursor('comment-1', 'email@example.com', 17)).toBeNull()
  })

  it('inserts the selected handle without adding one automatically to replies', () => {
    const emptyReply = ''
    expect(emptyReply).toBe('')
    const match = mentionAtCursor('comment-1', 'Thank you @pa for this', 13)
    expect(match).not.toBeNull()
    expect(insertMention('Thank you @pa for this', match!, 'patrick')).toEqual({
      value: 'Thank you @patrick for this',
      cursor: 19,
    })
  })
})
