import type { Rect } from '@/types/project'

export function clampSourceRect(rect: Rect, width: number, height: number, minimum = 4): Rect {
  const nextWidth = Math.max(minimum, Math.min(width, rect.width))
  const nextHeight = Math.max(minimum, Math.min(height, rect.height))
  return {
    x: Math.max(0, Math.min(width - nextWidth, rect.x)),
    y: Math.max(0, Math.min(height - nextHeight, rect.y)),
    width: nextWidth,
    height: nextHeight,
  }
}

export function snapSourceRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  }
}

export function snapSourceRectToGrid(rect: Rect, cellSize: number, originX: number, originY: number): Rect {
  const step = Math.max(0.25, cellSize)
  return {
    x: originX + Math.round((rect.x - originX) / step) * step,
    y: originY + Math.round((rect.y - originY) / step) * step,
    width: Math.max(step, Math.round(rect.width / step) * step),
    height: Math.max(step, Math.round(rect.height / step) * step),
  }
}

export function fullSourceRect(width: number, height: number): Rect {
  return { x: 0, y: 0, width, height }
}

export function centerSquareRect(width: number, height: number): Rect {
  const side = Math.min(width, height)
  return { x: (width - side) / 2, y: (height - side) / 2, width: side, height: side }
}

export function normalizeSourceAnchor(rect: Rect, sourceWidth: number, sourceHeight: number): Rect {
  const side = Math.max(4, Math.min(rect.width, rect.height, sourceWidth, sourceHeight))
  return clampSourceRect({ ...rect, width: side, height: side }, sourceWidth, sourceHeight, 4)
}
