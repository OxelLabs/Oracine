import type { Context, MiddlewareHandler } from 'hono'
import { RUNTIME } from '../config/constants.js'

type Bucket = { count: number;reset: number }
const buckets = new Map < string,
  Bucket > ()

const SKIP_PATHS = new Set(['/', '/health', '/favicon.ico', '/robots.txt'])

export function rateLimit(): MiddlewareHandler {
  return async (c: Context, next) => {
    const method = c.req.method
    if (method === 'OPTIONS' || method === 'HEAD') return next()
    const path = new URL(c.req.url).pathname
    if (SKIP_PATHS.has(path) || path.startsWith('/health')) return next()
    
    const ip =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'anon'
    const now = Date.now()
    const b = buckets.get(ip)
    if (!b || now > b.reset) {
      buckets.set(ip, { count: 1, reset: now + RUNTIME.rateWindowMs })
    } else {
      b.count += 1
      if (b.count > RUNTIME.rateMax) {
        c.header('Retry-After', String(Math.ceil((b.reset - now) / 1000)))
        return c.json(
          {
            status: 'error',
            code: 429,
            message: 'rate limit exceeded',
            retry_after_seconds: Math.ceil((b.reset - now) / 1000),
          },
          429,
        )
      }
    }
    if (buckets.size > 10000) {
      for (const [key, bucket] of buckets) {
        if (now > bucket.reset) buckets.delete(key)
      }
    }
    await next()
  }
}