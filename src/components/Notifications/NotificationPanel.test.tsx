import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NotificationBell, NotificationPanel } from './NotificationPanel'
import type { AppNotification } from '../../types/notification'

const likeNotification = (
  id: string,
  actorName: string,
  actorId: string,
  postId = 'post-1',
): AppNotification => ({
  id,
  type: 'like',
  read: false,
  createdAt: `2026-09-02T00:00:0${id}.000Z`,
  actorId,
  actorName,
  postId,
  entryTitle: 'The Bell Jar',
})

describe('NotificationPanel stacks', () => {
  it('opens a post notification without triggering its dismiss action', () => {
    const onOpenNotification = vi.fn()
    const onDismiss = vi.fn()
    const notification = likeNotification('1', 'Louis', 'louis')

    render(
      <NotificationPanel
        notifications={[notification]}
        onMarkAllRead={vi.fn()}
        onClearAll={vi.fn()}
        onDismiss={onDismiss}
        onOpenNotification={onOpenNotification}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open notification for The Bell Jar' }))
    expect(onOpenNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'like',
      postId: 'post-1',
    }))
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('groups actors who liked the same entry and dismisses the whole stack', () => {
    const onDismiss = vi.fn()
    const notifications = [
      likeNotification('1', 'Louis', 'louis'),
      likeNotification('2', 'Patrick', 'patrick'),
      likeNotification('3', 'Anne', 'anne'),
      likeNotification('4', 'James', 'james'),
    ]

    render(
      <NotificationPanel
        notifications={notifications}
        onMarkAllRead={vi.fn()}
        onClearAll={vi.fn()}
        onDismiss={onDismiss}
      />,
    )

    expect(screen.getByText('James, Anne, and 2 more')).toBeInTheDocument()
    expect(screen.getAllByText(/liked your entry/)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss 4 grouped notifications' }))
    expect(onDismiss).toHaveBeenCalledWith(['4', '3', '2', '1'])
  })

  it('keeps likes for different entries in separate stacks', () => {
    render(
      <NotificationPanel
        notifications={[
          likeNotification('1', 'Louis', 'louis', 'post-1'),
          likeNotification('2', 'Patrick', 'patrick', 'post-2'),
        ]}
        onMarkAllRead={vi.fn()}
        onClearAll={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getAllByText(/liked your entry/)).toHaveLength(2)
  })

  it('shows and stacks replies to the same comment thread', () => {
    const onOpenNotification = vi.fn()
    const replies: AppNotification[] = [
      {
        id: 'reply-1',
        type: 'reply',
        read: false,
        createdAt: '2026-09-02T00:00:01.000Z',
        actorId: 'louis',
        actorName: 'Louis',
        postId: 'post-1',
        parentInteractionId: 'comment-1',
        entryTitle: 'The Bell Jar',
        commentSnippet: 'I agree with this.',
      },
      {
        id: 'reply-2',
        type: 'reply',
        read: false,
        createdAt: '2026-09-02T00:00:02.000Z',
        actorId: 'patrick',
        actorName: 'Patrick',
        postId: 'post-1',
        parentInteractionId: 'comment-1',
        entryTitle: 'The Bell Jar',
        commentSnippet: 'Same here.',
      },
    ]

    render(
      <NotificationPanel
        notifications={replies}
        onMarkAllRead={vi.fn()}
        onClearAll={vi.fn()}
        onDismiss={vi.fn()}
        onOpenNotification={onOpenNotification}
      />,
    )

    expect(screen.getByText('Patrick and Louis')).toBeInTheDocument()
    expect(screen.getByText(/replied to your comment on/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open notification for The Bell Jar' }))
    expect(onOpenNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'reply',
      postId: 'post-1',
      parentInteractionId: 'comment-1',
    }))
  })

  it('shows a new follower notification and opens the follower profile', () => {
    const onOpenNotification = vi.fn()
    const notification: AppNotification = {
      id: 'follow-louis',
      type: 'follow',
      read: false,
      createdAt: '2026-09-02T00:00:03.000Z',
      actorId: 'louis-id',
      actorName: 'Louis',
      actorHandle: 'louis',
    }

    render(
      <NotificationPanel
        notifications={[notification]}
        onMarkAllRead={vi.fn()}
        onClearAll={vi.fn()}
        onDismiss={vi.fn()}
        onOpenNotification={onOpenNotification}
      />,
    )

    expect(screen.getByText(/started following you/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open profile for Louis' }))
    expect(onOpenNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'follow',
      actorHandle: 'louis',
    }))
  })

  it('does not open a notification when its dismiss button is clicked', () => {
    const onOpenNotification = vi.fn()
    const onDismiss = vi.fn()
    render(
      <NotificationPanel
        notifications={[likeNotification('1', 'Louis', 'louis')]}
        onMarkAllRead={vi.fn()}
        onClearAll={vi.fn()}
        onDismiss={onDismiss}
        onOpenNotification={onOpenNotification}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledWith(['1'])
    expect(onOpenNotification).not.toHaveBeenCalled()
  })

  it('marks unread notifications as read when the panel is opened', () => {
    const onMarkAllRead = vi.fn()
    render(
      <NotificationBell
        notifications={[likeNotification('1', 'Louis', 'louis')]}
        onMarkAllRead={onMarkAllRead}
        onClearAll={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(onMarkAllRead).toHaveBeenCalledOnce()
  })

  it('closes the notification popup after opening a notification', async () => {
    const onOpenNotification = vi.fn()
    render(
      <NotificationBell
        notifications={[likeNotification('1', 'Louis', 'louis')]}
        onMarkAllRead={vi.fn()}
        onClearAll={vi.fn()}
        onDismiss={vi.fn()}
        onOpenNotification={onOpenNotification}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open notification for The Bell Jar' }))

    expect(onOpenNotification).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Open notification for The Bell Jar' })).not.toBeInTheDocument()
    })
  })
})
