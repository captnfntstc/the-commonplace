import { useState, type ReactNode } from 'react'
import { ExpansionContext } from './expansionContextValue'

export function ExpansionProvider({ children }: { children: ReactNode }) {
  const [expandedCardId, setExpandedCardId] = useState<string>('')

  const toggleCardExpanded = (id: string) => {
    setExpandedCardId((current) => (current === id ? '' : id))
  }

  const collapseAll = () => {
    setExpandedCardId('')
  }

  return (
    <ExpansionContext.Provider
      value={{
        expandedCardId,
        setExpandedCardId,
        toggleCardExpanded,
        collapseAll,
      }}
    >
      {children}
    </ExpansionContext.Provider>
  )
}
