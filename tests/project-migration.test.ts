import { describe, expect, it } from 'vitest'
import { migrateProject } from '@/core/export/project'

const baseProject = {
  format: 'pixel-anchor-project',
  savedAt: '2026-08-04T00:00:00.000Z',
  source: null,
  crop: { x: 0, y: 0, width: 100, height: 100 },
  anchor: { x: 10, y: 10, width: 20, height: 20 },
  processing: {},
  result: null,
  colorCodes: {},
}

describe('migrateProject', () => {
  it('converts v2 directValue and keeps explicit legacy pagination', () => {
    const project = migrateProject({
      ...baseProject,
      version: 2,
      scale: { mode: 'direct', directValue: 96, directAxis: 'longSide', snapToGrid: false },
      bead: { pageColumns: 64, pageRows: 64 },
    })

    expect(project.version).toBe(3)
    expect(project.scale.directLongSide).toBe(96)
    expect(project.scale).not.toHaveProperty('directAxis')
    expect(project.scale).not.toHaveProperty('snapToGrid')
    expect(project.bead.pageColumns).toBe(64)
    expect(project.bead.pageRows).toBe(64)
  })

  it('defaults missing pagination to 32 × 32 for old projects', () => {
    const project = migrateProject({
      ...baseProject,
      version: 1,
      scale: { mode: 'direct', directValue: 64 },
    })

    expect(project.bead.pageColumns).toBe(32)
    expect(project.bead.pageRows).toBe(32)
  })
})
