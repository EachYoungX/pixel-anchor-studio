import { describe, expect, it } from 'vitest'
import { decideDropImport, isSupportedImageFile, SUPPORTED_IMAGE_TYPES_TEXT } from '@/core/import/drop-files'

function file(name: string, type: string): File {
  return new File(['content'], name, { type })
}

describe('drop import decisions', () => {
  it('imports the first supported image and counts every ignored file', () => {
    const first = file('first.png', 'image/png')
    const decision = decideDropImport([
      file('notes.txt', 'text/plain'),
      first,
      file('second.webp', 'image/webp'),
    ])

    expect(decision).toEqual({ kind: 'image', file: first, ignoredCount: 2 })
  })

  it('requires a project file to be dropped alone', () => {
    const project = file('work.pixel-anchor.json', 'application/json')
    const decision = decideDropImport([project, file('source.png', 'image/png')])

    expect(decision.kind).toBe('reject')
    expect(decision).toMatchObject({ fileName: project.name })
    if (decision.kind === 'reject') expect(decision.reason).toContain('单独拖入')
  })

  it('rejects multiple projects, directories, and unsupported files', () => {
    const multipleProjects = decideDropImport([
      file('one.pixel-anchor.json', 'application/json'),
      file('two.pixel-anchor.json', 'application/json'),
    ])
    expect(multipleProjects.kind).toBe('reject')
    if (multipleProjects.kind === 'reject') expect(multipleProjects.reason).toContain('一次只能打开一个')

    const directory = decideDropImport([], [{ name: 'images' }])
    expect(directory).toMatchObject({ kind: 'reject', fileName: 'images' })
    if (directory.kind === 'reject') expect(directory.reason).toContain('不支持拖入文件夹')

    const unsupported = decideDropImport([file('archive.zip', 'application/zip')])
    expect(unsupported).toMatchObject({ kind: 'reject', fileName: 'archive.zip', reason: '文件类型不受支持' })
  })

  it('reports the same concrete image types it accepts', () => {
    expect(SUPPORTED_IMAGE_TYPES_TEXT).toBe('PNG、JPEG、WebP、GIF、AVIF、BMP、SVG')
    expect(isSupportedImageFile(file('image.tiff', 'image/tiff'))).toBe(false)
    expect(isSupportedImageFile(file('image.svg', 'image/svg+xml'))).toBe(true)
  })
})
