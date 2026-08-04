import { cleanupSmallRegions } from '@/core/processing/cleanup'
import { quantizeImage } from '@/core/processing/quantization'
import { sampleImage } from '@/core/processing/sampling'
import type { ProcessRequest, ProcessResponse } from '@/types/project'

export function processImage(request: ProcessRequest): ProcessResponse {
  const startedAt = performance.now()
  let data = sampleImage(request)

  if (request.processing.quantize) {
    data = quantizeImage(data, request.processing.maxColors)
  }

  data = cleanupSmallRegions(
    data,
    request.output.width,
    request.output.height,
    request.processing.cleanup,
  )

  return {
    result: {
      width: request.output.width,
      height: request.output.height,
      data,
    },
    durationMs: performance.now() - startedAt,
  }
}
