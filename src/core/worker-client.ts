import type { ProcessRequest, ProcessResponse } from '@/types/project'

let worker: Worker | null = null
let sequence = 0

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
  }
  return worker
}

export function runProcessing(request: ProcessRequest): Promise<ProcessResponse> {
  const requestId = ++sequence
  const activeWorker = getWorker()
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject })
    const payload = {
      ...request,
      requestId,
      source: {
        ...request.source,
        data: new Uint8ClampedArray(request.source.data),
      },
    }
    activeWorker.postMessage(payload, [payload.source.data.buffer])
  })
}
