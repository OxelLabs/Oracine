import { Hono } from 'hono'
import { metaProviders, movieProviders } from '../providers/registry.js'
import { ok, fail, normalizeStream, publicBaseFromRequest } from '../utils/response.js'
import { withTimeout, tryAllSources } from '../utils/fallback.js'
import { cached } from '../utils/cache.js'

const router = new Hono()

router.get('/tmdb/search', async (c) => {
  const q = c.req.query('q')?.trim()
  const page = parseInt(c.req.query('page') ?? '1', 10)
  if (!q) return c.json(fail('q is required'), 400)
  try {
    const data = await withTimeout((metaProviders.tmdb as any).search(q, page), 20000, 'tmdb')
    return c.json(ok(data, { source: 'tmdb' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'tmdb search failed', 502), 502)
  }
})

router.get('/tmdb/info', async (c) => {
  const id = c.req.query('id')
  const type = c.req.query('type') ?? 'movie'
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const data = await cached(`tmdb:info:${type}:${id}`, 600, () =>
      withTimeout((metaProviders.tmdb as any).fetchMediaInfo(id, type), 25000, 'tmdb'),
    )
    return c.json(ok(data, { source: 'tmdb' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'tmdb info failed', 502), 502)
  }
})

router.get('/tmdb/trending', async (c) => {
  const type = c.req.query('type') ?? 'all'
  const period = (c.req.query('period') ?? 'week') as 'day' | 'week'
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`tmdb:trending:${type}:${period}:${page}`, 600, () =>
      withTimeout((metaProviders.tmdb as any).fetchTrending(type, period, page), 20000, 'tmdb'),
    )
    return c.json(ok(data, { source: 'tmdb' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'tmdb trending failed', 502), 502)
  }
})

router.get('/tmdb/stream', async (c) => {
  const id = c.req.query('id')
  const quality = c.req.query('quality') ?? undefined
  const base = publicBaseFromRequest(c.req.raw)
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const result = await cached(`tmdb:stream:${id}:${quality ?? 'any'}`, 120, () =>
      tryAllSources([
        {
          name: 'flixhq',
          run: () => {
            const p = new (metaProviders.tmdb.constructor as any)(
              (metaProviders.tmdb as any).apiKey,
              movieProviders.flixhq,
            )
            return withTimeout(p.fetchEpisodeSources(id), 12000, 'flixhq')
          },
        },
        {
          name: 'goku',
          run: () => {
            const p = new (metaProviders.tmdb.constructor as any)(
              (metaProviders.tmdb as any).apiKey,
              movieProviders.goku,
            )
            return withTimeout(p.fetchEpisodeSources(id), 12000, 'goku')
          },
        },
        {
          name: 'sflix',
          run: () => {
            const p = new (metaProviders.tmdb.constructor as any)(
              (metaProviders.tmdb as any).apiKey,
              movieProviders.sflix,
            )
            return withTimeout(p.fetchEpisodeSources(id), 12000, 'sflix')
          },
        },
        {
          name: 'himovies',
          run: () => {
            const p = new (metaProviders.tmdb.constructor as any)(
              (metaProviders.tmdb as any).apiKey,
              movieProviders.himovies,
            )
            return withTimeout(p.fetchEpisodeSources(id), 12000, 'himovies')
          },
        },
      ]),
    )
    return c.json(ok(normalizeStream(result.data, quality, base), { source: result.source }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'tmdb stream failed', 502), 502)
  }
})

router.get('/tmdb/download', async (c) => {
  const id = c.req.query('id')
  const quality = c.req.query('quality') ?? '720p'
  const base = publicBaseFromRequest(c.req.raw)
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const data = await withTimeout((metaProviders.tmdb as any).fetchEpisodeSources(id), 30000, 'tmdb')
    const stream = normalizeStream(data, quality, base)
    return c.json(ok({ url: stream.download, play: stream.play, headers: stream.headers, quality }, { source: 'tmdb' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'tmdb download failed', 502), 502)
  }
})

