import { Hono } from 'hono'
import { ANIME, META } from '@consumet/extensions'
import {
  tryAllSources,
  successResponse,
  errorResponse,
  unavailableResponse,
  filterByQuality,
  safePage,
  safePerPage,
} from '../utils/fallback.js'

const anime = new Hono()

// ─── Singleton instances ────────────────────────────────────────────────────
const gogoanime    = new ANIME.Gogoanime()
const zoro         = new ANIME.Zoro()
const animepahe    = new ANIME.AnimePahe()
const nineanime    = new ANIME.NineAnime()
const animefox     = new ANIME.AnimeFox()
const animedrive   = new ANIME.AnimeDrive()
const anify        = new ANIME.Anify()
const crunchyroll  = new ANIME.Crunchyroll()
const bilibili     = new ANIME.Bilibili()
const marin        = new ANIME.Marin()
const animesaturn  = new ANIME.AnimeSaturn()
const animeunity   = new ANIME.AnimeUnity()
const monoschinos  = new ANIME.MonosChinos()
const kickassanime = new ANIME.KickAssAnime()
const anilist      = new META.Anilist()

// ─── Source registries ──────────────────────────────────────────────────────
const allSources = [
  { name: 'gogoanime',    instance: gogoanime },
  { name: 'zoro',         instance: zoro },
  { name: 'animepahe',    instance: animepahe },
  { name: '9anime',       instance: nineanime },
  { name: 'animefox',     instance: animefox },
  { name: 'animedrive',   instance: animedrive },
  { name: 'anify',        instance: anify },
  { name: 'crunchyroll',  instance: crunchyroll },
  { name: 'bilibili',     instance: bilibili },
  { name: 'marin',        instance: marin },
  { name: 'animesaturn',  instance: animesaturn },
  { name: 'animeunity',   instance: animeunity },
  { name: 'monoschinos',  instance: monoschinos },
  { name: 'kickassanime', instance: kickassanime },
]

const sourceMap: Record<string, any> = {
  gogoanime,
  zoro,
  animepahe,
  '9anime':       nineanime,
  animefox,
  animedrive,
  anify,
  crunchyroll,
  bilibili,
  marin,
  animesaturn,
  animeunity,
  monoschinos,
  kickassanime,
}

