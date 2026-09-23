import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

let bodyLockCount = 0
let previousDocumentOverflow = ''
let previousDocumentOverscrollBehavior = ''
let previousBodyOverflow = ''
let previousBodyOverscrollBehavior = ''
let previousBodyPaddingRight = ''

function lockBodyScroll() {
  if (bodyLockCount === 0) {
    previousDocumentOverflow = document.documentElement.style.overflow
    previousDocumentOverscrollBehavior = document.documentElement.style.overscrollBehavior
    previousBodyOverflow = document.body.style.overflow
    previousBodyOverscrollBehavior = document.body.style.overscrollBehavior
    previousBodyPaddingRight = document.body.style.paddingRight
    const viewportWidth = document.documentElement.clientWidth
    const scrollbarWidth = viewportWidth > 0 ? Math.max(0, window.innerWidth - viewportWidth) : 0

    // The root scrolling element is `html` in standards-mode browsers. Locking
    // only `body` still allows the page behind a dialog to move in those browsers.
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.overscrollBehavior = 'none'
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
  }
  bodyLockCount += 1
}

function unlockBodyScroll() {
  bodyLockCount = Math.max(0, bodyLockCount - 1)
  if (bodyLockCount === 0) {
    document.documentElement.style.overflow = previousDocumentOverflow
    document.documentElement.style.overscrollBehavior = previousDocumentOverscrollBehavior
    document.body.style.overflow = previousBodyOverflow
    document.body.style.overscrollBehavior = previousBodyOverscrollBehavior
    document.body.style.paddingRight = previousBodyPaddingRight
  }
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')
}

interface AccessibleDialogOptions {
  open: boolean
  onClose: () => void
  closeOnEscape?: boolean
  restoreFocus?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
}

export function useAccessibleDialog<T extends HTMLElement>({
  open,
  onClose,
  closeOnEscape = true,
  restoreFocus = true,
  initialFocusRef,
}: AccessibleDialogOptions) {
  const dialogRef = useRef<T>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    lockBodyScroll()

    const focusFrame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current
      if (!dialog) return
      const requestedFocus = initialFocusRef?.current
      const firstFocusable = getFocusableElements(dialog)[0]
      ;(requestedFocus || firstFocusable || dialog).focus({ preventScroll: true })
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current
      if (!dialog) return

      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = getFocusableElements(dialog)
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown, true)
      unlockBodyScroll()
      if (restoreFocus && previouslyFocused?.isConnected) {
        window.requestAnimationFrame(() => previouslyFocused.focus({ preventScroll: true }))
      }
    }
  }, [closeOnEscape, initialFocusRef, open, restoreFocus])

  return dialogRef
}
