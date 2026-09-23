import { describe, expect, it, vi } from 'vitest'
import { RequestScheduler } from './requestScheduler'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('RequestScheduler', () => {
  it('shares identical in-flight requests', async () => {
    const scheduler = new RequestScheduler(2)
    const work = deferred<string>()
    const task = vi.fn(() => work.promise)

    const first = scheduler.schedule('same-request', task)
    const second = scheduler.schedule('same-request', task)
    work.resolve('result')

    await expect(Promise.all([first, second])).resolves.toEqual(['result', 'result'])
    expect(task).toHaveBeenCalledOnce()
  })

  it('limits concurrency and starts queued interactive work first', async () => {
    const scheduler = new RequestScheduler(1)
    const firstWork = deferred<string>()
    const normalWork = deferred<string>()
    const highWork = deferred<string>()
    const starts: string[] = []

    const first = scheduler.schedule('first', async () => {
      starts.push('first')
      return firstWork.promise
    })
    const normal = scheduler.schedule('normal', async () => {
      starts.push('normal')
      return normalWork.promise
    })
    const high = scheduler.schedule('high', async () => {
      starts.push('high')
      return highWork.promise
    }, { priority: 'high' })

    expect(starts).toEqual(['first'])
    firstWork.resolve('first')
    await first
    await vi.waitFor(() => expect(starts).toEqual(['first', 'high']))
    highWork.resolve('high')
    await high
    await vi.waitFor(() => expect(starts).toEqual(['first', 'high', 'normal']))
    normalWork.resolve('normal')
    await normal
  })

  it('keeps shared work alive while another consumer still needs it', async () => {
    const scheduler = new RequestScheduler(1)
    const work = deferred<string>()
    const firstController = new AbortController()
    const task = vi.fn((signal: AbortSignal) => {
      expect(signal.aborted).toBe(false)
      return work.promise
    })

    const first = scheduler.schedule('shared', task, { signal: firstController.signal })
    const second = scheduler.schedule('shared', task)
    firstController.abort()
    work.resolve('kept-alive')

    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await expect(second).resolves.toBe('kept-alive')
    expect(task).toHaveBeenCalledOnce()
  })
})