router.get('/anilist/search', async (c) => {
  const q = c.req.query('q')?.trim()
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const perPage = parseInt(c.req.query('perPage') ?? '20', 10)
  if (!q) return c.json(fail('q is required'), 400)
  try {
    const data = await withTimeout(
      (metaProviders.anilist as any).search(q, page, perPage),
      20000,
      'anilist',
    )
    return c.json(ok(data, { source: 'anilist' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist search failed', 502), 502)
  }
})

router.get('/anilist/advanced-search', async (c) => {
  const q = c.req.query('q') ?? undefined
  const type = c.req.query('type') ?? 'ANIME'
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const perPage = parseInt(c.req.query('perPage') ?? '20', 10)
  const format = c.req.query('format') ?? undefined
  const sortRaw = c.req.query('sort')
  const sort = sortRaw ? sortRaw.split(',') : undefined
  const genresRaw = c.req.query('genres')
  const genres = genresRaw ? genresRaw.split(',') : undefined
  const year = c.req.query('year') ? parseInt(c.req.query('year')!, 10) : undefined
  const status = c.req.query('status') ?? undefined
  const season = c.req.query('season') ?? undefined
  try {
    const data = await withTimeout(
      (metaProviders.anilist as any).advancedSearch(
        q, type, page, perPage, format, sort, genres, undefined, year, status, season,
      ),
      25000,
      'anilist',
    )
    return c.json(ok(data, { source: 'anilist' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist advanced failed', 502), 502)
  }
})

router.get('/anilist/info', async (c) => {
  const id = c.req.query('id')
  const dub = c.req.query('dub') === 'true'
  const fetchFiller = c.req.query('fetchFiller') === 'true'
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const data = await cached(`anilist:info:${id}:${dub}:${fetchFiller}`, 600, () =>
      withTimeout(
        (metaProviders.anilist as any).fetchAnimeInfo(id, dub, fetchFiller),
        30000,
        'anilist',
      ),
    )
    return c.json(ok(data, { source: 'anilist' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist info failed', 502), 502)
  }
})

router.get('/anilist/info-by-id', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const data = await cached(`anilist:base:${id}`, 600, () =>
      withTimeout((metaProviders.anilist as any).fetchAnilistInfoById(id), 25000, 'anilist'),
    )
    return c.json(ok(data, { source: 'anilist' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist info-by-id failed', 502), 502)
  }
})

router.get('/anilist/episodes', async (c) => {
  const id = c.req.query('id')
  const dub = c.req.query('dub') === 'true'
  const fetchFiller = c.req.query('fetchFiller') === 'true'
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const data = await withTimeout(
      (metaProviders.anilist as any).fetchEpisodesListById(id, dub, fetchFiller),
      30000,
      'anilist',
    )
    return c.json(ok(data, { source: 'anilist' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist episodes failed', 502), 502)
  }
})

router.get('/anilist/trending', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const perPage = parseInt(c.req.query('perPage') ?? '20', 10)
  try {
    const data = await cached(`anilist:trending:${page}:${perPage}`, 600, () =>
      withTimeout((metaProviders.anilist as any).fetchTrendingAnime(page, perPage), 20000, 'anilist'),
    )
    return c.json(ok(data, { source: 'anilist' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist trending failed', 502), 502)
  }
})

router.get('/anilist/popular', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const perPage = parseInt(c.req.query('perPage') ?? '20', 10)
  try {
    const data = await cached(`anilist:popular:${page}:${perPage}`, 600, () =>
      withTimeout((metaProviders.anilist as any).fetchPopularAnime(page, perPage), 20000, 'anilist'),
    )
    return c.json(ok(data, { source: 'anilist' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist popular failed', 502), 502)
  }
})

router.get('/anilist/recent', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const perPage = parseInt(c.req.query('perPage') ?? '20', 10)
  const provider = (c.req.query('provider') ?? 'Hianime') as 'gogoanime' | 'Hianime'
  try {
    const data = await cached(`anilist:recent:${provider}:${page}:${perPage}`, 300, () =>
      withTimeout(
        (metaProviders.anilist as any).fetchRecentEpisodes(provider, page, perPage),
        20000,
        'anilist',
      ),
    )
    return c.json(ok(data, { source: 'anilist' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist recent failed', 502), 502)
  }
})

router.get('/anilist/schedule', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const perPage = parseInt(c.req.query('perPage') ?? '20', 10)
  const weekStart = c.req.query('weekStart') ? parseInt(c.req.query('weekStart')!, 10) : undefined
  const weekEnd = c.req.query('weekEnd') ? parseInt(c.req.query('weekEnd')!, 10) : undefined
  const notYetAired = c.req.query('notYetAired') === 'true'
  try {
    const data = await withTimeout(
      (metaProviders.anilist as any).fetchAiringSchedule(page, perPage, weekStart, weekEnd, notYetAired),
      20000,
      'anilist',
    )
    return c.json(ok(data, { source: 'anilist' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist schedule failed', 502), 502)
  }
})

router.get('/anilist/genre', async (c) => {
  const genres = (c.req.query('genres') ?? '').split(',').map(g => g.trim()).filter(Boolean)
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const perPage = parseInt(c.req.query('perPage') ?? '20', 10)
  if (genres.length === 0) return c.json(fail('genres is required'), 400)
  try {
    const data = await withTimeout(
      (metaProviders.anilist as any).fetchAnimeGenres(genres, page, perPage),
      20000,
      'anilist',
    )
    return c.json(ok(data, { source: 'anilist' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist genre failed', 502), 502)
  }
})

router.get('/anilist/random', async (c) => {
  try {
    const data = await withTimeout((metaProviders.anilist as any).fetchRandomAnime(), 25000, 'anilist')
    return c.json(ok(data, { source: 'anilist' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist random failed', 502), 502)
  }
})

router.get('/anilist/character', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const data = await withTimeout(
      (metaProviders.anilist as any).fetchCharacterInfoById(id),
      20000,
      'anilist',
    )
    return c.json(ok(data, { source: 'anilist' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist character failed', 502), 502)
  }
})

router.get('/anilist/staff', async (c) => {
  const id = c.req.query('id') ? parseInt(c.req.query('id')!, 10) : 0
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const data = await withTimeout(
      (metaProviders.anilist as any).fetchStaffById(id),
      20000,
      'anilist',
    )
    return c.json(ok(data, { source: 'anilist' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist staff failed', 502), 502)
  }
})

router.get('/anilist-manga/search', async (c) => {
  const q = c.req.query('q')?.trim()
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const perPage = parseInt(c.req.query('perPage') ?? '20', 10)
  if (!q) return c.json(fail('q is required'), 400)
  try {
    const data = await withTimeout(
      (metaProviders.anilistManga as any).search(q, page, perPage),
      20000,
      'anilist-manga',
    )
    return c.json(ok(data, { source: 'anilist-manga' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist manga search failed', 502), 502)
  }
})

router.get('/anilist-manga/info', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const data = await withTimeout(
      (metaProviders.anilistManga as any).fetchMangaInfo(id),
      25000,
      'anilist-manga',
    )
    return c.json(ok(data, { source: 'anilist-manga' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'anilist manga info failed', 502), 502)
  }
})

router.get('/mal/search', async (c) => {
  const q = c.req.query('q')?.trim()
  const page = parseInt(c.req.query('page') ?? '1', 10)
  if (!q) return c.json(fail('q is required'), 400)
  try {
    const data = await withTimeout((metaProviders.mal as any).search(q, page), 20000, 'mal')
    return c.json(ok(data, { source: 'mal' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'mal search failed', 502), 502)
  }
})

router.get('/mal/info', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const data = await cached(`mal:info:${id}`, 600, () =>
      withTimeout((metaProviders.mal as any).fetchMalInfoById(id), 25000, 'mal'),
    )
    return c.json(ok(data, { source: 'mal' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'mal info failed', 502), 502)
  }
})

export default router
