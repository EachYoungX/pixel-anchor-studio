import { describe, expect, it } from 'vitest'
import { ProcessingService, StaleProcessingRequestError } from '@/domain/processing/processing-service'
import type { ProcessRequest, ProcessResponse } from '@/types/project'

function request(): ProcessRequest {
  return {
    source: { width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) },
    crop: { x: 0, y: 0, width: 1, height: 1 },
    output: { width: 1, height: 1 },
    scaleOffset: { x: 0, y: 0 },
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
})
