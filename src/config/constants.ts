export const APP_META = {
  name: 'Oracine',
  version: '1.1.0',
  description: 'Universal media streaming and content API — movies, anime, manga, light novels, comics, news, metadata, HLS proxy',
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
  rateMax: parseInt(process.env.RATE_LIMIT_MAX ?? '300', 10),
  tmdbKey: process.env.TMDB_API_KEY ?? '',
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS ?? '28000', 10),
  providerTimeoutMs: parseInt(process.env.PROVIDER_TIMEOUT_MS ?? '9000', 10),
  aggregateTimeoutMs: parseInt(process.env.AGGREGATE_TIMEOUT_MS ?? '22000', 10),
  proxyTimeoutMs: parseInt(process.env.PROXY_TIMEOUT_MS ?? '45000', 10),
  proxyEnabled: (process.env.PROXY_ENABLED ?? 'true') !== 'false',
} as const

export const QUALITIES = ['360p', '480p', '720p', '1080p', '1440p', '2160p', '4k'] as const

export const STREAMING_SERVERS = [
  'vidcloud', 'upcloud', 'vidstreaming', 'streamtape', 'streamsb', 'mixdrop',
  'mp4upload', 'filemoon', 'streamwish', 'vidmoly', 'voe', 'birdstream',
  'megacloud', 'streamhg', 'streamhub',
] as const
