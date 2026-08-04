import type { ProcessRequest, ProcessResponse } from '@/types/project'

let worker: Worker | null = null
let sequence = 0
const loadedSources = new Set<string>()

interface PendingRequest {
  resolve: (value: ProcessResponse) => void
  reject: (reason?: unknown) => void
}

interface WorkerResponse extends ProcessResponse {
  requestId: number
  error?: string
}

const pending = new Map<number, PendingRequest>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/pixel.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const request = pending.get(event.data.requestId)
    if (!request) return
    pending.delete(event.data.requestId)
    if (event.data.error) request.reject(new Error(event.data.error))
    else request.resolve(event.data)
  }
  worker.onerror = (event) => {
    for (const request of pending.values()) request.reject(event.error ?? new Error(event.message))
    pending.clear()
    loadedSources.clear()
    worker = null
  }
  return worker
}

export function runProcessing(request: ProcessRequest, sourceId = 'default'): Promise<ProcessResponse> {
  const requestId = ++sequence
  const activeWorker = getWorker()
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject })
    if (!loadedSources.has(sourceId)) {
      const data = new Uint8ClampedArray(request.source.data)
      activeWorker.postMessage({ type: 'load-source', sourceId, width: request.source.width, height: request.source.height, data }, [data.buffer])
      loadedSources.add(sourceId)
    }
    const { source: _source, ...settings } = request
    activeWorker.postMessage({ type: 'process', ...settings, requestId, sourceId })
  })
}

export function releaseProcessingSource(sourceId: string): void {
  if (!loadedSources.delete(sourceId)) return
  worker?.postMessage({ type: 'release-source', sourceId })
}
