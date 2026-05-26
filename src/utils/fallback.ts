export type Attempt = { source: string; ok: boolean; error?: string; ms: number }

export type FallbackResult<T> = { data: T; source: string; attempts: Attempt[] }

export async function tryAllSources(
  sources: Array<{ name: string; run: () => Promise<any> }>,
): Promise<FallbackResult<any>> {
  const attempts: Attempt[] = []
  for (const s of sources) {
    const start = Date.now()
    try {
      const data = await s.run()
      if (data === null || data === undefined) throw new Error('empty result')
      if (Array.isArray((data as any).results) && (data as any).results.length === 0) {
        throw new Error('no results')
      }
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
  throw new Error(`all sources failed: ${attempts.map(a => `${a.source}(${a.error})`).join(', ')}`)
}

export async function raceSources(
  sources: Array<{ name: string; run: () => Promise<any> }>,
): Promise<FallbackResult<any>> {
  const promises = sources.map(
    s => new Promise<FallbackResult<any>>((resolve, reject) => {
      const start = Date.now()
      s.run()
        .then(data => {
          if (data === null || data === undefined) return reject(new Error(`${s.name}: empty`))
          resolve({ data, source: s.name, attempts: [{ source: s.name, ok: true, ms: Date.now() - start }] })
        })
        .catch(err => reject(new Error(`${s.name}: ${err?.message ?? err}`)))
    }),
  )
  return Promise.any(promises).catch(err => {
    throw new Error(`all sources failed (race): ${err?.message ?? err}`)
  })
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'op'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ])
}
