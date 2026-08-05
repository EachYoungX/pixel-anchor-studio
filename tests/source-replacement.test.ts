import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadSourceFile: vi.fn(),
  loadHtmlImage: vi.fn(),
  createSourcePreview: vi.fn(),
}))

vi.mock('@/core/image/load', () => ({
  loadSourceFile: mocks.loadSourceFile,
  loadHtmlImage: mocks.loadHtmlImage,
  validateSourceDimensions: (width: number, height: number) => width * height,
}))

vi.mock('@/runtime/source-preview', () => ({
  createSourcePreview: mocks.createSourcePreview,
}))

import { SourceSession } from '@/domain/source/source-session'

function image(width: number, height: number): HTMLImageElement {
  return { naturalWidth: width, naturalHeight: height } as HTMLImageElement
}

function preview(width: number, height: number, release = vi.fn()) {
  return { image: image(width, height), width, height, release }
}

afterEach(() => {
  vi.restoreAllMocks()
  mocks.loadSourceFile.mockReset()
  mocks.loadHtmlImage.mockReset()
  mocks.createSourcePreview.mockReset()
})

describe('transactional source replacement', () => {
  it('keeps the current source when a replacement file cannot be decoded', async () => {
    const firstRelease = vi.fn()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const firstImage = image(20, 10)
    mocks.loadSourceFile.mockResolvedValueOnce({
      source: { name: 'first.png', mime: 'image/png', width: 20, height: 10, file: new Blob(), previewUrl: 'blob:first' },
      image: firstImage,
      estimatedRgbaBytes: 800,
    })
    mocks.createSourcePreview.mockResolvedValueOnce(preview(20, 10, firstRelease))
    const session = new SourceSession()
    const first = await session.openFile({ name: 'first.png' } as File)

    mocks.loadSourceFile.mockRejectedValueOnce(new Error('无法解码图片'))
    await expect(session.openFile({ name: 'broken.png' } as File)).rejects.toThrow('无法解码图片')

    expect(firstRelease).not.toHaveBeenCalled()
    expect(revoke).not.toHaveBeenCalledWith('blob:first')
    expect(session.adopt(first)).toBe(first)
  })

  it('uses decoded image dimensions instead of untrusted project metadata', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:project')
    const decoded = image(640, 480)
    mocks.loadHtmlImage.mockResolvedValueOnce(decoded)
    mocks.createSourcePreview.mockResolvedValueOnce(preview(640, 480))
    const session = new SourceSession()

    const loaded = await session.openBlob({
      name: 'project.png',
      mime: 'image/png',
      width: 1,
      height: 2,
      blob: new Blob(),
    })

    expect(loaded.source).toMatchObject({ width: 640, height: 480 })
    expect(loaded.estimatedRgbaBytes).toBe(640 * 480 * 4)
    session.release()
    expect(revoke).toHaveBeenCalledWith('blob:project')
  })

  it('releases a prepared source that loses a concurrent replacement race', async () => {
    const preparedRelease = vi.fn()
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    mocks.loadSourceFile.mockResolvedValueOnce({
      source: { name: 'late.png', mime: 'image/png', width: 8, height: 8, file: new Blob(), previewUrl: 'blob:late' },
      image: image(8, 8),
      estimatedRgbaBytes: 256,
    })
    mocks.createSourcePreview.mockResolvedValueOnce(preview(8, 8, preparedRelease))
    const session = new SourceSession()

    const prepared = await session.prepareFile({ name: 'late.png' } as File)
    session.discard(prepared)

    expect(preparedRelease).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:late')
  })
})
