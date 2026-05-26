import { Hono } from 'hono'
import { comicProviders, NOVEL_KEYS, novelProviders, COMIC_KEYS, pickNovel } from '../providers/registry.js'
import { ok, fail } from '../utils/response.js'
import { withTimeout } from '../utils/fallback.js'
import { cached } from '../utils/cache.js'

const router = new Hono()

router.get('/sources', (c) =>
  c.json(ok({ novels: NOVEL_KEYS, comics: COMIC_KEYS })),
)

router.get('/novels/search', async (c) => {
  const q = c.req.query('q')?.trim()
  if (!q) return c.json(fail('q is required'), 400)
  try {
    const data = await withTimeout(
      (novelProviders.novelupdates as any).search(q),
      20000,
      'novelupdates',
    )
    return c.json(ok(data, { source: 'novelupdates' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'novel search failed', 502), 502)
  }
})

router.get('/novels/info', async (c) => {
  const id = c.req.query('id')
  const source = c.req.query('source') ?? 'novelupdates'
  const chapterPage = c.req.query('chapterPage') ? parseInt(c.req.query('chapterPage')!, 10) : undefined
  if (!id) return c.json(fail('id is required'), 400)
  try {
    const provider = pickNovel(source) as any
    const data = await cached(`novel:info:${source}:${id}:${chapterPage ?? 0}`, 600, () =>
      withTimeout(provider.fetchLightNovelInfo(id, chapterPage), 25000, source),
    )
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'novel info failed', 502), 502)
  }
})

router.get('/novels/read', async (c) => {
  const chapterId = c.req.query('chapterId')
  const source = c.req.query('source') ?? 'novelupdates'
  if (!chapterId) return c.json(fail('chapterId is required'), 400)
  try {
    const provider = pickNovel(source) as any
    const data = await withTimeout(
      provider.fetchChapterContent(chapterId),
      25000,
      source,
    )
    return c.json(ok(data, { source: provider.name }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'novel read failed', 502), 502)
  }
})

router.get('/comics/search', async (c) => {
  const q = c.req.query('q')?.trim()
  const page = parseInt(c.req.query('page') ?? '1', 10)
  if (!q) return c.json(fail('q is required'), 400)
  try {
    const data = await withTimeout(
      (comicProviders.getcomics as any).search(q, page),
      20000,
      'getcomics',
    )
    return c.json(ok(data, { source: 'getcomics' }))
  } catch (err: any) {
    return c.json(fail(err.message ?? 'comic search failed', 502), 502)
  }
})

export default router
