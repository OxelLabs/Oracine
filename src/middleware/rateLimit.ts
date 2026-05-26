import type { Context, MiddlewareHandler } from 'hono'
import { RUNTIME } from '../config/constants.js'

type Bucket = { count: number; reset: number }
const buckets = new Map<string, Bucket>()

export function rateLimit(): MiddlewareHandler {
  return async (c: Context, next) => {
    const ip =
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
    if (buckets.size > 10000) buckets.clear()
    await next()
  }
}
