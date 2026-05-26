import { Hono } from 'hono'
import { MOVIES, META } from '@consumet/extensions'
import {
  tryAllSources,
  successResponse,
  errorResponse,
  unavailableResponse,
  filterByQuality,
  safePage,
} from '../utils/fallback.js'

const movies = new Hono()

// ─── Singleton instances ────────────────────────────────────────────────────
const flixhq      = new MOVIES.FlixHQ()
const fmovies     = new MOVIES.Fmovies()
const goku        = new MOVIES.Goku()
const moviehd     = new MOVIES.MovieHdWatch()
const dramacool   = new MOVIES.DramaCool()
const kissasian   = new MOVIES.KissAsian()
const viewasian   = new MOVIES.ViewAsian()
const smashystream = new MOVIES.SmashyStream()
const turkish     = new MOVIES.Turkish()
const ummagurau   = new MOVIES.Ummagurau()
const tmdb        = new META.TMDB(process.env.TMDB_API_KEY)

// ─── Source registries ──────────────────────────────────────────────────────
const westernSources = [
  { name: 'flixhq',       instance: flixhq },
  { name: 'fmovies',      instance: fmovies },
  { name: 'goku',         instance: goku },
  { name: 'moviehdwatch', instance: moviehd },
  { name: 'smashystream', instance: smashystream },
  { name: 'ummagurau',    instance: ummagurau },
]

const asianSources = [
  { name: 'dramacool',  instance: dramacool },
  { name: 'kissasian',  instance: kissasian },
  { name: 'viewasian',  instance: viewasian },
  { name: 'turkish123', instance: turkish },
]

const allSources = [...westernSources, ...asianSources]

const sourceMap: Record<string, any> = {
  flixhq,
  fmovies,
  goku,
  moviehdwatch: moviehd,
  smashystream,
  ummagurau,
  dramacool,
  kissasian,
  viewasian,
  turkish123: turkish,
}

