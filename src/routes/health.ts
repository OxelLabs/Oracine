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
    const r = await withTimeout(fn(), 10000, name)
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
  const results: Check[] = []
  for (const [name, fn] of [
    ['hianime', () => animeProviders.hianime.search('naruto', 1)],
    ['animepahe', () => (animeProviders.animepahe as any).search('naruto')],
    ['animekai', () => animeProviders.animekai.search('naruto', 1)],
    ['kickassanime', () => animeProviders.kickassanime.search('naruto', 1)],
    ['animesaturn', () => (animeProviders.animesaturn as any).search('naruto', 1)],
    ['animeunity', () => (animeProviders.animeunity as any).search('naruto', 1)],
    ['animesama', () => (animeProviders.animesama as any).search('naruto', 1)],
  ] as [string, () => Promise<any>][]) {
    results.push(await probe(name, fn))
  }
  return c.json(ok(results))
})

router.get('/manga', async (c) => {
  const results: Check[] = []
  for (const [name, fn] of [
    ['mangadex', () => mangaProviders.mangadex.search('naruto', 1)],
    ['comick', () => (mangaProviders.comick as any).search('naruto')],
    ['mangahere', () => (mangaProviders.mangahere as any).search('naruto', 1)],
    ['mangapill', () => (mangaProviders.mangapill as any).search('naruto')],
    ['mangareader', () => (mangaProviders.mangareader as any).search('naruto')],
    ['asurascans', () => (mangaProviders.asurascans as any).search('naruto', 1)],
    ['weebcentral', () => (mangaProviders.weebcentral as any).search('naruto', 1)],
    ['mangakakalot', () => (mangaProviders.mangakakalot as any).search('naruto', 1)],
  ] as [string, () => Promise<any>][]) {
    results.push(await probe(name, fn))
  }
  return c.json(ok(results))
})

router.get('/movies', async (c) => {
  const results: Check[] = []
  for (const [name, fn] of [
    ['flixhq', () => (movieProviders.flixhq as any).search('matrix', 1)],
    ['sflix', () => (movieProviders.sflix as any).search('matrix', 1)],
    ['himovies', () => (movieProviders.himovies as any).search('matrix', 1)],
    ['goku', () => (movieProviders.goku as any).search('matrix', 1)],
    ['dramacool', () => (movieProviders.dramacool as any).search('crash', 1)],
    ['turkish', () => (movieProviders.turkish as any).search('aski')],
  ] as [string, () => Promise<any>][]) {
    results.push(await probe(name, fn))
  }
  return c.json(ok(results))
})

router.get('/books', async (c) => {
  const results: Check[] = []
  for (const [name, fn] of [
    ['novelupdates', () => (novelProviders.novelupdates as any).search('overlord')],
    ['getcomics', () => (comicProviders.getcomics as any).search('batman', 1)],
  ] as [string, () => Promise<any>][]) {
    results.push(await probe(name, fn))
  }
  return c.json(ok(results))
})

router.get('/meta', async (c) => {
  const results: Check[] = []
  for (const [name, fn] of [
    ['anilist', () => (metaProviders.anilist as any).search('naruto', 1, 5)],
    ['mal', () => (metaProviders.mal as any).search('naruto', 1)],
    ['tmdb', () => (metaProviders.tmdb as any).search('matrix', 1)],
  ] as [string, () => Promise<any>][]) {
    results.push(await probe(name, fn))
  }
  return c.json(ok(results))
})

router.get('/news', async (c) => {
  const results: Check[] = []
  for (const [name, fn] of [
    ['animenewsnetwork', () => (newsProviders.ann as any).fetchNewsFeeds('anime')],
  ] as [string, () => Promise<any>][]) {
    results.push(await probe(name, fn))
  }
  return c.json(ok(results))
})

export default router
