/// <reference lib="webworker" />

import { processImage } from '@/core/processing/process'
import type { ProcessRequest } from '@/types/project'

declare const self: DedicatedWorkerGlobalScope

type WorkerRequest =
  | { type: 'load-source'; sourceId: string; width: number; height: number; data: Uint8ClampedArray }
  | { type: 'release-source'; sourceId: string }
  | ({ type: 'process'; sourceId: string; requestId: number } & Omit<ProcessRequest, 'source'>)

const sources = new Map<string, ProcessRequest['source']>()

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  if (message.type === 'load-source') {
    sources.set(message.sourceId, { width: message.width, height: message.height, data: message.data })
    return
  }
  if (message.type === 'release-source') {
    sources.delete(message.sourceId)
    return
  }
  const { requestId, sourceId, type: _type, ...settings } = message
  const source = sources.get(sourceId)
  if (!source) {
    self.postMessage({ requestId, error: '源图缓存不存在，请重新导入图片' })
    return
  }
  try {
    const response = processImage({ ...settings, source })
    self.postMessage({ ...response, requestId }, [response.result.data.buffer])
  } catch (error) {
    const message = error instanceof Error ? error.message : '图像处理失败'
    self.postMessage({ requestId, error: message })
  }
}

export {}
