import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { AppEnvironment, PlatformFile, PlatformService, SaveBinaryOptions, SaveResult } from '@/platform/platform-service'

interface DesktopFilePayload {
  name: string
  mime: string
  data: number[] | Uint8Array
  path: string
}

function normalizeFile(payload: DesktopFilePayload): PlatformFile {
  return { ...payload, data: payload.data instanceof Uint8Array ? payload.data : Uint8Array.from(payload.data) }
}

export class DesktopPlatformService implements PlatformService {
  readonly kind = 'desktop' as const

  async importImage(): Promise<PlatformFile | null> {
    const payload = await invoke<DesktopFilePayload | null>('pick_image')
    return payload ? normalizeFile(payload) : null
  }

  async openProject(): Promise<PlatformFile | null> {
    const payload = await invoke<DesktopFilePayload | null>('open_project')
    return payload ? normalizeFile(payload) : null
  }

  async readDroppedFiles(paths: string[]): Promise<PlatformFile[]> {
    const files: PlatformFile[] = []
    for (const path of paths) {
      files.push(normalizeFile(await invoke<DesktopFilePayload>('read_dropped_file', { path })))
    }
    return files
  }

  async saveProject(data: Uint8Array, suggestedName: string, options = {}): Promise<SaveResult> {
    return this.saveBinary(data, {
      suggestedName,
      extensions: ['json'],
      description: 'Pixel Anchor 项目',
      projectFile: true,
      ...options,
    })
  }

  async saveBinary(data: Uint8Array, options: SaveBinaryOptions): Promise<SaveResult> {
    return invoke<SaveResult>('save_binary', {
      request: {
        data: Array.from(data),
        suggestedName: options.suggestedName,
        extensions: options.extensions,
        description: options.description,
        currentPath: options.currentPath,
        forceDialog: options.forceDialog ?? true,
        projectFile: options.projectFile ?? false,
      },
    })
  }

  async openExternalUrl(url: string): Promise<void> {
    await openUrl(url)
  }

  async getAppEnvironment(): Promise<AppEnvironment> {
    return invoke<AppEnvironment>('get_app_environment')
  }

  async setWindowTitle(title: string): Promise<void> {
    await getCurrentWindow().setTitle(title)
  }

  async adoptProjectPath(path?: string): Promise<void> {
    await invoke('adopt_project_path', { path })
  }
}
