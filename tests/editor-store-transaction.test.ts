import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { markRaw } from 'vue'
import { useProjectStore } from '@/stores/project'

describe('store pixel edit transaction', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('records one history entry and refreshes the palette only after 100 changes end', () => {
    const store = useProjectStore()
    const data = new Uint8ClampedArray(16 * 16 * 4)
    for (let offset = 0; offset < data.length; offset += 4) data.set([0, 0, 0, 255], offset)
    store.result = markRaw({ width: 16, height: 16, data })
    store.refreshPalette()
    expect(store.palette).toMatchObject([{ hex: '#000000', count: 256 }])

    store.beginPixelEdit('画笔')
    for (let index = 0; index < 100; index += 1) {
      store.applyPixelChange(index % 16, Math.floor(index / 16), '#FF00FF')
    }

    expect(store.history).toHaveLength(1)
    expect(store.palette).toMatchObject([{ hex: '#000000', count: 256 }])
    store.endPixelEdit()
    expect(store.history).toHaveLength(1)
    expect(store.palette.map((entry) => [entry.hex, entry.count])).toEqual([
      ['#000000', 156],
      ['#FF00FF', 100],
    ])
  })
})
