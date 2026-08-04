import { releaseProcessingSource, runProcessing } from '@/core/worker-client'
import type { ProcessRequest, ProcessResponse } from '@/types/project'

export class StaleProcessingRequestError extends Error {
  constructor() {
    super('处理结果已过时')
    this.name = 'StaleProcessingRequestError'
  }
}

export class ProcessingService {
  private generation = 0

  async process(request: ProcessRequest, sourceId: string): Promise<ProcessResponse> {
    const generation = ++this.generation
    const response = await runProcessing(request, sourceId)
    if (generation !== this.generation) throw new StaleProcessingRequestError()
    return response
  }

  releaseSource(sourceId: string): void {
    this.generation += 1
    releaseProcessingSource(sourceId)
  }

  invalidate(): void { this.generation += 1 }
}
