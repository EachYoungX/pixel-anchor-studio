export interface ReleaseSection {
  title: string
  items: string[]
}

export interface ReleaseEntry {
  version: string
  date?: string
  sections: ReleaseSection[]
}

const RELEASE_HEADING = /^##\s+(\d+\.\d+\.\d+)(?:\s+-\s+(.+))?\s*$/

export function parseLatestRelease(markdown: string): ReleaseEntry | null {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const start = lines.findIndex((line) => RELEASE_HEADING.test(line.trim()))
  if (start < 0) return null

  const match = lines[start].trim().match(RELEASE_HEADING)
  if (!match) return null
  const sections: ReleaseSection[] = []
  let current: ReleaseSection | null = null

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (RELEASE_HEADING.test(line)) break
    const sectionMatch = line.match(/^###\s+(.+)$/)
    if (sectionMatch) {
      current = { title: sectionMatch[1].trim(), items: [] }
      sections.push(current)
      continue
    }
    const itemMatch = line.match(/^[-*]\s+(.+)$/)
    if (!itemMatch) continue
    if (!current) {
      current = { title: '更新', items: [] }
      sections.push(current)
    }
    current.items.push(itemMatch[1].trim())
  }

  return {
    version: match[1],
    date: match[2]?.trim() || undefined,
    sections: sections.filter((section) => section.items.length > 0),
  }
}
