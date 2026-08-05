import { describe, expect, it } from 'vitest'
import packageDocument from '../package.json'
import { latestRelease } from '@/content/release-notes'

describe('bundled release notes', () => {
  it('matches the application version and includes user-facing sections', () => {
    expect(latestRelease?.version).toBe(packageDocument.version)
    expect(latestRelease?.sections.length).toBeGreaterThan(0)
  })
})
