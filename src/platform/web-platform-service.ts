import type { AppEnvironment, PlatformFile, PlatformService, SaveBinaryOptions, SaveResult } from '@/platform/platform-service'

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true })
    input.addEventListener('cancel', () => resolve(null), { once: true })
    input.click()
  })
}

async function toPlatformFile(file: File): Promise<PlatformFile> {
  return { name: file.name, mime: file.type, data: new Uint8Array(await file.arrayBuffer()) }
}

function download(data: Uint8Array, filename: string, mime = 'application/octet-stream'): void {
  const blob = new Blob([new Uint8Array(data)], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

interface BrowserSaveFileHandle {
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>
}

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string
    types: Array<{ description: string; accept: Record<string, string[]> }>
  }) => Promise<BrowserSaveFileHandle>
}

async function saveWithBrowserPicker(data: Uint8Array, options: SaveBinaryOptions, mime: string): Promise<SaveResult | null> {
  const showSaveFilePicker = (window as SavePickerWindow).showSaveFilePicker
  if (!showSaveFilePicker) return null
  try {
    const handle = await showSaveFilePicker.call(window, {
      suggestedName: options.suggestedName,
      types: [{
        description: options.description,
        accept: { [mime.split(';')[0]]: options.extensions.map((extension) => `.${extension}`) },
      }],
    })
    const writable = await handle.createWritable()
    await writable.write(new Blob([new Uint8Array(data)], { type: mime }))
    await writable.close()
    return { status: 'saved' }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return { status: 'cancelled' }
    throw error
  }
}

export class WebPlatformService implements PlatformService {
  readonly kind = 'web' as const

  async importImage(): Promise<PlatformFile | null> {
    const file = await pickFile('image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp,image/svg+xml')
    return file ? toPlatformFile(file) : null
  }

  async openProject(): Promise<PlatformFile | null> {
    const file = await pickFile('.json,application/json')
    return file ? toPlatformFile(file) : null
  }

  async readDroppedFiles(): Promise<PlatformFile[]> {
    return []
  }

  async saveProject(data: Uint8Array, suggestedName: string): Promise<SaveResult> {
    download(data, suggestedName, 'application/json;charset=utf-8')
    return { status: 'saved' }
  }

  async saveBinary(data: Uint8Array, options: SaveBinaryOptions): Promise<SaveResult> {
    const extension = options.extensions[0]?.toLowerCase()
    const mime = extension === 'png' ? 'image/png'
      : extension === 'svg' ? 'image/svg+xml;charset=utf-8'
        : extension === 'pdf' ? 'application/pdf'
          : extension === 'csv' ? 'text/csv;charset=utf-8'
            : 'application/octet-stream'
    if (extension === 'png') {
      const pickerResult = await saveWithBrowserPicker(data, options, mime)
      if (pickerResult) return pickerResult
    }
    download(data, options.suggestedName, mime)
    return { status: 'saved' }
  }

  async openExternalUrl(url: string): Promise<void> {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async getAppEnvironment(): Promise<AppEnvironment> {
    return { platform: 'web', mode: 'web', version: __APP_VERSION__ }
  }

  async setWindowTitle(title: string): Promise<void> {
    document.title = title
  }

  async adoptProjectPath(): Promise<void> {}
}
