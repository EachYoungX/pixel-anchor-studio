import { describe, expect, it } from 'vitest'
import { ProcessingService, StaleProcessingRequestError } from '@/domain/processing/processing-service'
import { WorkerClientError } from '@/core/worker-client'
import type { ProcessRequest, ProcessResponse } from '@/types/project'

function request(): ProcessRequest {
  return {
    source: { width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) },
    crop: { x: 0, y: 0, width: 1, height: 1 },
    output: { width: 1, height: 1 },
    grid: { cellSize: 1, originX: 0, originY: 0 },
    processing: { sampling: 'nearest', quantize: false, maxColors: 2, cleanup: 'off', preserveAlpha: true, transparentThreshold: 24 },
  }
}

function response(value: number): ProcessResponse {
  return { durationMs: 0, result: { width: 1, height: 1, data: new Uint8ClampedArray([value, 0, 0, 255]) } }
}

describe('ProcessingService', () => {
  it('rejects a response that belongs to an older generation', async () => {
    const resolvers: Array<(value: ProcessResponse) => void> = []
    const service = new ProcessingService(() => new Promise((resolve) => resolvers.push(resolve)))
    const first = service.process(request(), 'source-1')
    const second = service.process(request(), 'source-1')
    resolvers[0](response(1))
    resolvers[1](response(2))
    await expect(first).rejects.toBeInstanceOf(StaleProcessingRequestError)
    await expect(second).resolves.toMatchObject({ result: { data: expect.any(Uint8ClampedArray) } })
  })

  it('retries with lazily-created RGBA data when the bitmap backend is unavailable', async () => {
    const requests: ProcessRequest[] = []
    const service = new ProcessingService(async (next) => {
      requests.push(next)
      if (next.sourceFile) throw new WorkerClientError('SOURCE_RGBA_FALLBACK_REQUIRED', 'fallback')
      return response(next.source.data[0])
    })
    const source = request()
    source.source.data = new Uint8ClampedArray()
    source.sourceFile = new Blob(['image'], { type: 'image/png' })
    let fallbackCalls = 0

    await expect(service.process(source, 'source-1', () => {
      fallbackCalls += 1
      return new Uint8ClampedArray([42, 0, 0, 255])
    })).resolves.toMatchObject({ result: { data: expect.any(Uint8ClampedArray) } })

    expect(fallbackCalls).toBe(1)
    expect(requests).toHaveLength(2)
    expect(requests[1].sourceFile).toBeUndefined()
    expect(requests[1].source.data[0]).toBe(42)
  })
})
