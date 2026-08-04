import { describe, expect, it } from 'vitest'
import { EditorSession } from '@/domain/editor/editor-session'
import type { PixelResult } from '@/types/project'

function result(): PixelResult {
  return { width: 4, height: 3, data: new Uint8ClampedArray(4 * 3 * 4) }
}

describe('EditorSession', () => {
  it('records one snapshot and accumulates dirty bounds for a stroke', () => {
    const session = new EditorSession()
    session.begin(result(), '画笔')
    expect(session.historyEntry()?.label).toBe('画笔')
    session.recordChange(2, 1)
    session.recordChange(0, 2)
    expect(session.dirtyBounds).toEqual({ minX: 0, minY: 1, maxX: 2, maxY: 2 })
    expect(session.end()).toEqual({ minX: 0, minY: 1, maxX: 2, maxY: 2 })
    expect(session.active).toBe(false)
  })

  it('returns the pre-edit result when cancelled', () => {
    const initial = result()
    initial.data[0] = 42
    const session = new EditorSession()
    session.begin(initial, '画笔')
    initial.data[0] = 99
    expect(session.cancel()?.data[0]).toBe(42)
  })
})
