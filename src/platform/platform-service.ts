export interface PlatformFile {
  name: string
  mime: string
  data: Uint8Array
  path?: string
}

export interface SaveResult {
  status: 'saved' | 'cancelled'
  path?: string
}

export interface SaveBinaryOptions {
  suggestedName: string
  extensions: string[]
  description: string
  currentPath?: string
  forceDialog?: boolean
  projectFile?: boolean
}

export interface AppEnvironment {
  platform: 'web' | 'desktop'
  mode: 'web' | 'portable' | 'installed'
  dataDirectory?: string
  version: string
  webview2Version?: string
}

export interface PlatformService {
  readonly kind: 'web' | 'desktop'
  importImage(): Promise<PlatformFile | null>
  openProject(): Promise<PlatformFile | null>
  readDroppedFiles(paths: string[]): Promise<PlatformFile[]>
  saveProject(data: Uint8Array, suggestedName: string, options?: Pick<SaveBinaryOptions, 'currentPath' | 'forceDialog'>): Promise<SaveResult>
  saveBinary(data: Uint8Array, options: SaveBinaryOptions): Promise<SaveResult>
  openExternalUrl(url: string): Promise<void>
  getAppEnvironment(): Promise<AppEnvironment>
  setWindowTitle(title: string): Promise<void>
  adoptProjectPath(path?: string): Promise<void>
}
