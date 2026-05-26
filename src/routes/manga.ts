import { Hono } from 'hono'
import { MANGA_KEYS, mangaProviders, pickManga } from '../providers/registry.js'
import { tryAllSources, withTimeout } from '../utils/fallback.js'
import { ok, fail } from '../utils/response.js'
import { cached } from '../utils/cache.js'

const router = new Hono()

const PRIMARY_ORDER: Array<keyof typeof mangaProviders> = [
  'mangadex', 'comick', 'mangakakalot', 'mangahere', 'mangapill', 'mangareader', 'weebcentral', 'asurascans',
]

router.get('/sources', (c) => c.json(ok({ sources: MANGA_KEYS })))

router.get('/search', async (c) => {
  const q = c.req.query('q')?.trim()
  const page = parseInt(c.req.query('page') ?? '1', 10)
  const source = c.req.query('source')
  if (!q) return c.json(fail('q is required'), 400)
  try {
    if (source) {
      const provider = pickManga(source) as any
      const data = await withTimeout(provider.search(q, page), 20000, source)
      return c.json(ok(data, { source: provider.name }))
    }
    const result = await tryAllSources(
      PRIMARY_ORDER.map(name => ({
        name,
        run: () => withTimeout((mangaProviders[name] as any).search(q, page), 15000, name),
      })),
    )
    return c.json(ok(result.data, { source: result.source, attempts: result.attempts }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'search failed', 502), 502)
  }
})

router.get('/info', async (c) => {
  const id = c.req.query('id')
  const source = c.req.query('source') ?? 'mangadex'
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const provider = pickManga(source)
    const data = await cached(`manga:info:${source}:${id}`, 600, () =>
      withTimeout(provider.fetchMangaInfo(id) as Promise<any>, 25000, source),
    )
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'info failed', 502), 502)
  }
})

router.get('/read', async (c) => {
  const chapterId = c.req.query('chapterId')
  const source = c.req.query('source') ?? 'mangadex'
  if (!chapterId) return c.json(fail('chapterId is required'), 400)
  try {
    const provider = pickManga(source)
    const data = await withTimeout(
      provider.fetchChapterPages(chapterId) as Promise<any>,
      25000,
      source,
    )
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'read failed', 502), 502)
  }
})

router.get('/popular', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`manga:popular:${page}`, 600, () =>
      withTimeout(mangaProviders.mangadex.fetchPopular(page), 20000, 'mangadex'),
    )
    return c.json(ok(data, { source: 'mangadex' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'popular failed', 502), 502)
  }
})

router.get('/recent', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`manga:recent:${page}`, 300, () =>
      withTimeout(mangaProviders.mangadex.fetchRecentlyAdded(page), 20000, 'mangadex'),
    )
    return c.json(ok(data, { source: 'mangadex' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'recent failed', 502), 502)
  }
})

router.get('/latest-updates', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await cached(`manga:latest:${page}`, 300, () =>
      withTimeout(mangaProviders.mangadex.fetchLatestUpdates(page), 20000, 'mangadex'),
    )
    return c.json(ok(data, { source: 'mangadex' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'latest failed', 502), 502)
  }
})

router.get('/random', async (c) => {
  try {
    const data = await withTimeout(mangaProviders.mangadex.fetchRandom(), 20000, 'mangadex')
    return c.json(ok(data, { source: 'mangadex' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'random failed', 502), 502)
  }
})

router.get('/trending', async (c) => {
  try {
    const data = await cached('manga:trending', 600, () =>
      withTimeout((mangaProviders.mangahere as any).fetchMangaTrending(), 20000, 'mangahere'),
    )
    return c.json(ok(data, { source: 'mangahere' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'trending failed', 502), 502)
  }
})

router.get('/hot', async (c) => {
  try {
    const data = await cached('manga:hot', 600, () =>
      withTimeout((mangaProviders.mangahere as any).fetchMangaHotReleases(), 20000, 'mangahere'),
    )
    return c.json(ok(data, { source: 'mangahere' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'hot failed', 502), 502)
  }
})

router.get('/ranking', async (c) => {
  const type = (c.req.query('type') ?? 'week') as any
  try {
    const data = await cached(`manga:ranking:${type}`, 600, () =>
      withTimeout((mangaProviders.mangahere as any).fetchMangaRanking(type), 20000, 'mangahere'),
    )
    return c.json(ok(data, { source: 'mangahere' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'ranking failed', 502), 502)
  }
})

router.get('/kakalot/genre', async (c) => {
  const genre = c.req.query('genre')
  const page = parseInt(c.req.query('page') ?? '1', 10)
  if (!genre) return c.json(fail('genre is required'), 400)
  try {
    const data = await withTimeout(
      (mangaProviders.mangakakalot as any).fetchByGenre(genre, page),
      20000,
      'mangakakalot',
    )
    return c.json(ok(data, { source: 'mangakakalot' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'genre failed', 502), 502)
  }
})

router.get('/kakalot/latest', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10)
  try {
    const data = await withTimeout(
      (mangaProviders.mangakakalot as any).fetchLatestUpdates(page),
      20000,
      'mangakakalot',
    )
    return c.json(ok(data, { source: 'mangakakalot' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'latest failed', 502), 502)
  }
})

router.get('/suggestions', async (c) => {
  const q = c.req.query('q')?.trim()
  if (!q) return c.json(fail('q is required'), 400)
  try {
    const data = await withTimeout(
      (mangaProviders.mangakakalot as any).fetchSuggestions(q),
      15000,
      'mangakakalot',
    )
    return c.json(ok(data, { source: 'mangakakalot' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'suggestions failed', 502), 502)
  }
})

export default router
