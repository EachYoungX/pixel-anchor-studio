import { isDesktopPlatform } from '@/platform/platform-detection'
import type { PlatformService } from '@/platform/platform-service'
import { WebPlatformService } from '@/platform/web-platform-service'

let instance: PlatformService | undefined

export async function getPlatformService(): Promise<PlatformService> {
  if (instance) return instance
  if (isDesktopPlatform()) {
    const { DesktopPlatformService } = await import('@/platform/desktop-platform-service')
    instance = new DesktopPlatformService()
  } else {
    instance = new WebPlatformService()
  }
  return instance
}

export type { AppEnvironment, PlatformFile, PlatformService, SaveBinaryOptions, SaveResult } from '@/platform/platform-service'
