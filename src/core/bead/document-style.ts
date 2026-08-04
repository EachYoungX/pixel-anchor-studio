export const beadDocumentStyle = {
  pageHeaderPt: 8,
  axisLabelPt: 5.5,
  cellCodeMinPt: 4,
  cellCodeMaxPt: 7,
  legendTitlePt: 14,
  legendTextPt: 8,
  gridStrokeWidthMm: 0.35,
  legendColumnWidthMm: 72,
}

export function ptToMm(pt: number): number {
  return pt * 25.4 / 72
}
