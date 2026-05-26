import { Hono } from 'hono'
import { MOVIE_KEYS, movieProviders, pickMovie } from '../providers/registry.js'
import { tryAllSources, raceSources, withTimeout } from '../utils/fallback.js'
import { ok, fail, normalizeStream, publicBaseFromRequest } from '../utils/response.js'
import { cached } from '../utils/cache.js'
import { RUNTIME } from '../config/constants.js'

const router = new Hono()

const WESTERN: Array<keyof typeof movieProviders> = ['flixhq', 'sflix', 'himovies', 'goku']
const ASIAN: Array<keyof typeof movieProviders> = ['dramacool', 'turkish']
const ALL: Array<keyof typeof movieProviders> = [...WESTERN, ...ASIAN]

const T_PROVIDER = RUNTIME.providerTimeoutMs
const T_INFO = Math.min(RUNTIME.providerTimeoutMs + 8000, 20000)
const T_STREAM = Math.min(RUNTIME.providerTimeoutMs + 3000, 12000)

router.get('/sources', (c) =>
  c.json(ok({ sources: MOVIE_KEYS, western: WESTERN, asian: ASIAN })),
)

router.get('/search', async (c) => {
  const q = c.req.query('q')?.trim()
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const source = c.req.query('source')
  const type = (c.req.query('type') ?? 'all') as 'all' | 'western' | 'asian'
  const mode = (c.req.query('mode') ?? 'race') as 'race' | 'sequential'
  if (!q) return c.json(fail('q is required'), 400)
  try {
    if (source) {
      const provider = pickMovie(source) as any
      const data = await withTimeout(provider.search(q, page), T_PROVIDER, source)
      return c.json(ok(data, { source: provider.name }))
    }
    const order = type === 'western' ? WESTERN : type === 'asian' ? ASIAN : ALL
    const list = order.map((name) => ({
      name,
      run: () => withTimeout((movieProviders[name] as any).search(q, page), T_PROVIDER, name),
    }))
    const result = mode === 'sequential' ? await tryAllSources(list) : await raceSources(list)
    return c.json(ok(result.data, { source: result.source, attempts: result.attempts }))
  } catch (err: any) {
    return c.json(fail(err?.message ?? 'search failed', 502), 502)
  }
})

router.get('/info', async (c) => {
  const id = c.req.query('id')
  const source = c.req.query('source') ?? 'flixhq'
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const provider = pickMovie(source) as any
    const data = await cached(`movie:info:${source}:${id}`, 600, () =>
      withTimeout(provider.fetchMediaInfo(id), T_INFO, source),
    )
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err?.message ?? 'info failed', 502), 502)
  }
})

router.get('/stream', async (c) => {
  const episodeId = c.req.query('episodeId')
  const mediaId = c.req.query('mediaId') ?? ''
  const source = c.req.query('source')
  const quality = c.req.query('quality') ?? undefined
  const base = publicBaseFromRequest(c.req.raw)
  if (!episodeId) return c.json(fail('episodeId is required'), 400)
  try {
    if (source) {
      const provider = pickMovie(source) as any
      if (typeof provider.fetchEpisodeSources !== 'function') {
        return c.json(fail(`provider ${source} does not support streaming`, 400), 400)
      }
      const data = await withTimeout(provider.fetchEpisodeSources(episodeId, mediaId), T_STREAM, source)
      return c.json(ok(normalizeStream(data, quality, base), { source: provider.name }))
    }
    const result = await cached(`movie:stream:${episodeId}:${quality ?? 'any'}`, 120, () =>
      raceSources(
        WESTERN.filter((name) => typeof (movieProviders[name] as any).fetchEpisodeSources === 'function').map((name) => ({
          name,
          run: () => withTimeout((movieProviders[name] as any).fetchEpisodeSources(episodeId, mediaId), T_STREAM, name),
        })),
      ),
    )
    return c.json(ok(normalizeStream(result.data, quality, base), { source: result.source, attempts: result.attempts }))
  } catch (err: any) {
    return c.json(fail(err?.message ?? 'stream failed', 502), 502)
  }
})

router.get('/download', async (c) => {
  const episodeId = c.req.query('episodeId')
  const mediaId = c.req.query('mediaId') ?? ''
  const source = c.req.query('source') ?? 'flixhq'
  const quality = c.req.query('quality') ?? '720p'
  const base = publicBaseFromRequest(c.req.raw)
  if (!episodeId) return c.json(fail('episodeId is required'), 400)
  try {
    const provider = pickMovie(source) as any
    if (typeof provider.fetchEpisodeSources !== 'function') {
      return c.json(fail(`provider ${source} does not support download`, 400), 400)
    }
    const data = await withTimeout(provider.fetchEpisodeSources(episodeId, mediaId), T_STREAM, source)
    const stream = normalizeStream(data, quality, base)
    return c.json(ok({ url: stream.download, play: stream.play, headers: stream.headers, quality }, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err?.message ?? 'download failed', 502), 502)
  }
})

