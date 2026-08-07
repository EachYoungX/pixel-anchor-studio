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
})
