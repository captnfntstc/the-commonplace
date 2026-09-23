import { render, screen } from '@testing-library/react'
import { BookOpen } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { CardHeader } from './CardHeader'

describe('mutual-only feed visibility', () => {
  it('labels entries that are visible through a mutual follow', () => {
    render(
      <CardHeader
        typeIcon={BookOpen}
        typeLabel="Book"
        authorHandle="private-reader"
        visibility="mutual"
      />,
    )
    expect(screen.getByLabelText('Visible because you follow each other')).toBeInTheDocument()
  })

  it('does not label ordinary public entries', () => {
    render(<CardHeader typeIcon={BookOpen} typeLabel="Book" authorHandle="public-reader" />)
    expect(screen.queryByLabelText('Visible because you follow each other')).not.toBeInTheDocument()
  })

  it('replaces the timestamp beside the username with Friend and moves time beside the type icon', () => {
    const { container } = render(
      <CardHeader
        typeIcon={BookOpen}
        typeLabel="Book"
        authorHandle="mutual-reader"
        createdAt="2026-09-20T00:00:00.000Z"
        isFriend
      />,
    )

    expect(container.querySelector('.card-user-row')).toHaveTextContent('• Friend')
    expect(container.querySelector('.card-user-row .card-timestamp')).not.toBeInTheDocument()
    expect(container.querySelector('.card-header-meta .card-timestamp')).toBeInTheDocument()
  })
})
