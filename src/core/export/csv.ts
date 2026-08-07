import { saveBlob } from '@/core/export/download'
import type { PaletteEntry } from '@/types/project'

export async function exportPaletteCsv(entries: PaletteEntry[], filename: string): Promise<boolean> {
  const rows = [
    ['code', 'hex', 'red', 'green', 'blue', 'alpha', 'count'],
    ...entries.map((entry) => [entry.code, entry.hex, ...entry.rgba, entry.count]),
  ]
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  return saveBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), filename, ['csv'], 'CSV 表格')
}
