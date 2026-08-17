import { spawnSync } from 'node:child_process'
import process from 'node:process'

const version = process.argv[2]
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

if (!version || !semverPattern.test(version)) {
  console.error('用法：npm run version:set -- <version>（例如 1.0.0 或 1.1.0-beta.1）')
  process.exit(1)
}

function run(command, args) {
  const executable = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command
  const result = spawnSync(executable, args, { cwd: process.cwd(), stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('npm', ['version', version, '--no-git-tag-version', '--allow-same-version'])
run('npm', ['run', 'desktop:sync-version'])
run('npm', ['run', 'desktop:manifest'])
run('cargo', ['check', '--manifest-path', 'src-tauri/Cargo.toml'])

console.log(`Version metadata synchronized to ${version}. Remember to update CHANGELOG.md before committing.`)
