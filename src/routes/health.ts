import { Hono } from 'hono'
import { MOVIES, ANIME, MANGA, BOOKS, META } from '@consumet/extensions'
import { withTimeout } from '../utils/fallback.js'

const health = new Hono()

// ─── Reuse singletons from routes via lazy check ────────────────────────────
// Health uses fresh lightweight instances to avoid coupling with route state
const MOVIE_CHECKS = [
  { name: 'flixhq',       fn: () => new MOVIES.FlixHQ().search('avengers') },
  { name: 'fmovies',      fn: () => new MOVIES.Fmovies().search('avengers') },
  { name: 'goku',         fn: () => new MOVIES.Goku().search('avengers') },
  { name: 'moviehdwatch', fn: () => new MOVIES.MovieHdWatch().search('avengers') },
  { name: 'smashystream', fn: () => new MOVIES.SmashyStream().search('avengers') },
  { name: 'ummagurau',    fn: () => new MOVIES.Ummagurau().search('avengers') },
  { name: 'dramacool',    fn: () => new MOVIES.DramaCool().search('drama') },
  { name: 'kissasian',    fn: () => new MOVIES.KissAsian().search('drama') },
  { name: 'viewasian',    fn: () => new MOVIES.ViewAsian().search('drama') },
  { name: 'turkish123',   fn: () => new MOVIES.Turkish().search('dizisi') },
]

const ANIME_CHECKS = [
  { name: 'gogoanime',    fn: () => new ANIME.Gogoanime().search('naruto') },
  { name: 'zoro',         fn: () => new ANIME.Zoro().search('naruto') },
  { name: 'animepahe',    fn: () => new ANIME.AnimePahe().search('naruto') },
  { name: '9anime',       fn: () => new ANIME.NineAnime().search('naruto') },
  { name: 'animefox',     fn: () => new ANIME.AnimeFox().search('naruto') },
  { name: 'anify',        fn: () => new ANIME.Anify().search('naruto') },
  { name: 'crunchyroll',  fn: () => new ANIME.Crunchyroll().search('naruto') },
  { name: 'marin',        fn: () => new ANIME.Marin().search('naruto') },
  { name: 'bilibili',     fn: () => new ANIME.Bilibili().search('naruto') },
  { name: 'kickassanime', fn: () => new ANIME.KickAssAnime().search('naruto') },
  { name: 'animesaturn',  fn: () => new ANIME.AnimeSaturn().search('naruto') },
  { name: 'animeunity',   fn: () => new ANIME.AnimeUnity().search('naruto') },
  { name: 'monoschinos',  fn: () => new ANIME.MonosChinos().search('naruto') },
]

const MANGA_CHECKS = [
  { name: 'mangadex',     fn: () => new MANGA.MangaDex().search('one piece') },
  { name: 'comick',       fn: () => new MANGA.ComicK().search('one piece') },
  { name: 'mangakakalot', fn: () => new MANGA.MangaKakalot().search('one piece') },
  { name: 'mangareader',  fn: () => new MANGA.MangaReader().search('one piece') },
  { name: 'asurascans',   fn: () => new MANGA.AsuraScans().search('solo leveling') },
  { name: 'flamescans',   fn: () => new MANGA.FlameScans().search('solo leveling') },
  { name: 'mangahere',    fn: () => new MANGA.MangaHere().search('naruto') },
  { name: 'mangapark',    fn: () => new MANGA.Mangapark().search('naruto') },
  { name: 'vyvymanga',    fn: () => new MANGA.VyvyManga().search('naruto') },
]

const META_CHECKS = [
  { name: 'tmdb',         fn: () => new META.TMDB(process.env.TMDB_API_KEY).search('avengers') },
  { name: 'anilist',      fn: () => new META.Anilist().search('naruto') },
  { name: 'myanimelist',  fn: () => new META.Myanimelist().search('naruto') },
]

const BOOK_CHECKS = [
  { name: 'libgen',           fn: () => new BOOKS.Libgen().search('harry potter') },
]

