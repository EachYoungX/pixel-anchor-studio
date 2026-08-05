import { releaseProcessingSource, runProcessing, WorkerClientError } from '@/core/worker-client'
import type { ProcessRequest, ProcessResponse } from '@/types/project'

export type ProcessingRunner = (request: ProcessRequest, sourceId: string) => Promise<ProcessResponse>

export class StaleProcessingRequestError extends Error {
  constructor() {
    super('处理结果已过时')
    this.name = 'StaleProcessingRequestError'
  }
}

export class ProcessingService {
  private generation = 0

  constructor(private readonly runner: ProcessingRunner = runProcessing) {}

  async process(
    request: ProcessRequest,
    sourceId: string,
    createRgbaFallback?: () => Uint8ClampedArray,
  ): Promise<ProcessResponse> {
    const generation = ++this.generation
    let response: ProcessResponse
    try {
      response = await this.runner(request, sourceId)
    } catch (error) {
      if (!(error instanceof WorkerClientError) || error.code !== 'SOURCE_RGBA_FALLBACK_REQUIRED' || !createRgbaFallback) throw error
      response = await this.runner({
        ...request,
        sourceFile: undefined,
        source: { ...request.source, data: createRgbaFallback() },
      }, sourceId)
    }
    if (generation !== this.generation) throw new StaleProcessingRequestError()
    return response
  }

  releaseSource(sourceId: string): void {
    this.generation += 1
    releaseProcessingSource(sourceId)
  }

  invalidate(): void { this.generation += 1 }
}
