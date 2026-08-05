import { describe, expect, it } from 'vitest'
import { parseLatestRelease } from '@/content/changelog-parser'

describe('CHANGELOG parser', () => {
  it('returns only the latest release and preserves its sections', () => {
    const release = parseLatestRelease(`# 更新日志\r\n\r\n## 0.4.1 - 2026-08-05\r\n\r\n### 修复\r\n- A\r\n- B\r\n\r\n## 0.4.0\r\n- C`)
    expect(release).toEqual({
      version: '0.4.1',
      date: '2026-08-05',
      sections: [{ title: '修复', items: ['A', 'B'] }],
    })
  })

  it('supports unsectioned entries and safely rejects malformed input', () => {
    expect(parseLatestRelease('## 1.2.3\n- Item')?.sections).toEqual([{ title: '更新', items: ['Item'] }])
    expect(parseLatestRelease('# no releases')).toBeNull()
  })
})
