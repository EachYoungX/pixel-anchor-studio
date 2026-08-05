import changelogText from '../../CHANGELOG.md?raw'
import { parseLatestRelease } from '@/content/changelog-parser'

export const latestRelease = parseLatestRelease(changelogText)
