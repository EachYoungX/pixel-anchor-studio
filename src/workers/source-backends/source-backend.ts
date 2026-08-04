export interface WorkerSourceInput {
  width: number
  height: number
  data?: Uint8ClampedArray
  blob?: Blob
}

export interface CropEnvelope {
  originX: number
  originY: number
  width: number
  height: number
}

export interface SourceCrop extends CropEnvelope {
  data: Uint8ClampedArray
}

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface SourceDimensions {
  width: number
  height: number
}

export function cropEnvelope(crop: CropRect, source: SourceDimensions): CropEnvelope {
  const originX = Math.max(0, Math.min(source.width - 1, Math.floor(crop.x)))
  const originY = Math.max(0, Math.min(source.height - 1, Math.floor(crop.y)))
  const right = Math.max(originX + 1, Math.min(source.width, Math.ceil(crop.x + crop.width)))
  const bottom = Math.max(originY + 1, Math.min(source.height, Math.ceil(crop.y + crop.height)))
  return { originX, originY, width: right - originX, height: bottom - originY }
}

export interface WorkerSourceBackend {
  load(sourceId: string, input: WorkerSourceInput): Promise<void>
  getDimensions(sourceId: string): SourceDimensions
  readCrop(sourceId: string, crop: CropRect): SourceCrop
  release(sourceId: string): void
  clear(): void
}
