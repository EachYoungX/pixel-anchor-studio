import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectStore } from '@/stores/project'

describe('project dirty state', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('tracks document settings and preserves the current save path', () => {
    const project = useProjectStore()

    expect(project.dirty).toBe(false)
    expect(project.currentProjectPath).toBeUndefined()

    project.scale.directLongSide = 48
    expect(project.dirty).toBe(true)

    project.markSaved('D:\\Pixel Projects\\sample.pixel-anchor.json')
    expect(project.dirty).toBe(false)
    expect(project.currentProjectPath).toBe('D:\\Pixel Projects\\sample.pixel-anchor.json')

    project.processing.maxColors = 12
    expect(project.dirty).toBe(true)

    project.abandonChanges()
    expect(project.dirty).toBe(false)
    expect(project.currentProjectPath).toBe('D:\\Pixel Projects\\sample.pixel-anchor.json')
  })

  it('clears document state while preserving processing preferences', () => {
    const project = useProjectStore()
    project.scale.directLongSide = 48
    project.processing.maxColors = 12
    project.markSaved('D:\\Pixel Projects\\sample.pixel-anchor.json')
    project.scale.offsetX = 0.5

    project.clearCurrent()

    expect(project.dirty).toBe(false)
    expect(project.currentProjectPath).toBeUndefined()
    expect(project.result).toBeNull()
    expect(project.history).toEqual([])
    expect(project.future).toEqual([])
    expect(project.crop).toMatchObject({ x: 0, y: 0, width: 1, height: 1 })
    expect(project.anchor).toMatchObject({ x: 0, y: 0, width: 32, height: 32 })
    expect(project.scale.directLongSide).toBe(48)
    expect(project.processing.maxColors).toBe(12)
  })
})
