import { describe, expect, it } from 'vitest'
import { defaultBead, defaultProcessing, defaultScale } from '@/domain/project/defaults'
import { serializeProject } from '@/domain/project/serialization'

describe('project serialization', () => {
  it('stores the original compressed source bytes and serializable state only', async () => {
    const file = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' })
    const document = await serializeProject({
      source: { name: 'photo.jpg', mime: 'image/jpeg', width: 2, height: 2, file, previewUrl: 'blob:runtime-only' },
      crop: { x: 0, y: 0, width: 2, height: 2 },
      cropSettings: { mode: 'custom', customRect: { x: 0, y: 0, width: 2, height: 2 } },
      anchor: { x: 0, y: 0, width: 2, height: 2 },
      scale: defaultScale(),
      processing: defaultProcessing(),
      bead: defaultBead(),
      result: null,
      colorCodes: {},
    })

    expect(document.source).toMatchObject({ name: 'photo.jpg', mime: 'image/jpeg', dataBase64: 'AQIDBA==' })
    expect(JSON.stringify(document)).not.toContain('blob:runtime-only')
    expect(document.scale.snapMode).toBe('source-pixel')
    expect(document.cropSettings.mode).toBe('custom')
  })
})
