import type { SerializedProject } from '@/types/project'
import { migrateProject } from '@/domain/project/migrations'

export function parseSerializedProject(value: unknown): SerializedProject {
  return migrateProject(value)
}
