import { Hono } from 'hono'
import { MANGA } from '@consumet/extensions'
import {
  tryAllSources,
  successResponse,
  errorResponse,
  unavailableResponse,
  safePage,
} from '../utils/fallback.js'

const manga = new Hono()

// ─── Singleton instances ────────────────────────────────────────────────────
const mangadex    = new MANGA.MangaDex()
const comick      = new MANGA.ComicK()
const mangahere   = new MANGA.MangaHere()
const mangakakalot = new MANGA.MangaKakalot()
const mangasee    = new MANGA.Mangasee123()
const mangapark   = new MANGA.Mangapark()
const mangapill   = new MANGA.MangaPill()
const mangareader = new MANGA.MangaReader()
const asurascans  = new MANGA.AsuraScans()
const flamescans  = new MANGA.FlameScans()
const mangahost   = new MANGA.MangaHost()
const brmangas    = new MANGA.BRMangas()
const readmanga   = new MANGA.ReadManga()
const vyvymanga   = new MANGA.VyvyManga()

// ─── Source registries ──────────────────────────────────────────────────────
const allSources = [
  { name: 'mangadex',     instance: mangadex },
  { name: 'comick',       instance: comick },
  { name: 'mangahere',    instance: mangahere },
  { name: 'mangakakalot', instance: mangakakalot },
  { name: 'mangasee123',  instance: mangasee },
  { name: 'mangapark',    instance: mangapark },
  { name: 'mangapill',    instance: mangapill },
  { name: 'mangareader',  instance: mangareader },
  { name: 'asurascans',   instance: asurascans },
  { name: 'flamescans',   instance: flamescans },
  { name: 'mangahost',    instance: mangahost },
  { name: 'brmangas',     instance: brmangas },
  { name: 'readmanga',    instance: readmanga },
  { name: 'vyvymanga',    instance: vyvymanga },
]

const sourceMap: Record<string, any> = {
  mangadex,
  comick,
  mangahere,
  mangakakalot,
  mangasee123: mangasee,
  mangapark,
  mangapill,
  mangareader,
  asurascans,
  flamescans,
  mangahost,
  brmangas,
  readmanga,
  vyvymanga,
}

// ─── /search ────────────────────────────────────────────────────────────────
manga.get('/search', async (c) => {
  const q    = c.req.query('q')
  const page = safePage(c.req.query('page'))
  if (!q) return c.json(errorResponse('Query parameter "q" is required', 400), 400)

  try {
    const { data, source } = await tryAllSources(
      allSources.map((s) => ({ name: s.name, fn: () => s.instance.search(q, page) }))
    )
    return c.json(successResponse(data, source, {
      query: q, page,
      total_results: (data as any).results?.length ?? 0,
      has_next_page:  (data as any).hasNextPage ?? false,
    }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /info ──────────────────────────────────────────────────────────────────
manga.get('/info', async (c) => {
  const id     = c.req.query('id')
  const source = c.req.query('source')
  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)

  const sources = source
    ? (sourceMap[source] ? [{ name: source, instance: sourceMap[source] }] : null)
    : allSources

  if (!sources) return c.json(errorResponse(`Unknown source: ${source}`, 400), 400)

  try {
    const { data, source: usedSource } = await tryAllSources(
      sources.map((s: any) => ({ name: s.name, fn: () => s.instance.fetchMangaInfo(id) }))
    )
    return c.json(successResponse(data, usedSource, {
      manga_id:       id,
      title:          (data as any).title,
      status:         (data as any).status,
      total_chapters: (data as any).chapters?.length ?? null,
      genres:         (data as any).genres ?? [],
      description:    (data as any).description ?? null,
      image:          (data as any).image ?? null,
    }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /read ───────────────────────────────────────────────────────────────────
manga.get('/read', async (c) => {
  const chapterId = c.req.query('chapterId')
  const source    = c.req.query('source')
  if (!chapterId) return c.json(errorResponse('Query parameter "chapterId" is required', 400), 400)

  const sources = source
    ? (sourceMap[source] ? [{ name: source, instance: sourceMap[source] }] : null)
    : allSources

  if (!sources) return c.json(errorResponse(`Unknown source: ${source}`, 400), 400)

  try {
    const { data, source: usedSource } = await tryAllSources(
      sources.map((s: any) => ({ name: s.name, fn: () => s.instance.fetchChapterPages(chapterId) }))
    )
    return c.json(successResponse(data, usedSource, {
      chapter_id:  chapterId,
      total_pages: (data as any[]).length,
    }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /popular ────────────────────────────────────────────────────────────────
manga.get('/popular', async (c) => {
  const page = safePage(c.req.query('page'))
  try {
    const { data, source } = await tryAllSources([
      { name: 'mangadex',     fn: () => mangadex.fetchPopular(page) },
      { name: 'comick',       fn: () => comick.search('popular', page) },
      { name: 'mangakakalot', fn: () => mangakakalot.search('popular manga', page) },
    ])
    return c.json(successResponse(data, source, { page, total: (data as any).results?.length ?? 0 }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /recent ─────────────────────────────────────────────────────────────────
manga.get('/recent', async (c) => {
  const page = safePage(c.req.query('page'))
  try {
    const { data, source } = await tryAllSources([
      { name: 'mangadex',     fn: () => mangadex.fetchRecentlyAdded(page) },
      { name: 'mangakakalot', fn: () => mangakakalot.search('latest', page) },
      { name: 'comick',       fn: () => comick.search('recent', page) },
    ])
    return c.json(successResponse(data, source, { page, total: (data as any).results?.length ?? 0 }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /latest-updates ─────────────────────────────────────────────────────────
manga.get('/latest-updates', async (c) => {
  const page = safePage(c.req.query('page'))
  try {
    const { data, source } = await tryAllSources([
      { name: 'mangadex',    fn: () => mangadex.fetchLatestUpdates(page) },
      { name: 'mangareader', fn: () => mangareader.search('latest', page) },
      { name: 'asurascans',  fn: () => asurascans.search('latest', page) },
    ])
    return c.json(successResponse(data, source, { page, total: (data as any).results?.length ?? 0 }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /random ─────────────────────────────────────────────────────────────────
manga.get('/random', async (c) => {
  try {
    const { data, source } = await tryAllSources([
      { name: 'mangadex', fn: () => mangadex.fetchRandom() },
    ])
    return c.json(successResponse(data, source, { total: (data as any).results?.length ?? 0 }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /sources ── list available sources ──────────────────────────────────────
manga.get('/sources', (c) => {
  return c.json(successResponse(allSources.map((s) => s.name), 'static', { total: allSources.length }))
})

export default manga
