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
  const match = sources.filter((s) => {
    const sq = String(s?.quality ?? '').toLowerCase()
    return sq.includes(q) || sq === q
  })
  return match.length ? match : sources
}

export function pickPlayable(sources: any[]) {
  if (!Array.isArray(sources)) return null
  const playable = sources.find((s) => s?.url && (/\.m3u8/i.test(s.url) || /\.mp4/i.test(s.url)))
  return playable ?? sources[0] ?? null
}

function encodeUrl(u: string): string {
  return Buffer.from(u, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function proxify(url: string | undefined, base: string | undefined, headers: Record<string, string> = {}) {
  if (!url || !base) return url
  const isHls = /\.m3u8(\?|$)/i.test(url)
  const path = isHls ? 'hls' : 'segment'
  const qs = new URLSearchParams({ u: encodeUrl(url) })
  const ref = headers['Referer'] ?? headers['referer']
  const org = headers['Origin'] ?? headers['origin']
  if (ref) qs.set('referer', ref)
  if (org) qs.set('origin', org)
  return `${base}/proxy/${path}?${qs.toString()}`
}

export function normalizeStream(payload: any, quality?: string, base?: string) {
  const headers = payload?.headers ?? {}
  const filtered = filterQuality(payload?.sources ?? [], quality)
  const proxied = filtered.map((s: any) => ({
    ...s,
    proxiedUrl: proxify(s?.url, base, headers),
  }))
  const playable = pickPlayable(proxied)
  return {
    headers,
    subtitles: payload?.subtitles ?? [],
    sources: proxied,
    playable,
    download: playable?.url ?? null,
    play: playable?.proxiedUrl ?? playable?.url ?? null,
  }
}

export function publicBaseFromRequest(req: Request): string {
  const url = new URL(req.url)
  const fwdProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const fwdHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const proto = fwdProto || url.protocol.replace(':', '')
  const host = fwdHost || url.host
  return `${proto}://${host}`
}
