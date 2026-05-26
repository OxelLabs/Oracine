import type { MiddlewareHandler } from 'hono'

export function timing(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now()
    await next()
    const ms = Date.now() - start
    c.res.headers.set('X-Response-Time', `${ms}ms`)
    c.res.headers.set('X-Powered-By', 'Oracine/Oracron')
  }
}
