import { Hono } from 'hono'
import { MOVIE_KEYS, movieProviders, pickMovie } from '../providers/registry.js'
import { tryAllSources, withTimeout } from '../utils/fallback.js'
import { ok, fail, normalizeStream } from '../utils/response.js'
import { cached } from '../utils/cache.js'

const router = new Hono()

const WESTERN: Array<keyof typeof movieProviders> = ['flixhq', 'sflix', 'himovies', 'goku']
const ASIAN: Array<keyof typeof movieProviders> = ['dramacool', 'turkish']
const ALL: Array<keyof typeof movieProviders> = [...WESTERN, ...ASIAN]

router.get('/sources', (c) => c.json(ok({ sources: MOVIE_KEYS, western: WESTERN, asian: ASIAN })))

router.get('/search', async (c) => {
  const q = c.req.query('q')?.trim()
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const source = c.req.query('source')
  const type = (c.req.query('type') ?? 'all') as 'all' | 'western' | 'asian'
  if (!q) return c.json(fail('q is required'), 400)
  try {
    if (source) {
      const provider = pickMovie(source) as any
      const data = await withTimeout(provider.search(q, page), 20000, source)
      return c.json(ok(data, { source: provider.name }))
    }
    const order = type === 'western' ? WESTERN : type === 'asian' ? ASIAN : ALL
    const result = await tryAllSources(
      order.map(name => ({
        name,
        run: () => withTimeout((movieProviders[name] as any).search(q, page), 15000, name),
      })),
    )
    return c.json(ok(result.data, { source: result.source, attempts: result.attempts }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'search failed', 502), 502)
  }
})

router.get('/info', async (c) => {
  const id = c.req.query('id')
  const source = c.req.query('source') ?? 'flixhq'
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const provider = pickMovie(source) as any
    const data = await cached(`movie:info:${source}:${id}`, 600, () =>
      withTimeout(provider.fetchMediaInfo(id), 25000, source),
    )
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'info failed', 502), 502)
  }
})

router.get('/stream', async (c) => {
  const episodeId = c.req.query('episodeId')
  const mediaId = c.req.query('mediaId') ?? ''
  const source = c.req.query('source') ?? 'flixhq'
  const quality = c.req.query('quality') ?? undefined
  if (!episodeId) return c.json(fail('episodeId is required'), 400)
  try {
    const provider = pickMovie(source) as any
    const data =
      typeof provider.fetchEpisodeSources === 'function'
        ? await withTimeout(provider.fetchEpisodeSources(episodeId, mediaId), 25000, source)
        : null
    return c.json(ok(normalizeStream(data, quality), { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'stream failed', 502), 502)
  }
})

router.get('/download', async (c) => {
  const episodeId = c.req.query('episodeId')
  const mediaId = c.req.query('mediaId') ?? ''
  const source = c.req.query('source') ?? 'flixhq'
  const quality = c.req.query('quality') ?? '720p'
  if (!episodeId) return c.json(fail('episodeId is required'), 400)
  try {
    const provider = pickMovie(source) as any
    const data = await withTimeout(provider.fetchEpisodeSources(episodeId, mediaId), 25000, source)
    const stream = normalizeStream(data, quality)
    return c.json(ok({ url: stream.download, headers: stream.headers, quality }, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'download failed', 502), 502)
  }
})

router.get('/servers', async (c) => {
  const episodeId = c.req.query('episodeId')
  const mediaId = c.req.query('mediaId') ?? ''
  const source = c.req.query('source') ?? 'flixhq'
  if (!episodeId) return c.json(fail('episodeId is required'), 400)
  try {
    const provider = pickMovie(source) as any
    const data = await withTimeout(provider.fetchEpisodeServers(episodeId, mediaId), 20000, source)
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'servers failed', 502), 502)
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
        20000,
        'flixhq',
      ),
    )
    return c.json(ok(data, { source: 'flixhq' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'trending failed', 502), 502)
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
        20000,
        'flixhq',
      ),
    )
    return c.json(ok(data, { source: 'flixhq' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'recent failed', 502), 502)
  }
})

router.get('/genre', async (c) => {
  const genre = c.req.query('genre')
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const source = c.req.query('source') ?? 'flixhq'
  if (!genre) return c.json(fail('genre is required'), 400)
  try {
    const provider = pickMovie(source) as any
    const data = await withTimeout(provider.fetchByGenre(genre, page), 20000, source)
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'genre failed', 502), 502)
  }
})

router.get('/country', async (c) => {
  const country = c.req.query('country')
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const source = c.req.query('source') ?? 'flixhq'
  if (!country) return c.json(fail('country is required'), 400)
  try {
    const provider = pickMovie(source) as any
    const data = await withTimeout(provider.fetchByCountry(country, page), 20000, source)
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'country failed', 502), 502)
  }
})

router.get('/spotlight', async (c) => {
  try {
    const data = await cached('movie:spotlight', 600, () =>
      withTimeout((movieProviders.flixhq as any).fetchSpotlight(), 20000, 'flixhq'),
    )
    return c.json(ok(data, { source: 'flixhq' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'spotlight failed', 502), 502)
  }
})

router.get('/asian/recent', async (c) => {
  try {
    const data = await cached('movie:asian:recent', 600, () =>
      withTimeout((movieProviders.dramacool as any).search('a', 1), 20000, 'dramacool'),
    )
    return c.json(ok(data, { source: 'dramacool' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'asian recent failed', 502), 502)
  }
})

export default router