// ─── /search ────────────────────────────────────────────────────────────────
movies.get('/search', async (c) => {
  const q    = c.req.query('q')
  const page = safePage(c.req.query('page'))
  const type = c.req.query('type') ?? 'all'

  if (!q) return c.json(errorResponse('Query parameter "q" is required', 400), 400)

  const sources =
    type === 'asian'   ? asianSources :
    type === 'western' ? westernSources :
    allSources

  try {
    const { data, source } = await tryAllSources(
      sources.map((s) => ({ name: s.name, fn: () => s.instance.search(q, page) }))
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
movies.get('/info', async (c) => {
  const id     = c.req.query('id')
  const source = c.req.query('source')

  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)

  // If no source specified, try all until one works
  const sources = source
    ? (sourceMap[source] ? [{ name: source, instance: sourceMap[source] }] : null)
    : allSources

  if (!sources) return c.json(errorResponse(`Unknown source: ${source}`, 400), 400)

  try {
    const { data, source: usedSource } = await tryAllSources(
      sources.map((s: any) => ({ name: s.name, fn: () => s.instance.fetchMediaInfo(id) }))
    )
    return c.json(successResponse(data, usedSource, {
      media_id:       id,
      title:          (data as any).title,
      type:           (data as any).type,
      total_episodes: (data as any).episodes?.length ?? null,
      total_seasons:  (data as any).seasons ?? null,
      genres:         (data as any).genres ?? [],
      rating:         (data as any).rating ?? null,
      description:    (data as any).description ?? null,
    }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /stream ─────────────────────────────────────────────────────────────────
movies.get('/stream', async (c) => {
  const episodeId = c.req.query('episodeId')
  const mediaId   = c.req.query('mediaId')
  const source    = c.req.query('source')
  const quality   = c.req.query('quality') // optional: 360p, 480p, 720p, 1080p

  if (!episodeId || !mediaId)
    return c.json(errorResponse('episodeId and mediaId are required', 400), 400)

  const sources = source
    ? (sourceMap[source] ? [{ name: source, instance: sourceMap[source] }] : null)
    : allSources

  if (!sources) return c.json(errorResponse(`Unknown source: ${source}`, 400), 400)

  try {
    const { data, source: usedSource } = await tryAllSources(
      sources.map((s: any) => ({
        name: s.name,
        fn:   () => s.instance.fetchEpisodeSources(episodeId, mediaId),
      }))
    )

    const stream = data as any
    const filteredSources = filterByQuality(stream.sources ?? [], quality)

    return c.json(successResponse(
      { ...stream, sources: filteredSources },
      usedSource,
      {
        episode_id:       episodeId,
        media_id:         mediaId,
        total_sources:    filteredSources.length,
        total_subtitles:  stream.subtitles?.length ?? 0,
        has_intro:        !!stream.intro,
        has_outro:        !!stream.outro,
        download:         stream.download ?? null,
        qualities:        (stream.sources ?? []).map((s: any) => s.quality ?? 'auto'),
        filtered_quality: quality ?? 'all',
        headers:          stream.headers ?? null,
        embed_url:        stream.embedURL ?? null,
      }
    ))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /download ───────────────────────────────────────────────────────────────
movies.get('/download', async (c) => {
  const episodeId = c.req.query('episodeId')
  const mediaId   = c.req.query('mediaId')
  const source    = c.req.query('source')
  const quality   = c.req.query('quality')

  if (!episodeId || !mediaId)
    return c.json(errorResponse('episodeId and mediaId are required', 400), 400)

  const sources = source
    ? (sourceMap[source] ? [{ name: source, instance: sourceMap[source] }] : null)
    : allSources

  if (!sources) return c.json(errorResponse(`Unknown source: ${source}`, 400), 400)

  try {
    const { data, source: usedSource } = await tryAllSources(
      sources.map((s: any) => ({
        name: s.name,
        fn:   () => s.instance.fetchEpisodeSources(episodeId, mediaId),
      }))
    )

    const stream = data as any
    const filteredSources = filterByQuality(stream.sources ?? [], quality)

    const downloadLinks = filteredSources
      .filter((s: any) => s.url && !s.isM3U8 && !s.isDASH)
      .map((s: any) => ({
        url:     s.url,
        quality: s.quality ?? 'unknown',
        isM3U8:  s.isM3U8 ?? false,
        isDASH:  s.isDASH ?? false,
        size:    s.size ?? null,
      }))

    // Also include m3u8 if no direct links
    const allDownloads = downloadLinks.length
      ? downloadLinks
      : (stream.sources ?? []).map((s: any) => ({
          url:     s.url,
          quality: s.quality ?? 'auto',
          isM3U8:  s.isM3U8 ?? false,
          isDASH:  s.isDASH ?? false,
          size:    s.size ?? null,
        }))

    return c.json(successResponse(
      { download_links: allDownloads, direct_download: stream.download ?? null },
      usedSource,
      {
        episode_id:      episodeId,
        media_id:        mediaId,
        total_links:     allDownloads.length,
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
movies.get('/servers', async (c) => {
  const episodeId = c.req.query('episodeId')
  const mediaId   = c.req.query('mediaId')
  const source    = c.req.query('source')

  if (!episodeId || !mediaId)
    return c.json(errorResponse('episodeId and mediaId are required', 400), 400)

  const sources = source
    ? (sourceMap[source] ? [{ name: source, instance: sourceMap[source] }] : null)
    : westernSources

  if (!sources) return c.json(errorResponse(`Unknown source: ${source}`, 400), 400)

  try {
    const { data, source: usedSource } = await tryAllSources(
      sources.map((s: any) => ({
        name: s.name,
        fn:   () => s.instance.fetchEpisodeServers(episodeId, mediaId),
      }))
    )
    return c.json(successResponse(data, usedSource, { total_servers: (data as any[]).length }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /trending ───────────────────────────────────────────────────────────────
movies.get('/trending', async (c) => {
  const type = c.req.query('type') ?? 'movie'
  try {
    const { data, source } = await tryAllSources([
      { name: 'tmdb',   fn: () => tmdb.fetchTrending(type) },
      { name: 'flixhq', fn: () => type === 'movie' ? flixhq.fetchTrendingMovies() : flixhq.fetchTrendingTvShows() },
      { name: 'goku',   fn: () => type === 'movie' ? goku.fetchTrendingMovies() : goku.fetchTrendingTvShows() },
    ])
    return c.json(successResponse(data, source, {
      type,
      total: (data as any)?.results?.length ?? (data as any[])?.length ?? 0,
    }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /recent ─────────────────────────────────────────────────────────────────
movies.get('/recent', async (c) => {
  const type = c.req.query('type') ?? 'movie'
  try {
    const { data, source } = await tryAllSources([
      { name: 'flixhq', fn: () => type === 'movie' ? flixhq.fetchRecentMovies() : flixhq.fetchRecentTvShows() },
      { name: 'goku',   fn: () => type === 'movie' ? goku.fetchRecentMovies() : goku.fetchRecentTvShows() },
    ])
    return c.json(successResponse(data, source, { type, total: (data as any[]).length }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /genre ──────────────────────────────────────────────────────────────────
movies.get('/genre', async (c) => {
  const genre = c.req.query('genre')
  const page  = safePage(c.req.query('page'))
  if (!genre) return c.json(errorResponse('Query parameter "genre" is required', 400), 400)

  try {
    const { data, source } = await tryAllSources([
      { name: 'flixhq', fn: () => flixhq.fetchByGenre(genre, page) },
      { name: 'goku',   fn: () => goku.fetchByGenre(genre, page) },
    ])
    return c.json(successResponse(data, source, {
      genre, page,
      total: (data as any).results?.length ?? 0,
      has_next_page: (data as any).hasNextPage ?? false,
    }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /country ────────────────────────────────────────────────────────────────
movies.get('/country', async (c) => {
  const country = c.req.query('country')
  const page    = safePage(c.req.query('page'))
  if (!country) return c.json(errorResponse('Query parameter "country" is required', 400), 400)

  try {
    const { data, source } = await tryAllSources([
      { name: 'flixhq', fn: () => flixhq.fetchByCountry(country, page) },
      { name: 'goku',   fn: () => goku.fetchByCountry(country, page) },
    ])
    return c.json(successResponse(data, source, {
      country, page,
      total: (data as any).results?.length ?? 0,
      has_next_page: (data as any).hasNextPage ?? false,
    }))
  } catch (err: any) {
    if (err.allFailed) return c.json(unavailableResponse(err.errors), 503)
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /sources ── list available sources ──────────────────────────────────────
movies.get('/sources', (c) => {
  return c.json(successResponse({
    western: westernSources.map((s) => s.name),
    asian:   asianSources.map((s) => s.name),
    all:     allSources.map((s) => s.name),
  }, 'static', { total: allSources.length }))
})

export default movies
