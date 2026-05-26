import { Hono } from 'hono'
import { APP_META, RUNTIME } from '../config/constants.js'

const router = new Hono()

const HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host',
  'content-length', 'content-encoding',
])

const DEFAULT_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

function decodeUrl(input: string): string | null {
  try {
    if (/^https?:\/\//i.test(input)) return input
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const decoded = Buffer.from(b64 + pad, 'base64').toString('utf-8')
    if (/^https?:\/\//i.test(decoded)) return decoded
    return null
  } catch {
    return null
  }
}

function encodeUrl(u: string): string {
  return Buffer.from(u, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function publicBase(req: Request): string {
  const url = new URL(req.url)
  const fwdProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const fwdHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const proto = fwdProto || url.protocol.replace(':', '')
  const host = fwdHost || url.host
  return `${proto}://${host}`
}

function buildHeaders(c: any, target: string, extra: Record<string, string | undefined>) {
  const url = new URL(target)
  const headers: Record<string, string> = {
    'User-Agent': c.req.header('user-agent') ?? DEFAULT_UA,
    'Accept': '*/*',
    'Accept-Language': c.req.header('accept-language') ?? 'en-US,en;q=0.9',
    'Origin': extra.origin ?? `${url.protocol}//${url.host}`,
    'Referer': extra.referer ?? `${url.protocol}//${url.host}/`,
  }
  const range = c.req.header('range')
  if (range) headers['Range'] = range
  for (const [k, v] of Object.entries(extra)) {
    if (k === 'origin' || k === 'referer') continue
    if (v) headers[k] = v
  }
  return headers
}

function rewriteManifest(body: string, targetUrl: string, base: string, referer?: string, origin?: string): string {
  const u = new URL(targetUrl)
  const baseHref = targetUrl.replace(/[^/]*$/, '')
  const refQ = referer ? `&referer=${encodeURIComponent(referer)}` : ''
  const orgQ = origin ? `&origin=${encodeURIComponent(origin)}` : ''
  const wrap = (raw: string) => {
    if (!raw) return raw
    if (raw.startsWith('#')) return raw
    let abs = raw
    if (/^https?:\/\//i.test(raw)) abs = raw
    else if (raw.startsWith('//')) abs = `${u.protocol}${raw}`
    else if (raw.startsWith('/')) abs = `${u.protocol}//${u.host}${raw}`
    else abs = baseHref + raw
    return `${base}/proxy/segment?u=${encodeUrl(abs)}${refQ}${orgQ}`
  }
  return body
    .split(/\r?\n/)
    .map((line) => {
      if (!line || line.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_m, p1) => `URI="${wrap(p1)}"`)
      }
      return wrap(line.trim())
    })
    .join('\n')
}

router.get('/health', (c) => c.json({ status: 'success', proxy: 'ready', powered_by: APP_META.powered_by }))

router.get('/segment', async (c) => {
  const raw = c.req.query('u')
  if (!raw) return c.json({ status: 'error', message: 'u is required' }, 400)
  const target = decodeUrl(raw)
  if (!target) return c.json({ status: 'error', message: 'invalid url' }, 400)
  const referer = c.req.query('referer') ?? undefined
  const origin = c.req.query('origin') ?? undefined
  try {
    const headers = buildHeaders(c, target, { referer, origin })
    const ctl = new AbortController()
    const tm = setTimeout(() => ctl.abort(), RUNTIME.proxyTimeoutMs)
    const upstream = await fetch(target, { method: 'GET', headers, redirect: 'follow', signal: ctl.signal })
    clearTimeout(tm)
    const out = new Headers()
    upstream.headers.forEach((v, k) => {
      if (!HOP_HEADERS.has(k.toLowerCase())) out.set(k, v)
    })
    out.set('Access-Control-Allow-Origin', '*')
    out.set('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Accept-Ranges')
    out.set('Cache-Control', 'public, max-age=60')
    return new Response(upstream.body, { status: upstream.status, headers: out })
  } catch (err: any) {
    return c.json({ status: 'error', message: err?.message ?? 'proxy failed' }, 502)
  }
})

router.get('/hls', async (c) => {
  const raw = c.req.query('u')
  if (!raw) return c.json({ status: 'error', message: 'u is required' }, 400)
  const target = decodeUrl(raw)
  if (!target) return c.json({ status: 'error', message: 'invalid url' }, 400)
  const referer = c.req.query('referer') ?? undefined
  const origin = c.req.query('origin') ?? undefined
  try {
    const headers = buildHeaders(c, target, { referer, origin })
    const ctl = new AbortController()
    const tm = setTimeout(() => ctl.abort(), RUNTIME.proxyTimeoutMs)
    const upstream = await fetch(target, { method: 'GET', headers, redirect: 'follow', signal: ctl.signal })
    clearTimeout(tm)
    const body = await upstream.text()
    const base = publicBase(c.req.raw)
    const rewritten = rewriteManifest(body, target, base, referer, origin)
    const out = new Headers()
    out.set('Content-Type', 'application/vnd.apple.mpegurl')
    out.set('Access-Control-Allow-Origin', '*')
    out.set('Cache-Control', 'no-store')
    return new Response(rewritten, { status: upstream.status, headers: out })
  } catch (err: any) {
    return c.json({ status: 'error', message: err?.message ?? 'hls proxy failed' }, 502)
  }
})

router.get('/m3u8', (c) => {
  const raw = c.req.query('u')
  const referer = c.req.query('referer')
  const origin = c.req.query('origin')
  if (!raw) return c.json({ status: 'error', message: 'u is required' }, 400)
  const qs = new URLSearchParams({ u: raw })
  if (referer) qs.set('referer', referer)
  if (origin) qs.set('origin', origin)
  return c.redirect(`/proxy/hls?${qs.toString()}`, 302)
})

router.get('/sign', (c) => {
  const u = c.req.query('u')
  if (!u) return c.json({ status: 'error', message: 'u is required' }, 400)
  const referer = c.req.query('referer') ?? undefined
  const origin = c.req.query('origin') ?? undefined
  const base = publicBase(c.req.raw)
  const isHls = /\.m3u8(\?|$)/i.test(u)
  const path = isHls ? 'hls' : 'segment'
  const qs = new URLSearchParams({ u: encodeUrl(u) })
  if (referer) qs.set('referer', referer)
  if (origin) qs.set('origin', origin)
  return c.json({
    status: 'success',
    proxied: `${base}/proxy/${path}?${qs.toString()}`,
    type: isHls ? 'hls' : 'media',
    powered_by: APP_META.powered_by,
    built_by: APP_META.built_by,
    organization: APP_META.organization,
  })
})

export { encodeUrl as encodeProxyUrl, publicBase }
export default router
