import { Hono } from 'hono'
import { animeProviders, mangaProviders, movieProviders, novelProviders, comicProviders, newsProviders, metaProviders } from '../providers/registry.js'
import { withTimeout } from '../utils/fallback.js'
import { ok } from '../utils/response.js'
import { cacheStats } from '../utils/cache.js'

const router = new Hono()

type Check = { source: string; ok: boolean; ms: number; error?: string }

async function probe(name: string, fn: () => Promise<any>): Promise<Check> {
  const start = Date.now()
  try {
    const r = await withTimeout(fn(), 15000, name)
    const has =
      r && (Array.isArray(r) ? r.length > 0 : Array.isArray((r as any).results) ? (r as any).results.length > 0 : true)
    return { source: name, ok: !!has, ms: Date.now() - start }
  } catch (err: any) {
    return { source: name, ok: false, ms: Date.now() - start, error: err?.message ?? String(err) }
  }
}

router.get('/', async (c) => {
  const checks: Check[] = []
  return c.json(ok({ uptime_seconds: Math.round(process.uptime()), checks, cache: cacheStats() }, { ts: new Date().toISOString() }))
})

router.get('/anime', async (c) => {
  const tests = [
    probe('hianime', () => animeProviders.hianime.search('naruto', 1)),
    probe('animepahe', () => (animeProviders.animepahe as any).search('naruto')),
    probe('animekai', () => animeProviders.animekai.search('naruto', 1)),
    probe('kickassanime', () => animeProviders.kickassanime.search('naruto', 1)),
    probe('animesaturn', () => (animeProviders.animesaturn as any).search('naruto', 1)),
    probe('animeunity', () => (animeProviders.animeunity as any).search('naruto', 1)),
    probe('animesama', () => (animeProviders.animesama as any).search('naruto', 1)),
  ]
  const results = await Promise.all(tests)
  return c.json(ok(results))
})

router.get('/manga', async (c) => {
  const tests = [
    probe('mangadex', () => mangaProviders.mangadex.search('naruto', 1)),
    probe('comick', () => (mangaProviders.comick as any).search('naruto')),
    probe('mangahere', () => (mangaProviders.mangahere as any).search('naruto', 1)),
    probe('mangapill', () => (mangaProviders.mangapill as any).search('naruto')),
    probe('mangareader', () => (mangaProviders.mangareader as any).search('naruto')),
    probe('asurascans', () => (mangaProviders.asurascans as any).search('naruto', 1)),
    probe('weebcentral', () => (mangaProviders.weebcentral as any).search('naruto', 1)),
    probe('mangakakalot', () => (mangaProviders.mangakakalot as any).search('naruto', 1)),
  ]
  const results = await Promise.all(tests)
  return c.json(ok(results))
})

router.get('/movies', async (c) => {
  const tests = [
    probe('flixhq', () => (movieProviders.flixhq as any).search('matrix', 1)),
    probe('sflix', () => (movieProviders.sflix as any).search('matrix', 1)),
    probe('himovies', () => (movieProviders.himovies as any).search('matrix', 1)),
    probe('goku', () => (movieProviders.goku as any).search('matrix', 1)),
    probe('dramacool', () => (movieProviders.dramacool as any).search('crash', 1)),
    probe('turkish', () => (movieProviders.turkish as any).search('aski')),
  ]
  const results = await Promise.all(tests)
  return c.json(ok(results))
})

router.get('/books', async (c) => {
  const tests = [
    probe('novelupdates', () => (novelProviders.novelupdates as any).search('overlord')),
    probe('getcomics', () => (comicProviders.getcomics as any).search('batman', 1)),
  ]
  const results = await Promise.all(tests)
  return c.json(ok(results))
})

router.get('/meta', async (c) => {
  const tests = [
    probe('anilist', () => (metaProviders.anilist as any).search('naruto', 1, 5)),
    probe('mal', () => (metaProviders.mal as any).search('naruto', 1)),
    probe('tmdb', () => (metaProviders.tmdb as any).search('matrix', 1)),
  ]
  const results = await Promise.all(tests)
  return c.json(ok(results))
})

router.get('/news', async (c) => {
  const tests = [probe('animenewsnetwork', () => (newsProviders.ann as any).fetchNewsFeeds('anime'))]
  const results = await Promise.all(tests)
  return c.json(ok(results))
})

export default router
