import { afterEach, describe, expect, it, vi } from 'vitest'
import { BitmapSourceBackend } from '@/workers/source-backends/bitmap-source-backend'
import { RgbaSourceBackend } from '@/workers/source-backends/rgba-source-backend'

describe('RgbaSourceBackend', () => {
  it('returns an integer crop envelope without mutating the source', async () => {
    const backend = new RgbaSourceBackend()
    const source = new Uint8ClampedArray([
      1, 2, 3, 255,
      4, 5, 6, 255,
      7, 8, 9, 255,
      10, 11, 12, 255,
      13, 14, 15, 255,
      16, 17, 18, 255,
    ])
    await backend.load('source-1', { width: 3, height: 2, data: source })

    const crop = backend.readCrop('source-1', { x: 0.5, y: 0, width: 1.5, height: 2 })

    expect(crop).toMatchObject({ originX: 0, originY: 0, width: 2, height: 2 })
    expect([...crop.data]).toEqual([
      1, 2, 3, 255,
      4, 5, 6, 255,
      10, 11, 12, 255,
      13, 14, 15, 255,
    ])
    expect([...source]).toEqual([
      1, 2, 3, 255,
      4, 5, 6, 255,
      7, 8, 9, 255,
      10, 11, 12, 255,
      13, 14, 15, 255,
      16, 17, 18, 255,
    ])

    backend.release('source-1')
    expect(() => backend.readCrop('source-1', { x: 0, y: 0, width: 1, height: 1 })).toThrow('源图缓存不存在')
  })
})

describe('BitmapSourceBackend', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('closes a bitmap whose source generation was released while decoding', async () => {
    const close = vi.fn()
    vi.stubGlobal('OffscreenCanvas', class {})
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 10, height: 10, close }))
    const backend = new BitmapSourceBackend()

    await expect(backend.load('source-late', { width: 10, height: 10, blob: new Blob() }, () => false)).resolves.toBe(false)

    expect(close).toHaveBeenCalledOnce()
    expect(() => backend.getDimensions('source-late')).toThrow('源图缓存不存在')
  })
})
