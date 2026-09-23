import { useContext } from 'react'
import { ExpansionContext } from '../context/expansionContextValue'

export function useCardExpansion() {
  const context = useContext(ExpansionContext)
  if (!context) {
    throw new Error('useCardExpansion must be used within an ExpansionProvider')
  }
  return context
}
