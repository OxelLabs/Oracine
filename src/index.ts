import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { compress } from 'hono/compress'
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

const app = new Hono()

app.use('*', timing())
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', compress())
app.use('*', cors({
  origin: RUNTIME.corsOrigin,
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Range'],
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
  console.error(`[Oracine] ${err.message}`)
  return c.json(
    {
      status: 'error',
      code: 500,
      message: err.message ?? 'internal error',
      powered_by: APP_META.powered_by,
      built_by: APP_META.built_by,
      organization: APP_META.organization,
    },
    500,
  )
})

serve({ fetch: app.fetch, port: RUNTIME.port, hostname: '0.0.0.0' }, () => {
  console.log('')
  console.log('  ╔═══════════════════════════════════════════════╗')
  console.log(`  ║  ${APP_META.name}  v${APP_META.version}`.padEnd(50) + '║')
  console.log(`  ║  Built by ${APP_META.built_by} / ${APP_META.organization}`.padEnd(50) + '║')
  console.log(`  ║  consumet@1.8.8   env=${RUNTIME.env}`.padEnd(50) + '║')
  console.log('  ╚═══════════════════════════════════════════════╝')
  console.log(`  → http://localhost:${RUNTIME.port}`)
  console.log('')
})
