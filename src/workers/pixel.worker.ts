/// <reference lib="webworker" />

import { createProcessingCaches, processImage } from '@/core/processing/process'
import type { ProcessRequest } from '@/types/project'
import { BitmapSourceBackend } from '@/workers/source-backends/bitmap-source-backend'
import { cropEnvelope } from '@/workers/source-backends/source-backend'
import { RgbaSourceBackend } from '@/workers/source-backends/rgba-source-backend'
import type { WorkerSourceInput } from '@/workers/source-backends/source-backend'

declare const self: DedicatedWorkerGlobalScope

type WorkerRequest =
  | { type: 'load-source'; protocol: 1; sourceId: string; source: WorkerSourceInput }
  | { type: 'release-source'; protocol: 1; sourceId: string }
  | { type: 'clear'; protocol: 1 }
  | ({ type: 'process'; protocol: 1; sourceId: string; requestId: number } & Omit<ProcessRequest, 'source' | 'sourceFile'>)

const bitmapBackend = new BitmapSourceBackend()
const rgbaBackend = new RgbaSourceBackend()
const sourceBackends = new Map<string, 'bitmap' | 'rgba'>()
const processingCaches = createProcessingCaches()

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  if (message.protocol !== 1) {
    self.postMessage({ type: 'error', protocol: 1, code: 'WORKER_PROTOCOL_MISMATCH', message: 'Worker协议版本不匹配' })
    return
  }
  if (message.type === 'load-source') {
    try {
      if (message.source.blob && bitmapBackend.supported) {
        try {
          await bitmapBackend.load(message.sourceId, message.source)
          sourceBackends.set(message.sourceId, 'bitmap')
        } catch {
          if (!message.source.data) {
            self.postMessage({ type: 'error', protocol: 1, sourceId: message.sourceId, code: 'SOURCE_RGBA_FALLBACK_REQUIRED', message: '当前环境需要使用RGBA兼容后端' })
            return
          }
          await rgbaBackend.load(message.sourceId, message.source)
          sourceBackends.set(message.sourceId, 'rgba')
        }
      } else {
        if (!message.source.data) {
          self.postMessage({ type: 'error', protocol: 1, sourceId: message.sourceId, code: 'SOURCE_RGBA_FALLBACK_REQUIRED', message: '当前环境需要使用RGBA兼容后端' })
          return
        }
        await rgbaBackend.load(message.sourceId, message.source)
        sourceBackends.set(message.sourceId, 'rgba')
      }
      self.postMessage({ type: 'source-loaded', protocol: 1, sourceId: message.sourceId, backend: sourceBackends.get(message.sourceId) })
    } catch (error) {
      self.postMessage({ type: 'error', protocol: 1, sourceId: message.sourceId, code: 'SOURCE_DECODE_FAILED', message: error instanceof Error ? error.message : '无法解码原图' })
    }
    return
  }
  if (message.type === 'release-source') {
    bitmapBackend.release(message.sourceId)
    rgbaBackend.release(message.sourceId)
    sourceBackends.delete(message.sourceId)
    processingCaches.crop.clear()
    processingCaches.sampling.clear()
    processingCaches.quantized.clear()
    processingCaches.final.clear()
    return
  }
  if (message.type === 'clear') {
    bitmapBackend.clear()
    rgbaBackend.clear()
    sourceBackends.clear()
    processingCaches.crop.clear()
    processingCaches.sampling.clear()
    processingCaches.quantized.clear()
    processingCaches.final.clear()
    return
  }

  try {
    const backend = sourceBackends.get(message.sourceId)
    if (!backend) throw new Error('源图缓存不存在，请重新导入图片')
    const sourceBackend = backend === 'bitmap' ? bitmapBackend : rgbaBackend
    const dimensions = sourceBackend.getDimensions(message.sourceId)
    const envelope = cropEnvelope(message.crop, dimensions)
    const cropKey = `${message.sourceId}:${envelope.originX},${envelope.originY},${envelope.width},${envelope.height}`
    const source = processingCaches.crop.get(cropKey) ?? sourceBackend.readCrop(message.sourceId, { x: envelope.originX, y: envelope.originY, width: envelope.width, height: envelope.height })
    if (!processingCaches.crop.has(cropKey)) processingCaches.crop.set(cropKey, source)
    const { requestId, sourceId: _sourceId, type: _type, protocol: _protocol, ...settings } = message
    const localCrop = {
      ...message.crop,
      x: message.crop.x - envelope.originX,
      y: message.crop.y - envelope.originY,
    }
    const localGrid = message.grid
      ? { ...message.grid, originX: message.grid.originX - envelope.originX, originY: message.grid.originY - envelope.originY }
      : undefined
    const response = processImage({ ...settings, sourceId: cropKey, source: { width: source.width, height: source.height, data: source.data }, crop: localCrop, grid: localGrid, sourceFile: undefined }, processingCaches)
    self.postMessage({ type: 'process-result', protocol: 1, requestId, result: response.result, durationMs: response.durationMs }, [response.result.data.buffer])
  } catch (error) {
    self.postMessage({ type: 'error', protocol: 1, requestId: message.requestId, code: 'PROCESSING_FAILED', message: error instanceof Error ? error.message : '图像处理失败' })
  }
}

export {}
