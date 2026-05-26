import { Hono } from 'hono'
import { BOOKS, LIGHT_NOVELS, COMICS } from '@consumet/extensions'
import {
  tryAllSources,
  successResponse,
  errorResponse,
  unavailableResponse,
  safePage,
} from '../utils/fallback.js'

const books = new Hono()

// ─── Singleton instances ────────────────────────────────────────────────────
const libgen          = new BOOKS.Libgen()
const readlightnovels = new LIGHT_NOVELS.ReadLightNovels()
const novelupdates    = new LIGHT_NOVELS.NovelUpdates()
const getcomics       = new COMICS.GetComics()

// ─── /search ────────────────────────────────────────────────────────────────
books.get('/search', async (c) => {
  const q    = c.req.query('q')
  const page = safePage(c.req.query('page'))
  if (!q) return c.json(errorResponse('Query parameter "q" is required', 400), 400)

  try {
    const { data, source } = await tryAllSources([
      { name: 'libgen', fn: () => libgen.search(q, page) },
    ])
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

// ─── /info ───────────────────────────────────────────────────────────────────
books.get('/info', async (c) => {
  const url = c.req.query('url')
  if (!url) return c.json(errorResponse('Query parameter "url" is required', 400), 400)

  try {
    const data = await libgen.scrapeBook(url)
    return c.json(successResponse(data, 'libgen', {
      title:    (data as any).title,
      author:   (data as any).authors,
      format:   (data as any).format,
      size:     (data as any).size,
      download: (data as any).link ?? (data as any).download ?? null,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /novels/search ──────────────────────────────────────────────────────────
books.get('/novels/search', async (c) => {
  const q    = c.req.query('q')
  const page = safePage(c.req.query('page'))
  if (!q) return c.json(errorResponse('Query parameter "q" is required', 400), 400)

  try {
    const { data, source } = await tryAllSources([
      { name: 'readlightnovels', fn: () => readlightnovels.search(q, page) },
      { name: 'novelupdates',    fn: () => novelupdates.search(q, page) },
    ])
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

// ─── /novels/info ────────────────────────────────────────────────────────────
books.get('/novels/info', async (c) => {
  const id     = c.req.query('id')
  const source = c.req.query('source')
  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)

  const sourceMap: Record<string, any> = { readlightnovels, novelupdates }
  const sources = source
    ? (sourceMap[source] ? [{ name: source, instance: sourceMap[source] }] : null)
    : Object.entries(sourceMap).map(([name, instance]) => ({ name, instance }))

  if (!sources) return c.json(errorResponse(`Unknown source: ${source}`, 400), 400)

  try {
    const { data, source: usedSource } = await tryAllSources(
      sources.map((s: any) => ({ name: s.name, fn: () => s.instance.fetchLightNovelInfo(id) }))
    )
    return c.json(successResponse(data, usedSource, {
      novel_id:       id,
      title:          (data as any).title,
      total_chapters: (data as any).chapters?.length ?? null,
      author:         (data as any).author ?? null,
      genres:         (data as any).genres ?? [],
    }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /novels/read ────────────────────────────────────────────────────────────
books.get('/novels/read', async (c) => {
  const chapterId = c.req.query('chapterId')
  const source    = c.req.query('source')
  if (!chapterId) return c.json(errorResponse('Query parameter "chapterId" is required', 400), 400)

  const sourceMap: Record<string, any> = { readlightnovels, novelupdates }
  const sources = source
    ? (sourceMap[source] ? [{ name: source, instance: sourceMap[source] }] : null)
    : Object.entries(sourceMap).map(([name, instance]) => ({ name, instance }))

  if (!sources) return c.json(errorResponse(`Unknown source: ${source}`, 400), 400)

  try {
    const { data, source: usedSource } = await tryAllSources(
      sources.map((s: any) => ({ name: s.name, fn: () => s.instance.fetchChapterContent(chapterId) }))
    )
    return c.json(successResponse(data, usedSource, { chapter_id: chapterId }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /comics/search ──────────────────────────────────────────────────────────
books.get('/comics/search', async (c) => {
  const q    = c.req.query('q')
  const page = safePage(c.req.query('page'))
  if (!q) return c.json(errorResponse('Query parameter "q" is required', 400), 400)

  try {
    const data = await getcomics.search(q)
    return c.json(successResponse(data, 'getcomics', {
      query: q, page,
      total_results: (data as any).results?.length ?? 0,
      has_next_page:  (data as any).hasNextPage ?? false,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /comics/info ────────────────────────────────────────────────────────────
books.get('/comics/info', async (c) => {
  const url = c.req.query('url')
  if (!url) return c.json(errorResponse('Query parameter "url" is required', 400), 400)

  try {
    const data = await getcomics.fetchComicInfo(url)
    return c.json(successResponse(data, 'getcomics', {
      title:    (data as any).title ?? null,
      download: (data as any).download ?? null,
      image:    (data as any).image ?? null,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /sources ── list available sources ──────────────────────────────────────
books.get('/sources', (c) => {
  return c.json(successResponse({
    books:   ['libgen'],
    novels:  ['readlightnovels', 'novelupdates'],
    comics:  ['getcomics'],
  }, 'static', {}))
})

export default books
