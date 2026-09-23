export type RequestPriority = 'high' | 'normal' | 'low'

interface ScheduleOptions {
  signal?: AbortSignal
  priority?: RequestPriority
}

interface ScheduledEntry {
  key: string
  priority: number
  sequence: number
  controller: AbortController
  consumers: Set<symbol>
  started: boolean
  task: (signal: AbortSignal) => Promise<unknown>
  promise: Promise<unknown>
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

const PRIORITY_SCORE: Record<RequestPriority, number> = {
  high: 2,
  normal: 1,
  low: 0,
}

function abortError() {
  return new DOMException('The request was aborted.', 'AbortError')
}

/**
 * Shares identical work, prioritizes interactive requests, and keeps provider
 * traffic below a fixed concurrency ceiling. Each consumer can abort without
 * cancelling work that another mounted consumer still needs.
 */
export class RequestScheduler {
  private readonly maxConcurrent: number
  private readonly inFlight = new Map<string, ScheduledEntry>()
  private readonly queue: ScheduledEntry[] = []
  private activeCount = 0
  private sequence = 0

  constructor(maxConcurrent = 4) {
    this.maxConcurrent = Math.max(1, Math.floor(maxConcurrent))
  }

  schedule<T>(
    key: string,
    task: (signal: AbortSignal) => Promise<T>,
    { signal, priority = 'normal' }: ScheduleOptions = {},
  ): Promise<T> {
    if (signal?.aborted) return Promise.reject(abortError())

    const score = PRIORITY_SCORE[priority]
    let entry = this.inFlight.get(key)
    if (entry?.controller.signal.aborted) entry = undefined

    if (!entry) {
      let resolve!: (value: unknown) => void
      let reject!: (reason?: unknown) => void
      const promise = new Promise<unknown>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
      })
      entry = {
        key,
        priority: score,
        sequence: this.sequence++,
        controller: new AbortController(),
        consumers: new Set(),
        started: false,
        task,
        promise,
        resolve,
        reject,
      }
      this.inFlight.set(key, entry)
      this.queue.push(entry)
    } else if (!entry.started && score > entry.priority) {
      entry.priority = score
    }

    const result = this.attachConsumer<T>(entry, signal)
    this.sortQueue()
    this.pump()
    return result
  }

  private attachConsumer<T>(entry: ScheduledEntry, signal?: AbortSignal): Promise<T> {
    const consumer = Symbol(entry.key)
    entry.consumers.add(consumer)

    return new Promise<T>((resolve, reject) => {
      let settled = false
      const cleanup = () => {
        signal?.removeEventListener('abort', handleAbort)
        entry.consumers.delete(consumer)
      }
      const handleAbort = () => {
        if (settled) return
        settled = true
        cleanup()
        reject(abortError())
        if (entry.consumers.size === 0) this.cancelUnusedEntry(entry)
      }

      signal?.addEventListener('abort', handleAbort, { once: true })
      entry.promise.then(
        (value) => {
          if (settled) return
          settled = true
          cleanup()
          resolve(value as T)
        },
        (error) => {
          if (settled) return
          settled = true
          cleanup()
          reject(error)
        },
      )
    })
  }

  private cancelUnusedEntry(entry: ScheduledEntry) {
    entry.controller.abort()
    if (entry.started) return

    const queueIndex = this.queue.indexOf(entry)
    if (queueIndex >= 0) this.queue.splice(queueIndex, 1)
    if (this.inFlight.get(entry.key) === entry) this.inFlight.delete(entry.key)
    entry.reject(abortError())
    this.pump()
  }

  private sortQueue() {
    this.queue.sort((left, right) => (
      right.priority - left.priority || left.sequence - right.sequence
    ))
  }

  private pump() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const entry = this.queue.shift()!
      if (entry.controller.signal.aborted || entry.consumers.size === 0) {
        if (this.inFlight.get(entry.key) === entry) this.inFlight.delete(entry.key)
        entry.reject(abortError())
        continue
      }

      entry.started = true
      this.activeCount += 1
      void entry.task(entry.controller.signal)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          this.activeCount -= 1
          if (this.inFlight.get(entry.key) === entry) this.inFlight.delete(entry.key)
          this.pump()
        })
    }
  }
}

export const metadataRequestScheduler = new RequestScheduler(4)
