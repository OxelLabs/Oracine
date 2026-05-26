# Oracine v1

Universal media streaming and content API — movies, anime, manga, light novels, comics, news, metadata.

Built by **Jaden Afrix** for **Oracron**. Powered by `@consumet/extensions@1.8.8` and Hono.

## Quick start

```bash
npm install
npm run dev
```

Production:

```bash
npm install
npm run build
npm start
```

Server listens on `PORT` (default `3000`).

## Deploy on Railway

1. Create a new Railway project from this repo (or upload the zip).
2. Railway detects `railway.json` / `nixpacks.toml` automatically — no extra configuration required.
3. Set environment variables (optional):
   - `TMDB_API_KEY` — enables `/meta/tmdb/*` with full features.
   - `CORS_ORIGIN` — defaults to `*`.
   - `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `CACHE_TTL_SECONDS`.
4. Healthcheck path: `/health`.

Also ships with a `Dockerfile`, `Procfile` (Heroku/Render/Fly), and `nixpacks.toml`.

## Endpoints

Visit `GET /` for the complete catalog. Top-level groups:

- `/anime/*` — Hianime, AnimePahe, AnimeKai, KickAssAnime, AnimeSaturn, AnimeUnity, AnimeSama
- `/manga/*` — MangaDex, ComicK, MangaHere, MangaPill, MangaReader, AsuraScans, WeebCentral, MangaKakalot
- `/movies/*` — FlixHQ, SFlix, HiMovies, Goku, DramaCool, Turkish123
- `/books/*` — NovelUpdates, GetComics
- `/meta/*` — AniList, AniList-Manga, MyAnimeList, TMDB
- `/news/*` — Anime News Network
- `/health/*` — provider liveness probes

## Features

- Automatic multi-source fallback on every search endpoint
- TTL in-memory cache with eviction
- Per-IP rate limit (configurable)
- Quality filtering (`?quality=720p` etc.)
- Stream-friendly CORS + iframe headers
- Response time + cache stats headers
