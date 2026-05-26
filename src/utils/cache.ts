import { RUNTIME } from '../config/constants.js'

type Entry<T> = { value: T; expires: number }

const store = new Map<string, Entry<any>>()

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key)
  if (!hit) return undefined
  if (Date.now() > hit.expires) {
    store.delete(key)
    return undefined
  }
  return hit.value as T
}

export function cacheSet<T>(key: string, value: T, ttlSeconds?: number): void {
  const ttl = (ttlSeconds ?? RUNTIME.cacheTtl) * 1000
  store.set(key, { value, expires: Date.now() + ttl })
  if (store.size > 5000) {
    const cutoff = Date.now()
    for (const [k, v] of store) {
      if (v.expires < cutoff) store.delete(k)
    }
  }
}

export async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key)
  if (hit !== undefined) return hit
  const value = await fn()
  cacheSet(key, value, ttl)
  return value
}

export function cacheStats() {
  return { size: store.size }
}

export function cacheClear() {
  store.clear()
}
