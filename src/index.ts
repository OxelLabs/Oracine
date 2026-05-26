import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import movies from './routes/movies.js'
import anime  from './routes/anime.js'
import manga  from './routes/manga.js'
import books  from './routes/books.js'
import meta   from './routes/meta.js'
import news   from './routes/news.js'
import health from './routes/health.js'

const app = new Hono()

// ─── CORS — allow all origins, all methods, headers needed for video players ─
app.use('*', cors({
  origin:          process.env.CORS_ORIGIN ?? '*',
  allowMethods:    ['GET', 'OPTIONS'],
  allowHeaders:    ['Content-Type', 'Authorization', 'Range'],
  exposeHeaders:   ['Content-Length', 'Content-Range', 'Accept-Ranges'],
  maxAge:          86400,
  credentials:     false,
}))

// ─── Security headers (allow fullscreen embedding) ───────────────────────────
app.use('*', async (c, next) => {
  await next()
  // Allow iframes and fullscreen for video players
  c.res.headers.set('X-Frame-Options', 'ALLOWALL')
  c.res.headers.set('Permissions-Policy', 'fullscreen=*, autoplay=*')
  c.res.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none')
  c.res.headers.set('Cross-Origin-Opener-Policy', 'unsafe-none')
  c.res.headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
})

app.use('*', logger())

// ─── Routes ──────────────────────────────────────────────────────────────────
app.route('/movies', movies)
app.route('/anime',  anime)
app.route('/manga',  manga)
app.route('/books',  books)
app.route('/meta',   meta)
app.route('/news',   news)
app.route('/health', health)

