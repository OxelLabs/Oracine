# Oracine v2.0.0
**Built by Jaden Afrix / Oracron**

Universal media streaming & content API. Movies, anime, manga, books, news — all in one place. Every endpoint silently tries all sources and returns the first that works. Zero source names exposed to the client.

---

## Setup

```bash
cp .env.example .env
# Add your TMDB_API_KEY in .env
npm install
npm run dev       # development
npm run build && npm start  # production
```

---

## What's New in v2.0.0

- **Download links** on every stream endpoint (`/stream` and `/download`)
- **Quality filtering** — `?quality=1080p` on all stream/download routes
- **Parallel source racing** — fastest source wins, no sequential waiting
- **All sources fixed** — asian sources now fully stream + download
- **KickAssAnime** added to anime sources
- **Ummagurau** added to movie sources
- **News route** — `/news/feeds`, `/news/info` via Anime News Network
- **Advanced search** — `/anime/advanced-search` and `/meta/anilist/advanced-search`
- **AniList extras** — staff, episode lists, info-by-id, schedule
- **Comic info** — `/books/comics/info`
- **TMDB download** — `/meta/tmdb/download`
- **Fullscreen + iframe headers** set for video player embedding
- **CORS** exposes `Range`, `Content-Range`, `Accept-Ranges` for video seeking
- **Health checks** per-category: `/health/movies`, `/health/anime`, `/health/manga`, `/health/meta`, `/health/books`
- **`@hono/node-server` moved to `dependencies`** (was broken in production builds)
- **TMDB_API_KEY** env var — stop using the shared key that gets rate-limited
- **Pagination validation** — `?page=abc` no longer crashes

---

## Endpoints

### Movies
| Method | Path | Params |
|--------|------|--------|
| GET | `/movies/search` | `q`, `page`, `type=[all\|western\|asian]` |
| GET | `/movies/info` | `id`, `source` (optional) |
| GET | `/movies/stream` | `episodeId`, `mediaId`, `source` (opt), `quality` (opt) |
| GET | `/movies/download` | `episodeId`, `mediaId`, `source` (opt), `quality` (opt) |
| GET | `/movies/servers` | `episodeId`, `mediaId`, `source` (opt) |
| GET | `/movies/trending` | `type=[movie\|tv]` |
| GET | `/movies/recent` | `type=[movie\|tv]` |
| GET | `/movies/genre` | `genre`, `page` |
| GET | `/movies/country` | `country`, `page` |
| GET | `/movies/sources` | — |

### Anime
| Method | Path | Params |
|--------|------|--------|
| GET | `/anime/search` | `q`, `page` |
| GET | `/anime/advanced-search` | `q`, `type`, `format`, `year`, `status`, `season`, `genres`, `sort`, `page`, `perPage` |
| GET | `/anime/info` | `id`, `source` (opt) |
| GET | `/anime/stream` | `episodeId`, `source` (opt), `quality` (opt) |
| GET | `/anime/download` | `episodeId`, `source` (opt), `quality` (opt) |
| GET | `/anime/servers` | `episodeId`, `source` (opt) |
| GET | `/anime/trending` | `page`, `perPage` |
| GET | `/anime/popular` | `page`, `perPage` |
| GET | `/anime/recent` | `page`, `perPage` |
| GET | `/anime/schedule` | `page`, `weekStart`, `weekEnd` |
| GET | `/anime/genre` | `genre`, `page` |
| GET | `/anime/genres-list` | — |
| GET | `/anime/random` | — |
| GET | `/anime/sources` | — |

### Manga
| Method | Path | Params |
|--------|------|--------|
| GET | `/manga/search` | `q`, `page` |
| GET | `/manga/info` | `id`, `source` (opt) |
| GET | `/manga/read` | `chapterId`, `source` (opt) |
| GET | `/manga/popular` | `page` |
| GET | `/manga/recent` | `page` |
| GET | `/manga/latest-updates` | `page` |
| GET | `/manga/random` | — |
| GET | `/manga/sources` | — |

### Books
| Method | Path | Params |
|--------|------|--------|
| GET | `/books/search` | `q`, `page` |
| GET | `/books/info` | `url` |
| GET | `/books/novels/search` | `q`, `page` |
| GET | `/books/novels/info` | `id`, `source` (opt) |
| GET | `/books/novels/read` | `chapterId`, `source` (opt) |
| GET | `/books/comics/search` | `q` |
| GET | `/books/comics/info` | `url` |
| GET | `/books/sources` | — |

### Meta
| Method | Path | Params |
|--------|------|--------|
| GET | `/meta/tmdb/search` | `q`, `page` |
| GET | `/meta/tmdb/info` | `id`, `type=[movie\|tv]` |
| GET | `/meta/tmdb/trending` | `type`, `period=[day\|week]`, `page` |
| GET | `/meta/tmdb/stream` | `id`, `quality` (opt) |
| GET | `/meta/tmdb/download` | `id`, `quality` (opt) |
| GET | `/meta/anilist/search` | `q`, `page`, `perPage` |
| GET | `/meta/anilist/advanced-search` | `q`, `type`, `format`, `year`, `status`, `season`, `genres`, `sort`, `page` |
| GET | `/meta/anilist/info` | `id` |
| GET | `/meta/anilist/info-by-id` | `id` |
| GET | `/meta/anilist/episodes` | `id`, `dub`, `fetchFiller` |
| GET | `/meta/anilist/trending` | `page`, `perPage` |
| GET | `/meta/anilist/popular` | `page`, `perPage` |
| GET | `/meta/anilist/recent` | `page`, `perPage` |
| GET | `/meta/anilist/schedule` | `page`, `weekStart`, `weekEnd` |
| GET | `/meta/anilist/genre` | `genres` (comma-sep), `page` |
| GET | `/meta/anilist/character` | `id` |
| GET | `/meta/anilist/staff` | `id` |
| GET | `/meta/anilist/random` | — |
| GET | `/meta/mal/search` | `q`, `page` |
| GET | `/meta/mal/info` | `id` |

### News
| Method | Path | Params |
|--------|------|--------|
| GET | `/news/feeds` | `topic` (opt) |
| GET | `/news/info` | `id` |
| GET | `/news/topics` | — |

### Health
| Method | Path |
|--------|------|
| GET | `/health` |
| GET | `/health/movies` |
| GET | `/health/anime` |
| GET | `/health/manga` |
| GET | `/health/meta` |
| GET | `/health/books` |

---

## Quality Options
`360p` · `480p` · `720p` · `1080p` · `4k`

Pass `?quality=1080p` to any `/stream` or `/download` endpoint. If exact quality isn't available, returns the next highest. If none found, returns all qualities.

## Movie Sources
`flixhq` · `fmovies` · `goku` · `moviehdwatch` · `smashystream` · `ummagurau` · `dramacool` · `kissasian` · `viewasian` · `turkish123`

## Anime Sources
`gogoanime` · `zoro` · `animepahe` · `9anime` · `animefox` · `animedrive` · `anify` · `crunchyroll` · `bilibili` · `marin` · `animesaturn` · `animeunity` · `monoschinos` · `kickassanime`
