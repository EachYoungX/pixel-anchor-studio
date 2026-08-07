import { describe, expect, it } from 'vitest'
import { decideIncomingFiles } from '@/domain/file-input/incoming-file-router'

describe('incoming file routing', () => {
  it('imports only the first image from a multi-image drop', () => {
    expect(decideIncomingFiles([
      { name: 'first.png', path: 'D:\\first.png' },
      { name: 'second.jpg', path: 'D:\\second.jpg' },
      { name: 'notes.txt', path: 'D:\\notes.txt' },
    ], 'desktop-drop')).toMatchObject({ kind: 'image', file: { name: 'first.png' }, ignoredCount: 2 })
  })

  it('rejects projects mixed with other files and multiple projects', () => {
    expect(decideIncomingFiles([
      { name: 'project.pixel-anchor.json' },
      { name: 'image.png' },
    ], 'web-drop')).toMatchObject({ kind: 'reject', reason: '项目文件需要单独拖入' })
    expect(decideIncomingFiles([
      { name: 'one.pixel-anchor.json' },
      { name: 'two.pixel-anchor.json' },
    ], 'desktop-drop')).toMatchObject({ kind: 'reject', reason: '一次只能打开一个项目文件' })
  })

  it('rejects directories and unsupported files', () => {
    expect(decideIncomingFiles([{ name: 'photos', isDirectory: true }], 'desktop-drop')).toMatchObject({ kind: 'reject', fileName: 'photos' })
    expect(decideIncomingFiles([{ name: 'design.psd' }], 'web-drop')).toMatchObject({ kind: 'reject', fileName: 'design.psd', reason: '文件类型不受支持' })
  })
})
