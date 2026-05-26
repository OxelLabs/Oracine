import { APP_META } from '../config/constants.js'

export function ok(data: any, meta?: Record<string, any>) {
  return {
    status: 'success',
    ...meta,
    data,
    powered_by: APP_META.powered_by,
    built_by: APP_META.built_by,
    organization: APP_META.organization,
  }
}

export function fail(message: string, code = 400, extras: Record<string, any> = {}) {
  return {
    status: 'error',
    code,
    message,
    ...extras,
    powered_by: APP_META.powered_by,
    built_by: APP_META.built_by,
    organization: APP_META.organization,
  }
}

export function filterQuality(sources: any[], quality?: string) {
  if (!quality || !Array.isArray(sources)) return sources
  const q = quality.toLowerCase()
  const match = sources.filter(s => {
    const sq = String(s?.quality ?? '').toLowerCase()
    return sq.includes(q) || sq === q
  })
  return match.length ? match : sources
}

export function pickPlayable(sources: any[]) {
  if (!Array.isArray(sources)) return null
  const playable = sources.find(s => s?.url && (s.url.endsWith('.m3u8') || s.url.endsWith('.mp4')))
  return playable ?? sources[0] ?? null
}

export function normalizeStream(payload: any, quality?: string) {
  const filtered = filterQuality(payload?.sources ?? [], quality)
  return {
    headers: payload?.headers ?? {},
    subtitles: payload?.subtitles ?? [],
    sources: filtered,
    playable: pickPlayable(filtered),
    download: pickPlayable(filtered)?.url ?? null,
  }
}
