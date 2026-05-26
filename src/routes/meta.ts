import { Hono } from 'hono'
import { META } from '@consumet/extensions'
import {
  tryAllSources,
  successResponse,
  errorResponse,
  unavailableResponse,
  filterByQuality,
  safePage,
  safePerPage,
} from '../utils/fallback.js'

const meta = new Hono()

// ─── Singleton instances ────────────────────────────────────────────────────
const tmdb    = new META.TMDB(process.env.TMDB_API_KEY)
const anilist = new META.Anilist()
const mal     = new META.Myanimelist()

// ════════════════════════════════════════════
// TMDB
// ════════════════════════════════════════════

meta.get('/tmdb/search', async (c) => {
  const q    = c.req.query('q')
  const page = safePage(c.req.query('page'))
  if (!q) return c.json(errorResponse('Query parameter "q" is required', 400), 400)

  try {
    const data = await tmdb.search(q, page)
    return c.json(successResponse(data, 'tmdb', {
      query: q, page,
      total_results: (data as any).totalResults ?? (data as any).results?.length ?? 0,
      total_pages:   (data as any).totalPages ?? null,
      has_next_page: (data as any).hasNextPage ?? false,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/tmdb/info', async (c) => {
  const id   = c.req.query('id')
  const type = c.req.query('type') ?? 'movie'
  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)

  try {
    const data = await tmdb.fetchMediaInfo(id, type)
    return c.json(successResponse(data, 'tmdb', {
      tmdb_id:        id,
      type,
      title:          (data as any).title,
      rating:         (data as any).rating,
      release_date:   (data as any).releaseDate,
      genres:         (data as any).genres ?? [],
      total_episodes: (data as any).episodes?.length ?? null,
      total_seasons:  (data as any).seasons ?? null,
      description:    (data as any).description ?? null,
      image:          (data as any).image ?? null,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/tmdb/trending', async (c) => {
  const type   = c.req.query('type') ?? 'all'
  const period = (c.req.query('period') ?? 'day') as 'day' | 'week'
  const page   = safePage(c.req.query('page'))

  try {
    const data = await tmdb.fetchTrending(type, period, page)
    return c.json(successResponse(data, 'tmdb', {
      type, period, page,
      total_results: (data as any).totalResults ?? (data as any).results?.length ?? 0,
      total_pages:   (data as any).totalPages ?? null,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/tmdb/stream', async (c) => {
  const id      = c.req.query('id')
  const quality = c.req.query('quality')
  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)

  try {
    const data   = await tmdb.fetchEpisodeSources(id)
    const stream = data as any
    const filteredSources = filterByQuality(stream.sources ?? [], quality)

    return c.json(successResponse(
      { ...stream, sources: filteredSources },
      'tmdb',
      {
        id,
        total_sources:    filteredSources.length,
        total_subtitles:  stream.subtitles?.length ?? 0,
        qualities:        (stream.sources ?? []).map((s: any) => s.quality ?? 'auto'),
        filtered_quality: quality ?? 'all',
        download:         stream.download ?? null,
        headers:          stream.headers ?? null,
      }
    ))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/tmdb/download', async (c) => {
  const id      = c.req.query('id')
  const quality = c.req.query('quality')
  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)

  try {
    const data   = await tmdb.fetchEpisodeSources(id)
    const stream = data as any
    const filteredSources = filterByQuality(stream.sources ?? [], quality)

    const downloadLinks = filteredSources.map((s: any) => ({
      url:     s.url,
      quality: s.quality ?? 'auto',
      isM3U8:  s.isM3U8 ?? false,
      isDASH:  s.isDASH ?? false,
      size:    s.size ?? null,
    }))

    return c.json(successResponse(
      { download_links: downloadLinks, direct_download: stream.download ?? null },
      'tmdb',
      { id, total_links: downloadLinks.length, has_direct: !!stream.download, filtered_quality: quality ?? 'all' }
    ))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

// ════════════════════════════════════════════
// AniList
// ════════════════════════════════════════════

meta.get('/anilist/search', async (c) => {
  const q       = c.req.query('q')
  const page    = safePage(c.req.query('page'))
  const perPage = safePerPage(c.req.query('perPage'))
  if (!q) return c.json(errorResponse('Query parameter "q" is required', 400), 400)

  try {
    const data = await anilist.search(q, page, perPage)
    return c.json(successResponse(data, 'anilist', {
      query: q, page,
      total_results: (data as any).results?.length ?? 0,
      has_next_page: (data as any).hasNextPage ?? false,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/anilist/advanced-search', async (c) => {
  const q       = c.req.query('q')
  const type    = (c.req.query('type') ?? 'ANIME').toUpperCase()
  const page    = safePage(c.req.query('page'))
  const perPage = safePerPage(c.req.query('perPage'))
  const format  = c.req.query('format')
  const year    = c.req.query('year') ? parseInt(c.req.query('year')!) : undefined
  const status  = c.req.query('status')
  const season  = c.req.query('season')
  const genres  = c.req.query('genres')?.split(',').filter(Boolean)
  const sort    = c.req.query('sort')?.split(',').filter(Boolean)

  try {
    const data = await anilist.advancedSearch(q, type, page, perPage, format, sort, genres, undefined, year, status, season)
    return c.json(successResponse(data, 'anilist', {
      query: q ?? null, type, page,
      total_results: (data as any).totalResults ?? (data as any).results?.length ?? 0,
      total_pages:   (data as any).totalPages ?? null,
      has_next_page: (data as any).hasNextPage ?? false,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/anilist/info', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)

  try {
    const data = await anilist.fetchAnimeInfo(id)
    return c.json(successResponse(data, 'anilist', {
      anilist_id:     id,
      title:          (data as any).title,
      status:         (data as any).status,
      rating:         (data as any).rating,
      genres:         (data as any).genres ?? [],
      total_episodes: (data as any).totalEpisodes ?? null,
      description:    (data as any).description ?? null,
      image:          (data as any).image ?? null,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/anilist/info-by-id', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)

  try {
    const data = await anilist.fetchAnilistInfoById(id)
    return c.json(successResponse(data, 'anilist', { anilist_id: id }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/anilist/episodes', async (c) => {
  const id           = c.req.query('id')
  const dub          = c.req.query('dub') === 'true'
  const fetchFiller  = c.req.query('fetchFiller') === 'true'
  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)

  try {
    const data = await anilist.fetchEpisodesListById(id, dub, fetchFiller)
    return c.json(successResponse(data, 'anilist', {
      anilist_id:     id,
      dub,
      fetch_filler:   fetchFiller,
      total_episodes: (data as any[])?.length ?? 0,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/anilist/trending', async (c) => {
  const page    = safePage(c.req.query('page'))
  const perPage = safePerPage(c.req.query('perPage'))
  try {
    const data = await anilist.fetchTrendingAnime(page, perPage)
    return c.json(successResponse(data, 'anilist', { page, total: (data as any).results?.length ?? 0 }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/anilist/popular', async (c) => {
  const page    = safePage(c.req.query('page'))
  const perPage = safePerPage(c.req.query('perPage'))
  try {
    const data = await anilist.fetchPopularAnime(page, perPage)
    return c.json(successResponse(data, 'anilist', { page, total: (data as any).results?.length ?? 0 }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/anilist/recent', async (c) => {
  const page    = safePage(c.req.query('page'))
  const perPage = safePerPage(c.req.query('perPage'))
  try {
    const data = await anilist.fetchRecentEpisodes(page, perPage)
    return c.json(successResponse(data, 'anilist', { page, total: (data as any).results?.length ?? 0 }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/anilist/schedule', async (c) => {
  const page      = safePage(c.req.query('page'))
  const perPage   = safePerPage(c.req.query('perPage'))
  const weekStart = parseInt(c.req.query('weekStart') ?? '0') || 0
  const weekEnd   = parseInt(c.req.query('weekEnd') ?? '6') || 6
  try {
    const data = await anilist.fetchAiringSchedule(page, perPage, weekStart, weekEnd)
    return c.json(successResponse(data, 'anilist', { page, week_start: weekStart, week_end: weekEnd }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/anilist/genre', async (c) => {
  const genres  = c.req.query('genres')?.split(',').filter(Boolean) ?? []
  const page    = safePage(c.req.query('page'))
  const perPage = safePerPage(c.req.query('perPage'))
  if (!genres.length) return c.json(errorResponse('Query parameter "genres" is required (comma-separated)', 400), 400)

  try {
    const data = await anilist.fetchAnimeGenres(genres, page, perPage)
    return c.json(successResponse(data, 'anilist', { genres, page, total: (data as any).results?.length ?? 0 }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/anilist/character', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)
  try {
    const data = await anilist.fetchCharacterInfoById(id)
    return c.json(successResponse(data, 'anilist', { character_id: id }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/anilist/staff', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)
  try {
    const data = await anilist.fetchStaffById(parseInt(id))
    return c.json(successResponse(data, 'anilist', { staff_id: id }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/anilist/random', async (c) => {
  try {
    const data = await anilist.fetchRandomAnime()
    return c.json(successResponse(data, 'anilist', { title: (data as any).title }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

// ════════════════════════════════════════════
// MyAnimeList
// ════════════════════════════════════════════

meta.get('/mal/search', async (c) => {
  const q    = c.req.query('q')
  const page = safePage(c.req.query('page'))
  if (!q) return c.json(errorResponse('Query parameter "q" is required', 400), 400)

  try {
    const data = await mal.search(q, page)
    return c.json(successResponse(data, 'myanimelist', {
      query: q, page,
      total_results: (data as any).results?.length ?? 0,
      has_next_page: (data as any).hasNextPage ?? false,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

meta.get('/mal/info', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)

  try {
    const data = await mal.fetchAnimeInfo(id)
    return c.json(successResponse(data, 'myanimelist', {
      mal_id:  id,
      title:   (data as any).title,
      rating:  (data as any).rating,
      status:  (data as any).status,
      genres:  (data as any).genres ?? [],
      image:   (data as any).image ?? null,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

export default meta
