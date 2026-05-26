export const APP_META = {
  name: 'Oracine',
  version: '1.0.0',
  description: 'Universal media streaming and content API — movies, anime, manga, light novels, comics, news, metadata',
  powered_by: 'Oracine',
  built_by: 'Jaden Afrix',
  organization: 'Oracron',
} as const

export const RUNTIME = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  env: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  cacheTtl: parseInt(process.env.CACHE_TTL_SECONDS ?? '300', 10),
  rateWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  rateMax: parseInt(process.env.RATE_LIMIT_MAX ?? '120', 10),
  tmdbKey: process.env.TMDB_API_KEY ?? '',
} as const

export const QUALITIES = ['360p', '480p', '720p', '1080p', '1440p', '2160p', '4k'] as const

export const STREAMING_SERVERS = [
  'vidcloud', 'upcloud', 'vidstreaming', 'streamtape', 'streamsb', 'mixdrop',
  'mp4upload', 'filemoon', 'streamwish', 'vidmoly', 'voe', 'birdstream',
  'megacloud', 'streamhg', 'streamhub',
] as const
