export interface WorkerSourceInput {
  width: number
  height: number
  data?: Uint8ClampedArray
  blob?: Blob
}

export interface WorkerSourceBackend {
  load(sourceId: string, input: WorkerSourceInput): Promise<void>
  readSource(sourceId: string): { width: number; height: number; data: Uint8ClampedArray }
  release(sourceId: string): void
  clear(): void
}
