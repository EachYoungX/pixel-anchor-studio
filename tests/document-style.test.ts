import { describe, expect, it } from 'vitest'
import { ptToMm } from '@/core/bead/document-style'

describe('bead document style', () => {
  it('converts PDF points to SVG millimetres', () => {
    expect(ptToMm(9)).toBeCloseTo(3.175, 3)
    expect(ptToMm(14)).toBeCloseTo(4.9389, 3)
  })
})
