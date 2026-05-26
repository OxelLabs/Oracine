import { Hono } from 'hono'
import { ANIME_KEYS, animeProviders, pickAnime } from '../providers/registry.js'
import { tryAllSources, withTimeout } from '../utils/fallback.js'
import { ok, fail, normalizeStream, publicBaseFromRequest } from '../utils/response.js'
import { cached } from '../utils/cache.js'

const router = new Hono()

const PRIMARY_ORDER: Array<keyof typeof animeProviders> = [
  'hianime', 'animepahe', 'animekai', 'kickassanime', 'animesaturn', 'animeunity', 'animesama',
]

router.get('/sources', (c) => c.json(ok({ sources: ANIME_KEYS })))

router.get('/search', async (c) => {
  const q = c.req.query('q')?.trim()
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const source = c.req.query('source')
  if (!q) return c.json(fail('query parameter q is required'), 400)
  try {
    if (source) {
      const provider = pickAnime(source)
      const data = await withTimeout(provider.search(q, page) as Promise<any>, 15000, source)
      return c.json(ok(data, { source: provider.name }))
    }
    const result = await tryAllSources(
      PRIMARY_ORDER.map(name => ({
        name,
        run: () => withTimeout(animeProviders[name].search(q, page) as Promise<any>, 15000, name),
      })),
    )
    return c.json(ok(result.data, { source: result.source, attempts: result.attempts }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'search failed', 502), 502)
  }
})

router.get('/info', async (c) => {
  const id = c.req.query('id')
  const source = c.req.query('source') ?? 'hianime'
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const provider = pickAnime(source)
    const data = await cached(`anime:info:${source}:${id}`, 600, () =>
      withTimeout(provider.fetchAnimeInfo(id) as Promise<any>, 25000, source),
    )
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'info failed', 502), 502)
  }
})

router.get('/stream', async (c) => {
  const episodeId = c.req.query('episodeId')
  const source = c.req.query('source')
  const quality = c.req.query('quality') ?? undefined
  const base = publicBaseFromRequest(c.req.raw)
  if (!episodeId) return c.json(fail('episodeId is required'), 400)
  try {
    if (source) {
      const provider = pickAnime(source)
      const data = await withTimeout(provider.fetchEpisodeSources(episodeId) as Promise<any>, 12000, source)
      return c.json(ok(normalizeStream(data, quality, base), { source: provider.name }))
    }
    const result = await cached(`anime:stream:${episodeId}:${quality ?? 'any'}`, 120, () =>
      tryAllSources(
        PRIMARY_ORDER.map(name => ({
          name,
          run: () => withTimeout(animeProviders[name].fetchEpisodeSources(episodeId) as Promise<any>, 12000, name),
        })),
      ),
    )
    return c.json(ok(normalizeStream(result.data, quality, base), { source: result.source }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'stream failed', 502), 502)
  }
})

router.get('/download', async (c) => {
  const episodeId = c.req.query('episodeId')
  const source = c.req.query('source') ?? 'hianime'
  const quality = c.req.query('quality') ?? '720p'
  const base = publicBaseFromRequest(c.req.raw)
  if (!episodeId) return c.json(fail('episodeId is required'), 400)
  try {
    const provider = pickAnime(source)
    const data = await withTimeout(provider.fetchEpisodeSources(episodeId) as Promise<any>, 12000, source)
    const stream = normalizeStream(data, quality, base)
    return c.json(ok({ url: stream.download, play: stream.play, headers: stream.headers, quality }, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'download failed', 502), 502)
  }
})

router.get('/servers', async (c) => {
  const episodeId = c.req.query('episodeId')
  const source = c.req.query('source') ?? 'hianime'
  if (!episodeId) return c.json(fail('episodeId is required'), 400)
  try {
    const provider = pickAnime(source) as any
    const data = await withTimeout(provider.fetchEpisodeServers(episodeId), 15000, source)
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'servers failed', 502), 502)
  }
})

router.get('/trending', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`anime:trending:${page}`, 600, () =>
      withTimeout((animeProviders.hianime as any).fetchTopAiring(page), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'trending failed', 502), 502)
  }
})

router.get('/popular', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`anime:popular:${page}`, 600, () =>
      withTimeout((animeProviders.hianime as any).fetchMostPopular(page), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'popular failed', 502), 502)
  }
})