router.get('/servers', async (c) => {
  const episodeId = c.req.query('episodeId')
  const mediaId = c.req.query('mediaId') ?? ''
  const source = c.req.query('source') ?? 'flixhq'
  if (!episodeId) return c.json(fail('episodeId is required'), 400)
  try {
    const provider = pickMovie(source) as any
    const data = await withTimeout(provider.fetchEpisodeServers(episodeId, mediaId), T_STREAM, source)
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err?.message ?? 'servers failed', 502), 502)
  }
})

router.get('/trending', async (c) => {
  const type = (c.req.query('type') ?? 'movie') as 'movie' | 'tv'
  try {
    const data = await cached(`movie:trending:${type}`, 600, () =>
      withTimeout(
        type === 'tv'
          ? (movieProviders.flixhq as any).fetchTrendingTvShows()
          : (movieProviders.flixhq as any).fetchTrendingMovies(),
        T_INFO,
        'flixhq',
      ),
    )
    return c.json(ok(data, { source: 'flixhq' }))
  } catch (err: any) {
    return c.json(fail(err?.message ?? 'trending failed', 502), 502)
  }
})

router.get('/recent', async (c) => {
  const type = (c.req.query('type') ?? 'movie') as 'movie' | 'tv'
  try {
    const data = await cached(`movie:recent:${type}`, 300, () =>
      withTimeout(
        type === 'tv'
          ? (movieProviders.flixhq as any).fetchRecentTvShows()
          : (movieProviders.flixhq as any).fetchRecentMovies(),
        T_INFO,
        'flixhq',
      ),
    )
    return c.json(ok(data, { source: 'flixhq' }))
  } catch (err: any) {
    return c.json(fail(err?.message ?? 'recent failed', 502), 502)
  }
})

router.get('/genre', async (c) => {
  const genre = c.req.query('genre')
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const source = c.req.query('source') ?? 'flixhq'
  if (!genre) return c.json(fail('genre is required'), 400)
  try {
    const provider = pickMovie(source) as any
    const data = await withTimeout(provider.fetchByGenre(genre, page), T_INFO, source)
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err?.message ?? 'genre failed', 502), 502)
  }
})

router.get('/country', async (c) => {
  const country = c.req.query('country')
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const source = c.req.query('source') ?? 'flixhq'
  if (!country) return c.json(fail('country is required'), 400)
  try {
    const provider = pickMovie(source) as any
    const data = await withTimeout(provider.fetchByCountry(country, page), T_INFO, source)
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err?.message ?? 'country failed', 502), 502)
  }
})

router.get('/spotlight', async (c) => {
  try {
    const data = await cached('movie:spotlight', 600, () =>
      withTimeout((movieProviders.flixhq as any).fetchSpotlight(), T_INFO, 'flixhq'),
    )
    return c.json(ok(data, { source: 'flixhq' }))
  } catch (err: any) {
    return c.json(fail(err?.message ?? 'spotlight failed', 502), 502)
  }
})

router.get('/asian/recent', async (c) => {
  try {
    const data = await cached('movie:asian:recent', 600, () =>
      withTimeout((movieProviders.dramacool as any).search('a', 1), T_INFO, 'dramacool'),
    )
    return c.json(ok(data, { source: 'dramacool' }))
  } catch (err: any) {
    return c.json(fail(err?.message ?? 'asian recent failed', 502), 502)
  }
})

router.get('/episode/sources', async (c) => {
  const episodeId = c.req.query('episodeId')
  const mediaId = c.req.query('mediaId') ?? ''
  const server = c.req.query('server') ?? undefined
  const source = c.req.query('source') ?? 'flixhq'
  const quality = c.req.query('quality') ?? undefined
  const base = publicBaseFromRequest(c.req.raw)
  if (!episodeId) return c.json(fail('episodeId is required'), 400)
  try {
    const provider = pickMovie(source) as any
    const data = await withTimeout(provider.fetchEpisodeSources(episodeId, mediaId, server), T_STREAM, source)
    return c.json(ok(normalizeStream(data, quality, base), { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err?.message ?? 'episode sources failed', 502), 502)
  }
})

router.get('/random', async (c) => {
  const type = (c.req.query('type') ?? 'movie') as 'movie' | 'tv'
  try {
    const list = await cached(`movie:random-pool:${type}`, 600, () =>
      withTimeout(
        type === 'tv'
          ? (movieProviders.flixhq as any).fetchTrendingTvShows()
          : (movieProviders.flixhq as any).fetchTrendingMovies(),
        T_INFO,
        'flixhq',
      ),
    )
    const arr: any[] = Array.isArray(list) ? list : (list as any)?.results ?? []
    const pick = arr[Math.floor(Math.random() * Math.max(arr.length, 1))]
    return c.json(ok(pick ?? null, { source: 'flixhq' }))
  } catch (err: any) {
    return c.json(fail(err?.message ?? 'random failed', 502), 502)
  }
})

export default router
