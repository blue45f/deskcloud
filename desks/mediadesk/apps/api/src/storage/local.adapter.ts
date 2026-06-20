import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

import type { StorageAdapter, StoredObject } from './storage.adapter'

/**
 * 로컬 파일시스템 어댑터(기본) — STORAGE_LOCAL_DIR 아래 테넌트별 하위 디렉터리로 격리.
 * 키는 상대 경로이며, 절대 경로화 후 루트 밖으로 새지 않는지 한 번 더 방어한다(이중 안전).
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly driver = 'local'

  constructor(private readonly rootDir: string) {}

  describe(): string {
    return `로컬 파일시스템 · ${resolve(this.rootDir)}`
  }

  /** 키 → 루트 기준 절대 경로(루트 이탈 차단). */
  private resolveSafe(key: string): string {
    const root = resolve(this.rootDir)
    const full = resolve(root, key)
    if (full !== root && !full.startsWith(root + sep)) {
      throw new Error(`스토리지 키가 루트를 벗어납니다: ${key}`)
    }
    return full
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<void> {
    const full = this.resolveSafe(key)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, body)
  }

  async get(key: string): Promise<StoredObject | null> {
    const full = this.resolveSafe(key)
    try {
      const body = await readFile(full)
      return { body, contentType: 'application/octet-stream', size: body.byteLength }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolveSafe(key))
      return true
    } catch {
      return false
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveSafe(key), { force: true })
  }

  async deletePrefix(prefix: string): Promise<void> {
    const full = this.resolveSafe(prefix)
    await rm(full, { recursive: true, force: true })
  }

  /** 어댑터 외부에서 파생 캐시 경로 등을 구성할 때 쓰는 헬퍼. */
  pathFor(key: string): string {
    return join(resolve(this.rootDir), key)
  }
}