// ─── Root — dynamically built endpoint map ───────────────────────────────────
app.get('/', (c) => {
  return c.json({
    name:         'Oracine',
    version:      '2.0.0',
    description:  'Universal media streaming and content API — movies, anime, manga, books, news',
    powered_by:   'Oracine',
    built_by:     'Jaden Afrix',
    organization: 'Oracron',
    status:       'online',

    features: [
      'Automatic source fallback — no broken endpoints',
      'Parallel source racing — fastest source wins',
      'Quality filtering on all stream endpoints',
      'Download links on every streamable source',
      'Fullscreen + iframe embedding enabled',
      'CORS open for all video player clients',
      'News feed via Anime News Network',
      'Advanced search with genre/year/status/season filters',
    ],

    endpoints: {
      movies: {
        search:   'GET /movies/search?q=&page=&type=[all|western|asian]',
        info:     'GET /movies/info?id=&source=[optional]',
        stream:   'GET /movies/stream?episodeId=&mediaId=&source=[optional]&quality=[360p|480p|720p|1080p]',
        download: 'GET /movies/download?episodeId=&mediaId=&source=[optional]&quality=[optional]',
        servers:  'GET /movies/servers?episodeId=&mediaId=&source=[optional]',
        trending: 'GET /movies/trending?type=[movie|tv]',
        recent:   'GET /movies/recent?type=[movie|tv]',
        genre:    'GET /movies/genre?genre=&page=',
        country:  'GET /movies/country?country=&page=',
        sources:  'GET /movies/sources',
      },
      anime: {
        search:          'GET /anime/search?q=&page=',
        advanced_search: 'GET /anime/advanced-search?q=&type=&format=&year=&status=&season=&genres=&sort=&page=&perPage=',
        info:            'GET /anime/info?id=&source=[optional]',
        stream:          'GET /anime/stream?episodeId=&source=[optional]&quality=[360p|480p|720p|1080p]',
        download:        'GET /anime/download?episodeId=&source=[optional]&quality=[optional]',
        servers:         'GET /anime/servers?episodeId=&source=[optional]',
        trending:        'GET /anime/trending?page=&perPage=',
        popular:         'GET /anime/popular?page=&perPage=',
        recent:          'GET /anime/recent?page=&perPage=',
        schedule:        'GET /anime/schedule?page=&weekStart=[0-6]&weekEnd=[0-6]',
        genre:           'GET /anime/genre?genre=&page=&perPage=',
        genres_list:     'GET /anime/genres-list',
        random:          'GET /anime/random',
        sources:         'GET /anime/sources',
      },
      manga: {
        search:         'GET /manga/search?q=&page=',
        info:           'GET /manga/info?id=&source=[optional]',
        read:           'GET /manga/read?chapterId=&source=[optional]',
        popular:        'GET /manga/popular?page=',
        recent:         'GET /manga/recent?page=',
        latest_updates: 'GET /manga/latest-updates?page=',
        random:         'GET /manga/random',
        sources:        'GET /manga/sources',
      },
      books: {
        search:        'GET /books/search?q=&page=',
        info:          'GET /books/info?url=',
        novel_search:  'GET /books/novels/search?q=&page=',
        novel_info:    'GET /books/novels/info?id=&source=[readlightnovels|novelupdates]',
        novel_read:    'GET /books/novels/read?chapterId=&source=[optional]',
        comic_search:  'GET /books/comics/search?q=',
        comic_info:    'GET /books/comics/info?url=',
        sources:       'GET /books/sources',
      },
      meta: {
        tmdb_search:           'GET /meta/tmdb/search?q=&page=',
        tmdb_info:             'GET /meta/tmdb/info?id=&type=[movie|tv]',
        tmdb_trending:         'GET /meta/tmdb/trending?type=[all|movie|tv]&period=[day|week]&page=',
        tmdb_stream:           'GET /meta/tmdb/stream?id=&quality=[optional]',
        tmdb_download:         'GET /meta/tmdb/download?id=&quality=[optional]',
        anilist_search:        'GET /meta/anilist/search?q=&page=&perPage=',
        anilist_advanced:      'GET /meta/anilist/advanced-search?q=&type=&format=&year=&status=&season=&genres=&sort=&page=',
        anilist_info:          'GET /meta/anilist/info?id=',
        anilist_info_by_id:    'GET /meta/anilist/info-by-id?id=',
        anilist_episodes:      'GET /meta/anilist/episodes?id=&dub=[true|false]&fetchFiller=[true|false]',
        anilist_trending:      'GET /meta/anilist/trending?page=&perPage=',
        anilist_popular:       'GET /meta/anilist/popular?page=&perPage=',
        anilist_recent:        'GET /meta/anilist/recent?page=&perPage=',
        anilist_schedule:      'GET /meta/anilist/schedule?page=&weekStart=&weekEnd=',
        anilist_genre:         'GET /meta/anilist/genre?genres=action,drama&page=',
        anilist_character:     'GET /meta/anilist/character?id=',
        anilist_staff:         'GET /meta/anilist/staff?id=',
        anilist_random:        'GET /meta/anilist/random',
        mal_search:            'GET /meta/mal/search?q=&page=',
        mal_info:              'GET /meta/mal/info?id=',
      },
      news: {
        feeds:  'GET /news/feeds?topic=[anime|manga|games|novels|live-action|music|people|merch|events|industry]',
        info:   'GET /news/info?id=',
        topics: 'GET /news/topics',
      },
      health: {
        all:    'GET /health',
        movies: 'GET /health/movies',
        anime:  'GET /health/anime',
        manga:  'GET /health/manga',
        meta:   'GET /health/meta',
        books:  'GET /health/books',
      },
    },

    sources: {
      movies:  ['flixhq', 'fmovies', 'goku', 'moviehdwatch', 'smashystream', 'ummagurau', 'dramacool', 'kissasian', 'viewasian', 'turkish123'],
      anime:   ['gogoanime', 'zoro', 'animepahe', '9anime', 'animefox', 'animedrive', 'anify', 'crunchyroll', 'bilibili', 'marin', 'animesaturn', 'animeunity', 'monoschinos', 'kickassanime'],
      manga:   ['mangadex', 'comick', 'mangahere', 'mangakakalot', 'mangasee123', 'mangapark', 'mangapill', 'mangareader', 'asurascans', 'flamescans', 'mangahost', 'brmangas', 'readmanga', 'vyvymanga'],
      books:   ['libgen'],
      novels:  ['readlightnovels', 'novelupdates'],
      comics:  ['getcomics'],
      meta:    ['tmdb', 'anilist', 'myanimelist'],
      news:    ['animenewsnetwork'],
    },

    quality_options: ['360p', '480p', '720p', '1080p', '4k'],
    streaming_servers: ['gogocdn', 'streamsb', 'mixdrop', 'mp4upload', 'upcloud', 'vidcloud', 'streamtape', 'vizcloud', 'filemoon', 'smashystream', 'streamhub', 'streamwish', 'vidmoly', 'voe'],
  })
})

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({
    status:       'error',
    code:         404,
    message:      'Endpoint not found',
    powered_by:   'Oracine',
    built_by:     'Jaden Afrix',
    organization: 'Oracron',
    hint:         'Visit / for all available endpoints',
  }, 404)
})

// ─── Global error handler ────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error(`[Oracine Error] ${err.message}`, err.stack)
  return c.json({
    status:       'error',
    code:         500,
    message:      err.message,
    powered_by:   'Oracine',
    built_by:     'Jaden Afrix',
    organization: 'Oracron',
  }, 500)
})

// ─── Start ───────────────────────────────────────────────────────────────────
const port = parseInt(process.env.PORT ?? '3000')

serve({ fetch: app.fetch, port }, () => {
  console.log(`\n╔══════════════════════════════════════╗`)
  console.log(`║        Oracine  v2.0.0               ║`)
  console.log(`║   Built by Jaden Afrix / Oracron     ║`)
  console.log(`╚══════════════════════════════════════╝`)
  console.log(`  Running → http://localhost:${port}\n`)
})
