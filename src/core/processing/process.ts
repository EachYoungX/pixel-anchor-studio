import { cleanupSmallRegions } from '@/core/processing/cleanup'
import { quantizeImage } from '@/core/processing/quantization'
import { sampleImage } from '@/core/processing/sampling'
import { ByteLruCache, LruCache } from '@/domain/cache/lru-cache'
import { PROCESS_CACHE_LIMITS } from '@/domain/cache/cache-budget'
import { createFinalFingerprint, createQuantizedFingerprint, createSamplingFingerprint } from '@/domain/processing/process-fingerprint'
import type { ProcessRequest, ProcessResponse } from '@/types/project'
import type { SourceCrop } from '@/workers/source-backends/source-backend'

export interface ProcessingCaches {
  crop: ByteLruCache<string, SourceCrop>
  sampling: LruCache<string, Uint8ClampedArray>
  quantized: LruCache<string, Uint8ClampedArray>
  final: LruCache<string, Uint8ClampedArray>
}

export function createProcessingCaches(): ProcessingCaches {
  return {
    crop: new ByteLruCache(PROCESS_CACHE_LIMITS.cropBytes, (value) => value.data.byteLength),
    sampling: new LruCache(PROCESS_CACHE_LIMITS.samplingEntries),
    quantized: new LruCache(PROCESS_CACHE_LIMITS.quantizedEntries),
    final: new LruCache(PROCESS_CACHE_LIMITS.finalEntries),
  }
}

function copy(data: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(data)
}

export function processImage(request: ProcessRequest, caches = createProcessingCaches()): ProcessResponse {
  const startedAt = performance.now()
  const sourceRevision = request.sourceId ?? 'default'
  const dimensions = {
    width: request.output.width,
    height: request.output.height,
    cellSize: request.grid?.cellSize ?? Math.max(request.crop.width / request.output.width, request.crop.height / request.output.height),
    originX: request.grid?.originX ?? request.crop.x + request.scaleOffset.x * (request.grid?.cellSize ?? Math.max(request.crop.width / request.output.width, request.crop.height / request.output.height)),
    originY: request.grid?.originY ?? request.crop.y + request.scaleOffset.y * (request.grid?.cellSize ?? Math.max(request.crop.width / request.output.width, request.crop.height / request.output.height)),
  }
  const samplingKey = `${createSamplingFingerprint({
    sourceRevision,
    crop: request.crop,
    grid: dimensions,
    sampling: request.processing.sampling,
  })}:${request.processing.preserveAlpha}:${request.processing.transparentThreshold}`
  let data = caches.sampling.get(samplingKey)
  if (!data) {
    data = sampleImage(request)
    caches.sampling.set(samplingKey, copy(data))
  }

  const quantizedKey = createQuantizedFingerprint(samplingKey, request.processing.quantize ? request.processing.maxColors : 0)
  let quantized = caches.quantized.get(quantizedKey)
  if (!quantized) {
    quantized = request.processing.quantize ? quantizeImage(data, request.processing.maxColors) : copy(data)
    caches.quantized.set(quantizedKey, copy(quantized))
  }

  const finalKey = createFinalFingerprint(quantizedKey, {
    mode: request.processing.cleanup,
    preserveTransparent: request.processing.preserveAlpha,
  })
  let final = caches.final.get(finalKey)
  if (!final) {
    final = cleanupSmallRegions(quantized, request.output.width, request.output.height, request.processing.cleanup)
    caches.final.set(finalKey, copy(final))
  }

  return {
    result: {
      width: request.output.width,
      height: request.output.height,
      data: copy(final),
    },
    durationMs: performance.now() - startedAt,
  }
}
