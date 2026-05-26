import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { APP_META, RUNTIME } from './config/constants.js'
import { rateLimit } from './middleware/rateLimit.js'
import { timing } from './middleware/timing.js'
import root from './routes/root.js'
import anime from './routes/anime.js'
import manga from './routes/manga.js'
import movies from './routes/movies.js'
import books from './routes/books.js'
import meta from './routes/meta.js'
import news from './routes/news.js'
import health from './routes/health.js'
import proxy from './routes/proxy.js'

process.on('unhandledRejection', (reason) => {
  console.error('[Oracine] unhandledRejection:', (reason as any)?.message ?? reason)
})
process.on('uncaughtException', (err) => {
  console.error('[Oracine] uncaughtException:', err?.message ?? err)
})

const app = new Hono()

app.use('*', timing())
app.use('*', logger())
app.use('*', prettyJSON())

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*'
    if (RUNTIME.corsOrigin === '*' || !RUNTIME.corsOrigin) return origin
    const allow = RUNTIME.corsOrigin.split(',').map(s => s.trim()).filter(Boolean)
    return allow.includes(origin) ? origin : allow[0] ?? '*'
  },
  allowMethods: ['GET', 'HEAD', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Range', 'Accept', 'Accept-Encoding', 'User-Agent', 'X-Requested-With'],
  exposeHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'X-Response-Time'],
  maxAge: 86400,
  credentials: false,
}))

app.use('*', async (c, next) => {
  await next()
  c.res.headers.set('X-Frame-Options', 'ALLOWALL')
  c.res.headers.set('Permissions-Policy', 'fullscreen=*, autoplay=*, encrypted-media=*')
  c.res.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none')
  c.res.headers.set('Cross-Origin-Opener-Policy', 'unsafe-none')
  c.res.headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
  c.res.headers.set('Referrer-Policy', 'no-referrer')
  c.res.headers.set('Cache-Control', c.res.headers.get('Cache-Control') ?? 'public, max-age=30')
  c.res.headers.set('Connection', 'keep-alive')
})

app.use('*', async (c, next) => {
  const limit = RUNTIME.requestTimeoutMs
  let timer: ReturnType<typeof setTimeout> | null = null
  const guard = new Promise<Response>((resolve) => {
    timer = setTimeout(() => {
      resolve(
        c.json(
          {
            status: 'error',
            code: 504,
            message: `request timed out after ${limit}ms`,
            powered_by: APP_META.powered_by,
            built_by: APP_META.built_by,
            organization: APP_META.organization,
          },
          504,
        ),
      )
    }, limit)
  })
  try {
    const result = await Promise.race([next().then(() => undefined), guard])
    if (result instanceof Response) {
      c.res = result
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
})

app.use('*', rateLimit())

app.route('/', root)
app.route('/anime', anime)
app.route('/manga', manga)
app.route('/movies', movies)
app.route('/books', books)
app.route('/meta', meta)
app.route('/news', news)
app.route('/health', health)
app.route('/proxy', proxy)

app.notFound((c) =>
  c.json(
    {
      status: 'error',
      code: 404,
      message: 'endpoint not found',
      hint: 'visit / for the full endpoint catalog',
      powered_by: APP_META.powered_by,
      built_by: APP_META.built_by,
      organization: APP_META.organization,
    },
    404,
  ),
)

app.onError((err, c) => {
  console.error(`[Oracine] route error: ${err?.message ?? err}`)
  return c.json(
    {
      status: 'error',
      code: 500,
      message: err?.message ?? 'internal error',
      powered_by: APP_META.powered_by,
      built_by: APP_META.built_by,
      organization: APP_META.organization,
    },
    500,
  )
})

const server = serve({ fetch: app.fetch, port: RUNTIME.port, hostname: '0.0.0.0' }, () => {
  console.log(`[Oracine] ${APP_META.name} v${APP_META.version} by ${APP_META.built_by}/${APP_META.organization}`)
  console.log(`[Oracine] consumet@1.8.8 env=${RUNTIME.env} listening on :${RUNTIME.port}`)
}) as any

if (server && typeof server.keepAliveTimeout === 'number') {
  server.keepAliveTimeout = 75_000
  server.headersTimeout = 80_000
  server.requestTimeout = 0
}

const shutdown = (sig: string) => {
  console.log(`[Oracine] ${sig} received, shutting down`)
  try { server?.close?.(() => process.exit(0)) } catch { process.exit(0) }
  setTimeout(() => process.exit(0), 5000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
