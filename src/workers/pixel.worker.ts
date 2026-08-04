/// <reference lib="webworker" />

import { processImage } from '@/core/processing/process'
import type { ProcessRequest } from '@/types/project'

declare const self: DedicatedWorkerGlobalScope

type WorkerRequest = ProcessRequest & { requestId: number }

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { requestId, ...request } = event.data
  try {
    const response = processImage(request)
    self.postMessage({ ...response, requestId }, [response.result.data.buffer])
  } catch (error) {
    const message = error instanceof Error ? error.message : '图像处理失败'
    self.postMessage({ requestId, error: message })
  }
}

export {}
