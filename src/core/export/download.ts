import { getPlatformService } from '@/platform'

export async function saveBlob(blob: Blob, filename: string, extensions: string[], description: string): Promise<boolean> {
  const result = await (await getPlatformService()).saveBinary(new Uint8Array(await blob.arrayBuffer()), {
    suggestedName: filename,
    extensions,
    description,
  })
  return result.status === 'saved'
}

export function sanitizeFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'pixel-art'
}
