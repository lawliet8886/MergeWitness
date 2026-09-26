import type { ScenarioResult, Variant } from './scenario'

const WORKER_TIMEOUT_MS = 15_000

export const workerRun = (variant: Variant, signal?: AbortSignal) => new Promise<ScenarioResult>((resolve, reject) => {
  let worker: Worker
  try {
    worker = new Worker(new URL('./scenario.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    reject(new Error('The browser could not start a fresh scenario worker. Please try again.'))
    return
  }

  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const finish = (error?: Error, result?: ScenarioResult) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
    worker.onmessage = null
    worker.onerror = null
    worker.onmessageerror = null
    worker.terminate()
    if (error) reject(error)
    else resolve(result!)
  }
  const onAbort = () => finish(new Error('The scenario check was cancelled. Please try again.'))

  worker.onmessage = (event) => finish(undefined, event.data as ScenarioResult)
  worker.onerror = (event) => {
    event.preventDefault()
    finish(new Error('The browser could not complete the scenario check. Please try again.'))
  }
  worker.onmessageerror = () => finish(new Error('The browser could not read the scenario result. Please try again.'))
  timer = setTimeout(() => finish(new Error('The browser check timed out after 15 seconds. Please try again.')), WORKER_TIMEOUT_MS)
  signal?.addEventListener('abort', onAbort, { once: true })
  if (signal?.aborted) {
    onAbort()
    return
  }
  try {
    worker.postMessage({ variant })
  } catch {
    finish(new Error('The browser could not start the scenario check. Please try again.'))
  }
})
