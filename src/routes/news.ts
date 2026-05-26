import { Hono } from 'hono'
import { NEWS } from '@consumet/extensions'
import { successResponse, errorResponse } from '../utils/fallback.js'

const news = new Hono()

const ann = new NEWS.ANN()

// Valid topics
const TOPICS = ['anime', 'animation', 'manga', 'games', 'novels', 'live-action', 'covid-19', 'industry', 'music', 'people', 'merch', 'events']

// ─── /feeds ──────────────────────────────────────────────────────────────────
news.get('/feeds', async (c) => {
  const topic = c.req.query('topic')

  if (topic && !TOPICS.includes(topic)) {
    return c.json(errorResponse(`Invalid topic. Valid topics: ${TOPICS.join(', ')}`, 400), 400)
  }

  try {
    const data = await ann.fetchNewsFeeds(topic as any)
    return c.json(successResponse(data, 'animenewsnetwork', {
      topic: topic ?? 'all',
      total: (data as any[]).length,
    }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /info ───────────────────────────────────────────────────────────────────
news.get('/info', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json(errorResponse('Query parameter "id" is required', 400), 400)

  try {
    const data = await ann.fetchNewsInfo(id)
    return c.json(successResponse(data, 'animenewsnetwork', { news_id: id }))
  } catch (err: any) {
    return c.json(errorResponse(err.message), 500)
  }
})

// ─── /topics ── list valid topics ────────────────────────────────────────────
news.get('/topics', (c) => {
  return c.json(successResponse(TOPICS, 'static', { total: TOPICS.length }))
})

export default news
