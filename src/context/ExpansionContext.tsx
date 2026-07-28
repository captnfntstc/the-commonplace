import { createContext, useContext, useState, type ReactNode } from 'react'

interface ExpansionContextType {
  expandedCardId: string
  setExpandedCardId: (id: string) => void
  toggleCardExpanded: (id: string) => void
  collapseAll: () => void
}

const ExpansionContext = createContext<ExpansionContextType | undefined>(undefined)

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

export function useCardExpansion() {
  const context = useContext(ExpansionContext)
  if (!context) {
    throw new Error('useCardExpansion must be used within an ExpansionProvider')
  }
  return context
}
