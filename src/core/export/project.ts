import { migrateProject } from '@/domain/project/migrations'
import type { SerializedProject } from '@/types/project'

export function bytesToBase64(bytes: Uint8ClampedArray): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export function base64ToBytes(value: string): Uint8ClampedArray {
  const binary = atob(value)
  const bytes = new Uint8ClampedArray(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function encodeProjectFile(project: SerializedProject): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(project))
}

export async function parseProjectFile(file: File): Promise<SerializedProject> {
  return migrateProject(JSON.parse(await file.text()))
}

export function parseProjectBytes(data: Uint8Array): SerializedProject {
  return migrateProject(JSON.parse(new TextDecoder().decode(data)))
}

export { migrateProject }
