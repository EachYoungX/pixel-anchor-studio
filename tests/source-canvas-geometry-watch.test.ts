import { describe, expect, it } from 'vitest'
import { calculateOutputDimensions } from '@/core/dimensions'
import { createGridGeometrySignature } from '@/core/grid-preview'
import { defaultScale } from '@/domain/project/defaults'

describe('source canvas geometry signature', () => {
  it('changes when cell geometry changes without crossing an output dimension boundary', () => {
    const crop = { x: 5, y: 7, width: 103, height: 103 }
    const anchor = { x: 10, y: 10, width: 20, height: 20 }
    const first = calculateOutputDimensions(crop, anchor, { ...defaultScale(), mode: 'pseudo', pseudoCellSize: 10 })
    const second = calculateOutputDimensions(crop, anchor, { ...defaultScale(), mode: 'pseudo', pseudoCellSize: 10.1 })

    expect([first.width, first.height]).toEqual([second.width, second.height])
    expect(createGridGeometrySignature(first.geometry)).not.toEqual(createGridGeometrySignature(second.geometry))
  })
})
