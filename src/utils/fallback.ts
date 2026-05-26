export type Attempt = { source: string; ok: boolean; error?: string; ms: number }
export type FallbackResult<T> = { data: T; source: string; attempts: Attempt[] }

function isEmpty(data: any): boolean {
  if (data === null || data === undefined) return true
  if (Array.isArray(data)) return data.length === 0
  if (Array.isArray((data as any).results)) return (data as any).results.length === 0
  return false
}

export async function tryAllSources(
  sources: Array<{ name: string; run: () => Promise<any> }>,
): Promise<FallbackResult<any>> {
  const attempts: Attempt[] = []
  for (const s of sources) {
    const start = Date.now()
    try {
      const data = await s.run()
      if (isEmpty(data)) throw new Error('empty result')
      attempts.push({ source: s.name, ok: true, ms: Date.now() - start })
      return { data, source: s.name, attempts }
    } catch (err: any) {
      attempts.push({
        source: s.name,
        ok: false,
        error: err?.message ?? String(err),
        ms: Date.now() - start,
      })
    }
  }
  throw new Error(`all sources failed: ${attempts.map((a) => `${a.source}(${a.error})`).join(', ')}`)
}

export async function raceSources(
  sources: Array<{ name: string; run: () => Promise<any> }>,
): Promise<FallbackResult<any>> {
  if (sources.length === 0) throw new Error('no sources provided')
  const attempts: Attempt[] = []
  return new Promise<FallbackResult<any>>((resolve, reject) => {
    let remaining = sources.length
    let settled = false
    for (const s of sources) {
      const start = Date.now()
      Promise.resolve()
        .then(() => s.run())
        .then((data) => {
          const ms = Date.now() - start
          if (isEmpty(data)) throw new Error('empty result')
          if (settled) return
          settled = true
          attempts.push({ source: s.name, ok: true, ms })
          resolve({ data, source: s.name, attempts: [...attempts] })
        })
        .catch((err) => {
          attempts.push({ source: s.name, ok: false, ms: Date.now() - start, error: err?.message ?? String(err) })
        })
        .finally(() => {
          remaining -= 1
          if (remaining === 0 && !settled) {
            settled = true
            reject(new Error(`all sources failed (race): ${attempts.map((a) => `${a.source}(${a.error})`).join(', ')}`))
          }
        })
    }
  })
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'op'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}