// ─── /search ────────────────────────────────────────────────────────────────
anime.get('/search', async (c) => {
  const q       = c.req.query('q')
  const page    = safePage(c.req.query('page'))
  const perPage = safePerPage(c.req.query('perPage'))
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

// ─── /advanced-search (AniList-powered) ─────────────────────────────────────
anime.get('/advanced-search', async (c) => {
  const q      = c.req.query('q')
  const type   = (c.req.query('type') ?? 'ANIME').toUpperCase()
  const page   = safePage(c.req.query('page'))
  const perPage = safePerPage(c.req.query('perPage'))
  const format = c.req.query('format')
  const year   = c.req.query('year') ? parseInt(c.req.query('year')!) : undefined
  const status = c.req.query('status')
  const season = c.req.query('season')
  const genres = c.req.query('genres')?.split(',').filter(Boolean)
  const sort   = c.req.query('sort')?.split(',').filter(Boolean)

  try {
    const data = await anilist.advancedSearch(q, type, page, perPage, format, sort, genres, undefined, year, status, season)
    return c.json(successResponse(data, 'anilist', {
      query: q ?? null, type, page, year: year ?? null,
      status: status ?? null, season: season ?? null,
      genres: genres ?? [], sort: sort ?? [],
      total_results: (data as any).totalResults ?? (data as any).results?.length ?? 0,
      total_pages:   (data as any).totalPages ?? null,
      has_next_page: (data as any).hasNextPage ?? false,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /info ──────────────────────────────────────────────────────────────────
anime.get('/info', async (c) => {
  const id     = c.req.query('id')
  const source = c.req.query('source')
  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)

  const sources = source
    ? (sourceMap[source] ? [{ name: source, instance: sourceMap[source] }] : null)
    : allSources

  if (!sources) return c.json(errorResponse(`Unknown source: ${source}`, 400), 400)

  try {
    const { data, source: usedSource } = await tryAllSources(
      sources.map((s: any) => ({ name: s.name, fn: () => s.instance.fetchAnimeInfo(id) }))
    )
    return c.json(successResponse(data, usedSource, {
      anime_id:       id,
      title:          (data as any).title,
      status:         (data as any).status,
      total_episodes: (data as any).episodes?.length ?? null,
      genres:         (data as any).genres ?? [],
      rating:         (data as any).rating ?? null,
      description:    (data as any).description ?? null,
      image:          (data as any).image ?? null,
    }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /stream ─────────────────────────────────────────────────────────────────
anime.get('/stream', async (c) => {
  const episodeId = c.req.query('episodeId')
  const source    = c.req.query('source')
  const quality   = c.req.query('quality')
  if (!episodeId) return c.json(errorResponse('Query parameter "episodeId" is required', 400), 400)

  const sources = source
    ? (sourceMap[source] ? [{ name: source, instance: sourceMap[source] }] : null)
    : allSources

  if (!sources) return c.json(errorResponse(`Unknown source: ${source}`, 400), 400)

  try {
    const { data, source: usedSource } = await tryAllSources(
      (sources as any[]).map((s) => ({
        name: s.name,
        fn:   () => s.instance.fetchEpisodeSources(episodeId),
      }))
    )
    const stream = data as any
    const filteredSources = filterByQuality(stream.sources ?? [], quality)

    return c.json(successResponse(
      { ...stream, sources: filteredSources },
      usedSource,
      {
        episode_id:       episodeId,
        total_sources:    filteredSources.length,
        total_subtitles:  stream.subtitles?.length ?? 0,
        has_intro:        !!stream.intro,
        has_outro:        !!stream.outro,
        download:         stream.download ?? null,
        qualities:        (stream.sources ?? []).map((s: any) => s.quality ?? 'auto'),
        filtered_quality: quality ?? 'all',
        headers:          stream.headers ?? null,
      }
    ))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /download ───────────────────────────────────────────────────────────────
anime.get('/download', async (c) => {
  const episodeId = c.req.query('episodeId')
  const source    = c.req.query('source')
  const quality   = c.req.query('quality')
  if (!episodeId) return c.json(errorResponse('Query parameter "episodeId" is required', 400), 400)

  const sources = source
    ? (sourceMap[source] ? [{ name: source, instance: sourceMap[source] }] : null)
    : allSources

  if (!sources) return c.json(errorResponse(`Unknown source: ${source}`, 400), 400)

  try {
    const { data, source: usedSource } = await tryAllSources(
      (sources as any[]).map((s) => ({
        name: s.name,
        fn:   () => s.instance.fetchEpisodeSources(episodeId),
      }))
    )
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
      usedSource,
      {
        episode_id:      episodeId,
        total_links:     downloadLinks.length,
        has_direct:      !!stream.download,
        filtered_quality: quality ?? 'all',
      }
    ))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /servers ────────────────────────────────────────────────────────────────
anime.get('/servers', async (c) => {
  const episodeId = c.req.query('episodeId')
  const source    = c.req.query('source')
  if (!episodeId) return c.json(errorResponse('Query parameter "episodeId" is required', 400), 400)

  const serverCapable: Record<string, any> = { gogoanime, zoro, animepahe, '9anime': nineanime, kickassanime }
  const sources = source
    ? (serverCapable[source] ? [{ name: source, instance: serverCapable[source] }] : null)
    : Object.entries(serverCapable).map(([name, instance]) => ({ name, instance }))

  if (!sources) return c.json(errorResponse(`Unknown source: ${source}`, 400), 400)

  try {
    const { data, source: usedSource } = await tryAllSources(
      sources.map((s: any) => ({ name: s.name, fn: () => s.instance.fetchEpisodeServers(episodeId) }))
    )
    return c.json(successResponse(data, usedSource, { total_servers: (data as any[]).length }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /trending ───────────────────────────────────────────────────────────────
anime.get('/trending', async (c) => {
  const page    = safePage(c.req.query('page'))
  const perPage = safePerPage(c.req.query('perPage'))
  try {
    const { data, source } = await tryAllSources([
      { name: 'anilist',    fn: () => anilist.fetchTrendingAnime(page, perPage) },
      { name: 'gogoanime',  fn: () => gogoanime.fetchTopAiring(page) },
      { name: 'anify',      fn: () => anify.search('trending', page) },
    ])
    return c.json(successResponse(data, source, { page, total: (data as any).results?.length ?? 0 }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /popular ────────────────────────────────────────────────────────────────
anime.get('/popular', async (c) => {
  const page    = safePage(c.req.query('page'))
  const perPage = safePerPage(c.req.query('perPage'))
  try {
    const { data, source } = await tryAllSources([
      { name: 'anilist',   fn: () => anilist.fetchPopularAnime(page, perPage) },
      { name: 'gogoanime', fn: () => gogoanime.fetchPopular(page) },
    ])
    return c.json(successResponse(data, source, { page, total: (data as any).results?.length ?? 0 }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /recent ─────────────────────────────────────────────────────────────────
anime.get('/recent', async (c) => {
  const page    = safePage(c.req.query('page'))
  const perPage = safePerPage(c.req.query('perPage'))
  try {
    const { data, source } = await tryAllSources([
      { name: 'anilist',   fn: () => anilist.fetchRecentEpisodes(page, perPage) },
      { name: 'gogoanime', fn: () => gogoanime.fetchRecentEpisodes(page) },
    ])
    return c.json(successResponse(data, source, { page, total: (data as any).results?.length ?? 0 }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /schedule ───────────────────────────────────────────────────────────────
anime.get('/schedule', async (c) => {
  const page       = safePage(c.req.query('page'))
  const perPage    = safePerPage(c.req.query('perPage'))
  const weekStart  = parseInt(c.req.query('weekStart') ?? '0') || 0
  const weekEnd    = parseInt(c.req.query('weekEnd') ?? '6') || 6
  try {
    const data = await anilist.fetchAiringSchedule(page, perPage, weekStart, weekEnd)
    return c.json(successResponse(data, 'anilist', { page, week_start: weekStart, week_end: weekEnd }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /genre ──────────────────────────────────────────────────────────────────
anime.get('/genre', async (c) => {
  const genre   = c.req.query('genre')
  const page    = safePage(c.req.query('page'))
  const perPage = safePerPage(c.req.query('perPage'))
  if (!genre) return c.json(errorResponse('Query parameter "genre" is required', 400), 400)

  try {
    const { data, source } = await tryAllSources([
      { name: 'anilist',   fn: () => anilist.fetchAnimeGenres([genre], page, perPage) },
      { name: 'gogoanime', fn: () => gogoanime.fetchGenreInfo(genre, page) },
    ])
    return c.json(successResponse(data, source, { genre, page, total: (data as any).results?.length ?? 0 }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /random ─────────────────────────────────────────────────────────────────
anime.get('/random', async (c) => {
  try {
    const { data, source } = await tryAllSources([
      { name: 'anilist', fn: () => anilist.fetchRandomAnime() },
    ])
    return c.json(successResponse(data, source, { title: (data as any).title }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /genres-list ────────────────────────────────────────────────────────────
anime.get('/genres-list', (c) => {
  const genres = [
    'Action','Adventure','Cars','Comedy','Drama','Fantasy','Horror',
    'Mahou Shoujo','Mecha','Music','Mystery','Psychological','Romance',
    'Sci-Fi','Slice of Life','Sports','Supernatural','Thriller',
  ]
  return c.json(successResponse(genres, 'static', { total: genres.length }))
})

// ─── /sources ── list available sources ──────────────────────────────────────
anime.get('/sources', (c) => {
  return c.json(successResponse(allSources.map((s) => s.name), 'static', { total: allSources.length }))
})

export default anime
