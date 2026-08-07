export interface IncomingFile {
  name: string
  path?: string
  file?: File
  isDirectory?: boolean
}

export type IncomingSource =
  | 'image-picker'
  | 'project-picker'
  | 'web-drop'
  | 'desktop-drop'

export interface IncomingFileNotice {
  id: number
  tone: 'success' | 'error'
  title: string
  detail: string
}
