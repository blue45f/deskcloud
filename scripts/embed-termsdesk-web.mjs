import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'desks/termsdesk/apps/web/dist')
const target = path.join(root, 'platform/apps/web/dist/termsdesk')

await rm(target, { recursive: true, force: true })
await mkdir(path.dirname(target), { recursive: true })
await cp(source, target, { recursive: true })

console.log(`Embedded TermsDesk web: ${path.relative(root, source)} -> ${path.relative(root, target)}`)