// ─── Check helper ─────────────────────────────────────────────────────────
async function checkSource(
  name: string,
  fn: () => Promise<any>
): Promise<{ name: string; status: 'online' | 'offline'; latency_ms: number; error?: string }> {
  const start = Date.now()
  try {
    await withTimeout(fn(), 8000)
    return { name, status: 'online', latency_ms: Date.now() - start }
  } catch (e: any) {
    return { name, status: 'offline', latency_ms: Date.now() - start, error: e.message ?? 'Unknown error' }
  }
}

function summarize(checks: any[]) {
  const online  = checks.filter((c) => c.status === 'online').length
  const offline = checks.filter((c) => c.status === 'offline').length
  return {
    total:              checks.length,
    online,
    offline,
    uptime_percentage:  `${Math.round((online / checks.length) * 100)}%`,
  }
}

const META_INFO = {
  powered_by:   'Oracine',
  built_by:     'Jaden Afrix',
  organization: 'Oracron',
}

// ─── /health (all sources) ────────────────────────────────────────────────
health.get('/', async (c) => {
  const start   = Date.now()
  const allChecks = [...MOVIE_CHECKS, ...ANIME_CHECKS, ...MANGA_CHECKS, ...META_CHECKS, ...BOOK_CHECKS]

  const results = await Promise.all(allChecks.map((s) => checkSource(s.name, s.fn)))

  const byCategory = {
    movies: results.filter((r) => MOVIE_CHECKS.some((c) => c.name === r.name)),
    anime:  results.filter((r) => ANIME_CHECKS.some((c) => c.name === r.name)),
    manga:  results.filter((r) => MANGA_CHECKS.some((c) => c.name === r.name)),
    meta:   results.filter((r) => META_CHECKS.some((c) => c.name === r.name)),
    books:  results.filter((r) => BOOK_CHECKS.some((c) => c.name === r.name)),
  }

  const overall = summarize(results)

  return c.json({
    status:       'success',
    ...META_INFO,
    check_duration_ms: Date.now() - start,
    summary: {
      ...overall,
      by_category: {
        movies: summarize(byCategory.movies),
        anime:  summarize(byCategory.anime),
        manga:  summarize(byCategory.manga),
        meta:   summarize(byCategory.meta),
        books:  summarize(byCategory.books),
      },
    },
    sources: byCategory,
  })
})

// ─── /health/movies ───────────────────────────────────────────────────────
health.get('/movies', async (c) => {
  const start   = Date.now()
  const results = await Promise.all(MOVIE_CHECKS.map((s) => checkSource(s.name, s.fn)))
  return c.json({
    status: 'success', ...META_INFO,
    check_duration_ms: Date.now() - start,
    summary: summarize(results),
    sources: results,
  })
})

// ─── /health/anime ────────────────────────────────────────────────────────
health.get('/anime', async (c) => {
  const start   = Date.now()
  const results = await Promise.all(ANIME_CHECKS.map((s) => checkSource(s.name, s.fn)))
  return c.json({
    status: 'success', ...META_INFO,
    check_duration_ms: Date.now() - start,
    summary: summarize(results),
    sources: results,
  })
})

// ─── /health/manga ────────────────────────────────────────────────────────
health.get('/manga', async (c) => {
  const start   = Date.now()
  const results = await Promise.all(MANGA_CHECKS.map((s) => checkSource(s.name, s.fn)))
  return c.json({
    status: 'success', ...META_INFO,
    check_duration_ms: Date.now() - start,
    summary: summarize(results),
    sources: results,
  })
})

// ─── /health/meta ─────────────────────────────────────────────────────────
health.get('/meta', async (c) => {
  const start   = Date.now()
  const results = await Promise.all(META_CHECKS.map((s) => checkSource(s.name, s.fn)))
  return c.json({
    status: 'success', ...META_INFO,
    check_duration_ms: Date.now() - start,
    summary: summarize(results),
    sources: results,
  })
})

// ─── /health/books ────────────────────────────────────────────────────────
health.get('/books', async (c) => {
  const start   = Date.now()
  const results = await Promise.all(BOOK_CHECKS.map((s) => checkSource(s.name, s.fn)))
  return c.json({
    status: 'success', ...META_INFO,
    check_duration_ms: Date.now() - start,
    summary: summarize(results),
    sources: results,
  })
})

export default health
