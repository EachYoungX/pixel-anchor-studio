import { afterEach, describe, expect, it } from 'vitest'
import { clearProcessingWorker, releaseProcessingSource, runProcessing } from '@/core/worker-client'
import type { ProcessRequest } from '@/types/project'

type FakeMessage = {
  type: string
  sourceId?: string
  requestId?: number
  protocol?: number
  result?: { width: number; height: number; data: Uint8ClampedArray }
  durationMs?: number
}

class FakeWorker {
  onmessage: ((event: MessageEvent<FakeMessage>) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  readonly messages: FakeMessage[] = []

  constructor(private readonly processMessage: (worker: FakeWorker, message: FakeMessage) => void) {}

  postMessage(message: FakeMessage): void {
    this.messages.push(message)
    this.processMessage(this, message)
  }
}

const originalWorker = globalThis.Worker
let lastWorker: FakeWorker | null = null

function request(): ProcessRequest {
  return {
    sourceId: 'source-test',
    source: { width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) },
    crop: { x: 0, y: 0, width: 1, height: 1 },
    output: { width: 1, height: 1 },
    scaleOffset: { x: 0, y: 0 },
    processing: { sampling: 'nearest', quantize: false, maxColors: 2, cleanup: 'off', preserveAlpha: true, transparentThreshold: 24 },
  }
}

function installFakeWorker(onProcess: (worker: FakeWorker, message: FakeMessage) => void, respondToLoad = true): void {
  globalThis.Worker = class extends FakeWorker {
    constructor() {
      super((worker, message) => {
        if (message.type === 'load-source' && respondToLoad) {
          queueMicrotask(() => worker.onmessage?.({ data: { type: 'source-loaded', protocol: 1, sourceId: message.sourceId } } as MessageEvent<FakeMessage>))
          return
        }
        if (message.type === 'process') onProcess(worker, message)
      })
      lastWorker = this
    }
  } as unknown as typeof Worker
}

afterEach(() => {
  clearProcessingWorker()
  globalThis.Worker = originalWorker
  lastWorker = null
})

describe('worker client defensive handling', () => {
  it('rejects when a processing request times out', async () => {
    installFakeWorker(() => undefined)
    await expect(runProcessing(request(), 'source-test', 10)).rejects.toThrow('处理超时')
  })

  it('rejects when the source load times out', async () => {
    installFakeWorker(() => undefined, false)
    await expect(runProcessing(request(), 'source-timeout', 10)).rejects.toThrow('加载原图超时')
  })

  it('rejects all pending work when the Worker crashes', async () => {
    installFakeWorker((worker) => queueMicrotask(() => worker.onerror?.()))
    await expect(runProcessing(request())).rejects.toThrow('图像处理Worker已崩溃')
  })

  it('rejects all pending work when a Worker message cannot be decoded', async () => {
    installFakeWorker((worker) => queueMicrotask(() => worker.onmessageerror?.()))
    await expect(runProcessing(request())).rejects.toThrow('图像处理Worker消息无效')
  })

  it('loads a source once and reloads it after release', async () => {
    installFakeWorker((worker, message) => queueMicrotask(() => worker.onmessage?.({
      data: { type: 'process-result', protocol: 1, requestId: message.requestId, result: { width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) }, durationMs: 0 },
    } as MessageEvent<FakeMessage>)))
    await runProcessing(request(), 'source-reuse')
    await runProcessing(request(), 'source-reuse')
    expect(lastWorker?.messages.filter((message) => message.type === 'load-source')).toHaveLength(1)
    releaseProcessingSource('source-reuse')
    await runProcessing(request(), 'source-reuse')
    expect(lastWorker?.messages.filter((message) => message.type === 'load-source')).toHaveLength(2)
    expect(lastWorker?.messages.some((message) => message.type === 'release-source')).toBe(true)
  })
})
