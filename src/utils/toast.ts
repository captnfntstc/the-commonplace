export type ToastKind = 'success' | 'error' | 'offline'

export interface AppToastEventDetail {
  message: string
  kind?: ToastKind
}

export const APP_TOAST_EVENT = 'tcp:app-toast'

export function showToast(message: string, kind?: ToastKind) {
  if (typeof window === 'undefined') return
  const detectedKind: ToastKind =
    kind ||
    (/error|fail|cannot|unable|no picture|please|invalid|not found/i.test(message)
      ? 'error'
      : 'success')
  window.dispatchEvent(
    new CustomEvent<AppToastEventDetail>(APP_TOAST_EVENT, {
      detail: { message, kind: detectedKind },
    })
  )
}
