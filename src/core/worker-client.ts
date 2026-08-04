import type { ProcessRequest, ProcessResponse } from '@/types/project'
import type { WorkerSourceInput } from '@/workers/source-backends/source-backend'

const PROTOCOL_VERSION = 1
const PROCESS_TIMEOUT_MS = 30_000

type WorkerMessage =
  | { type: 'source-loaded'; protocol: 1; sourceId: string; backend: 'bitmap' | 'rgba' }
  | { type: 'process-result'; protocol: 1; requestId: number; result: ProcessResponse['result']; durationMs: number }
  | { type: 'error'; protocol: 1; requestId?: number; sourceId?: string; code: string; message: string }

interface PendingRequest {
  resolve: (value: ProcessResponse) => void
  reject: (reason?: unknown) => void
  timer: ReturnType<typeof setTimeout>
}

let worker: Worker | null = null
let sequence = 0
const loadedSources = new Set<string>()
const sourceLoads = new Map<string, Promise<void>>()
const sourceLoadCallbacks = new Map<string, { resolve: () => void; reject: (reason?: unknown) => void; timer: ReturnType<typeof setTimeout> }>()
const pending = new Map<number, PendingRequest>()

function rejectWorkerRequests(reason: Error): void {
  for (const request of pending.values()) {
    clearTimeout(request.timer)
    request.reject(reason)
  }
  pending.clear()
  for (const callback of sourceLoadCallbacks.values()) {
    clearTimeout(callback.timer)
    callback.reject(reason)
  }
  sourceLoads.clear()
  sourceLoadCallbacks.clear()
  loadedSources.clear()
  worker = null
}

function post(message: unknown, transfer?: Transferable[]): void {
  if (!worker) throw new Error('图像处理Worker未启动')
  try {
    worker.postMessage(message, transfer ?? [])
  } catch (error) {
    throw error instanceof Error ? error : new Error('无法发送Worker请求')
  }
}

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/pixel.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const message = event.data
    if (message.type === 'source-loaded') {
      loadedSources.add(message.sourceId)
      const callback = sourceLoadCallbacks.get(message.sourceId)
      if (callback) {
        clearTimeout(callback.timer)
        callback.resolve()
      }
      sourceLoadCallbacks.delete(message.sourceId)
      return
    }
    if (message.type === 'error') {
      if (message.sourceId) {
        const callback = sourceLoadCallbacks.get(message.sourceId)
        if (callback) {
          clearTimeout(callback.timer)
          callback.reject(new Error(message.message))
        }
        sourceLoadCallbacks.delete(message.sourceId)
      }
      if (message.requestId === undefined) return
      const request = pending.get(message.requestId)
      if (!request) return
      clearTimeout(request.timer)
      pending.delete(message.requestId)
      request.reject(new Error(message.message))
      return
    }
    const request = pending.get(message.requestId)
    if (!request) return
    clearTimeout(request.timer)
    pending.delete(message.requestId)
    request.resolve({ result: message.result, durationMs: message.durationMs })
  }
  worker.onerror = () => rejectWorkerRequests(new Error('图像处理Worker已崩溃，请重试'))
  worker.onmessageerror = () => rejectWorkerRequests(new Error('图像处理Worker消息无效，请重试'))
  return worker
}

function loadSource(sourceId: string, input: WorkerSourceInput, timeoutMs: number): Promise<void> {
  if (loadedSources.has(sourceId)) return Promise.resolve()
  const existing = sourceLoads.get(sourceId)
  if (existing) return existing
  getWorker()
  const promise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      rejectWorkerRequests(new Error('加载原图超时，请重新导入图片'))
    }, timeoutMs)
    sourceLoadCallbacks.set(sourceId, { resolve, reject, timer })
    try {
      post({ type: 'load-source', protocol: PROTOCOL_VERSION, sourceId, source: input }, input.data ? [input.data.buffer as ArrayBuffer] : undefined)
    } catch (error) {
      clearTimeout(timer)
      sourceLoadCallbacks.delete(sourceId)
      reject(error)
    }
  }).finally(() => sourceLoads.delete(sourceId))
  sourceLoads.set(sourceId, promise)
  return promise
}

export async function runProcessing(request: ProcessRequest, sourceId = request.sourceId ?? 'default', timeoutMs = PROCESS_TIMEOUT_MS): Promise<ProcessResponse> {
  const activeWorker = getWorker()
  const sourceData = request.sourceFile ? undefined : new Uint8ClampedArray(request.source.data)
  await loadSource(sourceId, {
    width: request.source.width,
    height: request.source.height,
    data: sourceData,
    blob: request.sourceFile,
  }, timeoutMs)
  const requestId = ++sequence
  const { source: _source, sourceFile: _sourceFile, ...settings } = request
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      rejectWorkerRequests(new Error('处理超时，请降低输出尺寸或重新导入图片'))
    }, timeoutMs)
    pending.set(requestId, { resolve, reject, timer })
    try {
      activeWorker.postMessage({ type: 'process', protocol: PROTOCOL_VERSION, ...settings, requestId, sourceId })
    } catch (error) {
      clearTimeout(timer)
      pending.delete(requestId)
      reject(error)
    }
  })
}

export function releaseProcessingSource(sourceId: string): void {
  loadedSources.delete(sourceId)
  sourceLoads.delete(sourceId)
  if (!worker) return
  try {
    worker.postMessage({ type: 'release-source', protocol: PROTOCOL_VERSION, sourceId })
  } catch {
    // Worker错误会由onerror统一清理。
  }
}

export function clearProcessingWorker(): void {
  if (!worker) return
  try { worker.postMessage({ type: 'clear', protocol: PROTOCOL_VERSION }) } catch { /* handled by worker lifecycle */ }
  rejectWorkerRequests(new Error('图像处理Worker已清理'))
}