router.get('/recent', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`anime:recent:${page}`, 300, () =>
      withTimeout((animeProviders.hianime as any).fetchRecentlyUpdated(page), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'recent failed', 502), 502)
  }
})

router.get('/recently-added', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`anime:added:${page}`, 600, () =>
      withTimeout((animeProviders.hianime as any).fetchRecentlyAdded(page), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'recently-added failed', 502), 502)
  }
})

router.get('/recently-completed', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`anime:completed:${page}`, 600, () =>
      withTimeout((animeProviders.hianime as any).fetchLatestCompleted(page), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'recently-completed failed', 502), 502)
  }
})

router.get('/upcoming', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`anime:upcoming:${page}`, 600, () =>
      withTimeout((animeProviders.hianime as any).fetchTopUpcoming(page), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'upcoming failed', 502), 502)
  }
})

router.get('/subbed', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`anime:subbed:${page}`, 600, () =>
      withTimeout((animeProviders.hianime as any).fetchSubbedAnime(page), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'subbed failed', 502), 502)
  }
})

router.get('/dubbed', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`anime:dubbed:${page}`, 600, () =>
      withTimeout((animeProviders.hianime as any).fetchDubbedAnime(page), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'dubbed failed', 502), 502)
  }
})

router.get('/movies', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`anime:movies:${page}`, 600, () =>
      withTimeout((animeProviders.hianime as any).fetchMovie(page), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'movies failed', 502), 502)
  }
})

router.get('/tv', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`anime:tv:${page}`, 600, () =>
      withTimeout((animeProviders.hianime as any).fetchTV(page), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'tv failed', 502), 502)
  }
})

router.get('/ova', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`anime:ova:${page}`, 600, () =>
      withTimeout((animeProviders.hianime as any).fetchOVA(page), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'ova failed', 502), 502)
  }
})

router.get('/ona', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`anime:ona:${page}`, 600, () =>
      withTimeout((animeProviders.hianime as any).fetchONA(page), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'ona failed', 502), 502)
  }
})

router.get('/specials', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`anime:special:${page}`, 600, () =>
      withTimeout((animeProviders.hianime as any).fetchSpecial(page), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'specials failed', 502), 502)
  }
})

router.get('/spotlight', async (c) => {
  try {
    const data = await cached('anime:spotlight', 600, () =>
      withTimeout((animeProviders.hianime as any).fetchSpotlight(), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'spotlight failed', 502), 502)
  }
})

router.get('/suggestions', async (c) => {
  const q = c.req.query('q')?.trim()
  if (!q) return c.json(fail('q is required'), 400)
  try {
    const data = await withTimeout(
      (animeProviders.hianime as any).fetchSearchSuggestions(q),
      15000,
      'hianime',
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'suggestions failed', 502), 502)
  }
})

router.get('/genres-list', async (c) => {
  try {
    const data = await cached('anime:genres-list', 3600, () =>
      withTimeout((animeProviders.hianime as any).fetchGenres(), 20000, 'hianime'),
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'genres-list failed', 502), 502)
  }
})

router.get('/studio', async (c) => {
  const studio = c.req.query('studio')
  const page = parseInt(c.req.query('page') ?? '1', 10)
  if (!studio) return c.json(fail('studio is required'), 400)
  try {
    const data = await withTimeout(
      (animeProviders.hianime as any).fetchStudio(studio, page),
      20000,
      'hianime',
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'studio failed', 502), 502)
  }
})

router.get('/advanced-search', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const type = c.req.query('type')
  const status = c.req.query('status')
  const rated = c.req.query('rated')
  const score = c.req.query('score') ? parseInt(c.req.query('score')!, 10) : undefined
  const season = c.req.query('season')
  const language = c.req.query('language')
  const sort = c.req.query('sort')
  const genres = c.req.query('genres')?.split(',').map(g => g.trim()).filter(Boolean)
  try {
    const data = await withTimeout(
      (animeProviders.hianime as any).fetchAdvancedSearch(
        page, type, status, rated, score, season, language, undefined, undefined, sort, genres,
      ),
      25000,
      'hianime',
    )
    return c.json(ok(data, { source: 'hianime' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'advanced-search failed', 502), 502)
  }
})

router.get('/pahe/recent', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await withTimeout(
      (animeProviders.animepahe as any).fetchRecentEpisodes(page),
      20000,
      'animepahe',
    )
    return c.json(ok(data, { source: 'animepahe' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'pahe recent failed', 502), 502)
  }
})

export default router
