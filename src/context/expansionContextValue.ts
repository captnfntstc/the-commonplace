import { createContext } from 'react'

export interface ExpansionContextType {
  expandedCardId: string
  setExpandedCardId: (id: string) => void
  toggleCardExpanded: (id: string) => void
  collapseAll: () => void
}

export const ExpansionContext = createContext<ExpansionContextType | undefined>(undefined)
