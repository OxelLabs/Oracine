// ─── Timeout ───────────────────────────────────────────────────────────────
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 10000)

export async function withTimeout<T>(promise: Promise<T>, ms: number = TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Source timed out')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!))
}

// ─── Parallel race - first success wins, silent fallback ───────────────────
export async function tryAllSources<T>(
  sources: Array<{ name: string; fn: () => Promise<T> }>
): Promise<{ data: T; source: string }> {
  const errors: Array<{ source: string; error: string }> = []

  // Try sources in parallel batches of 3 for speed, fallback sequentially
  const batchSize = 3
  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(async (s) => {
        const data = await withTimeout(s.fn())
        // Reject if data is null/undefined/empty
        if (!data || (Array.isArray(data) && data.length === 0)) {
          throw new Error('Empty response')
        }
        if ((data as any)?.results?.length === 0 && (data as any)?.hasNextPage === false) {
          throw new Error('No results')
        }
        return { data, source: s.name }
      })
    )
    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      if (r.status === 'fulfilled') return r.value
      errors.push({ source: batch[j].name, error: (r.reason as Error).message ?? 'Unknown' })
    }
  }

  throw { allFailed: true, errors }
}

// ─── Response shapes ────────────────────────────────────────────────────────
const META = {
  powered_by: 'Oracine',
  built_by: 'Jaden Afrix',
  organization: 'Oracron',
}

export function successResponse(data: any, source: string, extra: Record<string, any> = {}) {
  return { status: 'success', ...META, source, ...extra, data }
}

export function errorResponse(message: string, code = 500, extra: Record<string, any> = {}) {
  return { status: 'error', ...META, code, message, ...extra }
}

export function unavailableResponse(errors: Array<{ source: string; error: string }>) {
  return {
    status: 'unavailable',
    ...META,
    message: 'All sources failed for this request',
    attempted: errors.length,
    source_errors: errors,
  }
}

// ─── Quality selector ───────────────────────────────────────────────────────
export function filterByQuality(sources: any[], quality?: string): any[] {
  if (!quality || !sources?.length) return sources ?? []
  const q = quality.toLowerCase().replace('p', '')
  const exact = sources.filter((s: any) => (s.quality ?? '').toLowerCase().replace('p', '') === q)
  if (exact.length) return exact
  // Closest higher quality, fallback to all
  const sorted = [...sources].sort((a, b) => {
    const aq = parseInt(a.quality ?? '0')
    const bq = parseInt(b.quality ?? '0')
    return aq - bq
  })
  const higher = sorted.filter((s: any) => parseInt(s.quality ?? '0') >= parseInt(q))
  return higher.length ? [higher[0]] : sources
}

// ─── Safe page parse ────────────────────────────────────────────────────────
export function safePage(raw: string | undefined): number {
  const n = parseInt(raw ?? '1')
  return isNaN(n) || n < 1 ? 1 : n
}

export function safePerPage(raw: string | undefined, max = 50): number {
  const n = parseInt(raw ?? '20')
  return isNaN(n) || n < 1 ? 20 : Math.min(n, max)
}
