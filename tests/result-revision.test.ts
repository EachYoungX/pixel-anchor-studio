import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { markRaw } from 'vue'
import { useProjectStore } from '@/stores/project'

function resultWithTwoColors() {
  return markRaw({
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 0, 255, 255,
    ]),
  })
}

describe('result revision', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('increments after an in-place palette merge', () => {
    const store = useProjectStore()
    store.result = resultWithTwoColors()
    store.refreshPalette()
    const before = store.resultRevision

    store.mergeColor('#FF0000', '#0000FF')

    expect(store.resultRevision).toBe(before + 1)
    expect([...store.result!.data]).toEqual([0, 0, 255, 255, 0, 0, 255, 255])
  })

  it('rolls back a canceled stroke without leaving history', () => {
    const store = useProjectStore()
    store.result = resultWithTwoColors()
    store.refreshPalette()
    const before = store.resultRevision

    store.beginPixelEdit('画笔')
    store.applyPixelChange(0, 0, '#00FF00')
    expect(store.history).toHaveLength(1)
    store.cancelPixelEdit()

    expect(store.resultRevision).toBe(before + 2)
    expect(store.history).toHaveLength(0)
    expect([...store.result!.data.slice(0, 4)]).toEqual([255, 0, 0, 255])
  })

  it('keeps a normally completed stroke as one undo entry', () => {
    const store = useProjectStore()
    store.result = resultWithTwoColors()
    store.beginPixelEdit('画笔')
    store.applyPixelChange(0, 0, '#00FF00')
    store.endPixelEdit()

    expect(store.history).toHaveLength(1)
    expect([...store.result!.data.slice(0, 4)]).toEqual([0, 255, 0, 255])
  })
})
