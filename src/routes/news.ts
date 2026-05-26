import { Hono } from 'hono'
import { NEWS } from '@consumet/extensions'
import { newsProviders } from '../providers/registry.js'
import { ok, fail } from '../utils/response.js'
import { withTimeout } from '../utils/fallback.js'
import { cached } from '../utils/cache.js'

const router = new Hono()

const TOPICS = [
  'anime', 'manga', 'games', 'novels', 'live-action',
  'music', 'people', 'merch', 'events', 'industry',
]

router.get('/topics', (c) => c.json(ok({ topics: TOPICS })))

router.get('/feeds', async (c) => {
  const topic = (c.req.query('topic') ?? 'anime') as any
  try {
    const data = await cached(`news:feeds:${topic}`, 300, () =>
      withTimeout((newsProviders.ann as any).fetchNewsFeeds(topic), 20000, 'ann'),
    )
    const summary = ((data as any) ?? []).map((n: any) => ({
      title: n.title,
      id: n.id,
      uploadedAt: n.uploadedAt,
      topics: n.topics,
      preview: n.preview,
      thumbnail: n.thumbnail,
      url: n.url,
    }))
    return c.json(ok(summary, { source: 'animenewsnetwork', topic }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'news feeds failed', 502), 502)
  }
})

router.get('/info', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const data = await cached(`news:info:${id}`, 600, () =>
      withTimeout((newsProviders.ann as any).fetchNewsInfo(id), 20000, 'ann'),
    )
    return c.json(ok(data, { source: 'animenewsnetwork' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'news info failed', 502), 502)
  }
})

export default router
