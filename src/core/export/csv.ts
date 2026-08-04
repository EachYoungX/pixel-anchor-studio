import { downloadBlob } from '@/core/export/download'
import type { PaletteEntry } from '@/types/project'

export function exportPaletteCsv(entries: PaletteEntry[], filename: string): void {
  const rows = [
    ['code', 'hex', 'red', 'green', 'blue', 'alpha', 'count'],
    ...entries.map((entry) => [entry.code, entry.hex, ...entry.rgba, entry.count]),
  ]
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), filename)
}
