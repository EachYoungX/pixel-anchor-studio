import type { Rect, ScaleSettings } from '@/types/project'

export const MAX_OUTPUT_SIZE = 256

export interface OutputDimensions {
  width: number
  height: number
  adjusted: boolean
  sourceCellSize: number
}

function clampDimension(value: number): number {
  return Math.max(1, Math.min(MAX_OUTPUT_SIZE, Math.round(value)))
}

function fitWithinLimit(width: number, height: number): { width: number; height: number; adjusted: boolean } {
  const maxSide = Math.max(width, height)
  if (maxSide <= MAX_OUTPUT_SIZE) {
    return {
      width: clampDimension(width),
      height: clampDimension(height),
      adjusted: false,
    }
  }

  const ratio = MAX_OUTPUT_SIZE / maxSide
  return {
    width: clampDimension(width * ratio),
    height: clampDimension(height * ratio),
    adjusted: true,
  }
}

export function calculateOutputDimensions(
  crop: Rect,
  anchor: Rect,
  settings: ScaleSettings,
): OutputDimensions {
  const cropWidth = Math.max(1, crop.width)
  const cropHeight = Math.max(1, crop.height)
  const aspect = cropWidth / cropHeight

  if (settings.mode === 'direct') {
    const requested = clampDimension(settings.directValue)
    let width = requested
    let height = requested

    if (settings.directAxis === 'width') {
      width = requested
      height = width / aspect
    } else if (settings.directAxis === 'height') {
      height = requested
      width = height * aspect
    } else if (cropWidth >= cropHeight) {
      width = requested
      height = width / aspect
    } else {
      height = requested
      width = height * aspect
    }

    const fitted = fitWithinLimit(width, height)
    return {
      ...fitted,
      sourceCellSize: cropWidth / fitted.width,
    }
  }

  if (settings.mode === 'anchor') {
    const anchorSide = Math.max(1, (anchor.width + anchor.height) / 2)
    const sourceCellSize = anchorSide / Math.max(1, settings.anchorCells)
    const fitted = fitWithinLimit(cropWidth / sourceCellSize, cropHeight / sourceCellSize)
    return {
      ...fitted,
      sourceCellSize: Math.max(cropWidth / fitted.width, cropHeight / fitted.height),
    }
  }

  const sourceCellSize = Math.max(0.25, settings.pseudoCellSize)
  const fitted = fitWithinLimit(cropWidth / sourceCellSize, cropHeight / sourceCellSize)
  return {
    ...fitted,
    sourceCellSize: Math.max(cropWidth / fitted.width, cropHeight / fitted.height),
  }
}
