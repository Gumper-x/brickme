export type VastEventTracker = { event: string; url: string }
export type VastParsed = {
  // Click
  clickThrough: null | string

  clickTrackings: string[]
  duration: null | number

  errorUrls: string[]
  eventTrackers: VastEventTracker[]
  // Linear support
  hasLinear: boolean

  // Tracking
  impressions: string[]
  // Wrapper support
  isWrapper: boolean

  mediaFiles: Array<{
    bitrate: null | number
    delivery: null | string
    height: null | number
    type: null | string
    url: string
    width: null | number
  }>
  // Media
  mediaUrl: null | string

  progressTrackers: VastProgressTracker[]
  skip: null | VastSkip
  vastVersion: null | string
  // VAST 4 extras (optional)
  viewableImpressions: string[]

  wrapperUrl: null | string
}
export type VastProgressTracker = { offset: string; url: string }

export type VastSkip = { type: 'percent'; value: number } | { type: 'seconds'; value: number }

/* ---------------- helpers ---------------- */

type ResolveVastOptions = {
  // если нужно: подставлять baseUrl для относительных wrapperUrl
  baseUrl?: string
  maxDepth?: number
  timeoutMs?: number
}

export function fireVastMany(urls: string[]): void {
  for (const u of urls) {
    fireVastTracking(u)
  }
}

export function fireVastTracking(url: string): void {
  // максимально “тихо”: без CORS, без await
  try {
    // вариант 1: пиксель
    const img = new Image()
    img.src = url
  } catch {
    // вариант 2 (фоллбек)
    try {
      fetch(url, { keepalive: true, mode: 'no-cors' })
    } catch {
      return
    }
  }
}

export function parseProgressOffset(offset: string, duration: number): null | number {
  const raw = offset.trim()
  if (!raw) {
    return null
  }

  if (raw.endsWith('%')) {
    const pct = Number.parseFloat(raw.slice(0, -1))
    if (!Number.isFinite(pct)) {
      return null
    }
    return duration * (pct / 100)
  }

  // "10" => seconds (реально встречается)
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const sec = Number(raw)
    return Number.isFinite(sec) ? sec : null
  }

  // "00:00:10.000"
  return parseTimeToSeconds(raw)
}

export function parseSkipOffset(linearRoot: Element): null | VastSkip {
  const linear = linearRoot.matches('Linear') ? linearRoot : linearRoot.querySelector('Linear')
  if (!linear) {
    return null
  }

  const raw = linear.getAttribute('skipoffset')?.trim()
  if (!raw) {
    return null
  }

  if (raw.endsWith('%')) {
    const pct = Number.parseFloat(raw.slice(0, -1))
    if (!Number.isFinite(pct)) {
      return null
    }
    return { type: 'percent', value: pct / 100 }
  }

  // "5" => 5 seconds (бывает)
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const sec = Number(raw)
    return Number.isFinite(sec) ? { type: 'seconds', value: sec } : null
  }

  return { type: 'seconds', value: parseTimeToSeconds(raw) }
}

export function parseVast(xmlText: string): null | VastParsed {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (xml.querySelector('parsererror')) {
    return null
  }

  const vast = xml.querySelector('VAST')
  if (!vast) {
    return null
  }

  const vastVersion = vast.getAttribute('version') ?? null

  // choose best Ad:
  // 1) InLine that has Linear+MediaFiles
  // 2) any InLine
  // 3) Wrapper
  const ads = Array.from(xml.querySelectorAll('VAST > Ad'))
  const pickInlineWithMedia = ads.find((a) => {
    const inl = a.querySelector('InLine')
    if (!inl) {
      return false
    }
    return Boolean(inl.querySelector('Creatives Creative Linear MediaFiles > MediaFile'))
  })
  const ad =
    pickInlineWithMedia ??
    ads.find((a) => a.querySelector('InLine')) ??
    ads.find((a) => a.querySelector('Wrapper')) ??
    null

  if (!ad) {
    return null
  }

  const inline = ad.querySelector('InLine')
  const wrapper = ad.querySelector('Wrapper')
  const root = (inline ?? wrapper) as Element | null
  if (!root) {
    return null
  }

  const isWrapper = Boolean(wrapper) && !inline
  const wrapperUrl = normalizeUrl(root.querySelector('VASTAdTagURI')?.textContent)

  // Scope to Linear creative when possible
  const linearRoot = root.querySelector('Creatives Creative Linear') ?? root.querySelector('Linear') ?? null

  const hasLinear = Boolean(linearRoot)

  // MediaFiles: only from linear scope (fallback to root if weird feed)
  const mediaScope = linearRoot ?? root
  const mediaFiles = Array.from(mediaScope.querySelectorAll('MediaFiles > MediaFile'))
    .map((node) => ({
      bitrate: (() => {
        const v = node.getAttribute('bitrate')
        const n = v ? Number(v) : null
        return Number.isFinite(n as number) ? (n as number) : null
      })(),
      delivery: node.getAttribute('delivery'),
      height: (() => {
        const v = node.getAttribute('height')
        const n = v ? Number(v) : null
        return Number.isFinite(n as number) ? (n as number) : null
      })(),
      type: node.getAttribute('type'),
      url: normalizeUrl(node.textContent) ?? '',
      width: (() => {
        const v = node.getAttribute('width')
        const n = v ? Number(v) : null
        return Number.isFinite(n as number) ? (n as number) : null
      })(),
    }))
    .filter((m) => Boolean(m.url))

  const mediaUrl = pickBestMediaFile(mediaFiles)

  // Clicks/Tracking: linear scope is more correct
  const trackScope = linearRoot ?? root

  const clickThrough = normalizeUrl(trackScope.querySelector('VideoClicks > ClickThrough')?.textContent)

  const clickTrackings = Array.from(trackScope.querySelectorAll('VideoClicks > ClickTracking'))
    .map((n) => normalizeUrl(n.textContent))
    .filter(Boolean) as string[]

  // Error/Impression are обычно на уровне InLine/Wrapper root
  const errorUrls = Array.from(root.querySelectorAll('Error'))
    .map((n) => normalizeUrl(n.textContent))
    .filter(Boolean) as string[]

  const impressions = Array.from(root.querySelectorAll('Impression'))
    .map((n) => normalizeUrl(n.textContent))
    .filter(Boolean) as string[]

  const progressTrackers = Array.from(trackScope.querySelectorAll('Tracking[event="progress"]'))
    .map((node) => ({
      offset: node.getAttribute('offset')?.trim() ?? '',
      url: normalizeUrl(node.textContent) ?? '',
    }))
    .filter((t) => t.url && t.offset) // offset обязателен, иначе улетит сразу

  const eventTrackers = Array.from(trackScope.querySelectorAll('Tracking'))
    .filter((node) => (node.getAttribute('event') ?? '') !== 'progress')
    .map((node) => ({
      event: (node.getAttribute('event') ?? '').trim(),
      url: normalizeUrl(node.textContent) ?? '',
    }))
    .filter((t) => t.event && t.url)

  const durationNode = trackScope.querySelector('Duration') ?? root.querySelector('Duration')
  const duration = durationNode ? parseTimeToSeconds(normalizeText(durationNode.textContent) ?? '') : null

  const skip = linearRoot ? parseSkipOffset(linearRoot) : null

  // VAST 4: ViewableImpression (optional)
  const viewableImpressions = Array.from(
    root.querySelectorAll(
      'ViewableImpression Viewable, ViewableImpression NotViewable, ViewableImpression ViewUndetermined',
    ),
  )
    .map((n) => normalizeUrl(n.textContent))
    .filter(Boolean) as string[]

  return {
    clickThrough,

    clickTrackings,
    duration,

    errorUrls,
    eventTrackers,
    hasLinear,

    impressions,
    isWrapper,

    mediaFiles,
    mediaUrl,

    progressTrackers,
    skip,
    vastVersion,
    viewableImpressions,

    wrapperUrl,
  }
}

/**
 * resolveVast:
 * - проходит по Wrapper цепочке (до maxDepth)
 * - мерджит impressions/errors/trackers/clickTrackings/viewableImpressions между слоями
 * - возвращает финальный InLine (если дошли)
 */
export async function resolveVast(vastUrl: string, opts: ResolveVastOptions = {}): Promise<null | VastParsed> {
  const maxDepth = opts.maxDepth ?? 5
  const timeoutMs = opts.timeoutMs ?? 10_000

  let currentUrl = vastUrl
  let acc = emptyVast()

  for (let depth = 0; depth <= maxDepth; depth++) {
    const xmlText = await fetchText(currentUrl, timeoutMs)

    const parsed = parseVast(xmlText)
    if (!parsed) {
      return null
    }

    acc = mergeVast(acc, parsed)

    // If it's wrapper -> follow
    if (parsed.isWrapper) {
      const next = parsed.wrapperUrl
      if (!next) {
        return acc // wrapper без ссылки — дальше некуда
      }
      currentUrl = resolveUrlMaybeRelative(next, opts.baseUrl ?? currentUrl)
      continue
    }

    // InLine reached
    return acc
  }

  // exceeded depth
  return acc
}

function emptyVast(): VastParsed {
  return {
    clickThrough: null,

    clickTrackings: [],
    duration: null,

    errorUrls: [],
    eventTrackers: [],
    hasLinear: false,

    impressions: [],
    isWrapper: false,

    mediaFiles: [],
    mediaUrl: null,

    progressTrackers: [],
    skip: null,
    vastVersion: null,
    viewableImpressions: [],

    wrapperUrl: null,
  }
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController()
  const t = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`VAST fetch failed: ${res.status}`)
    }
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

function mergeVast(base: VastParsed, add: VastParsed): VastParsed {
  // base = wrapper-накопление, add = новый слой
  return {
    clickThrough: add.clickThrough ?? base.clickThrough,

    clickTrackings: uniq([...(base.clickTrackings ?? []), ...(add.clickTrackings ?? [])]),
    duration: add.duration ?? base.duration,

    errorUrls: uniq([...(base.errorUrls ?? []), ...(add.errorUrls ?? [])]),
    eventTrackers: uniqBy(
      [...(base.eventTrackers ?? []), ...(add.eventTrackers ?? [])],
      (t) => `${t.event}|${t.url}`,
    ),
    hasLinear: add.hasLinear || base.hasLinear,

    impressions: uniq([...(base.impressions ?? []), ...(add.impressions ?? [])]),
    isWrapper: add.isWrapper,

    mediaFiles: add.mediaFiles.length ? add.mediaFiles : base.mediaFiles,
    mediaUrl: add.mediaUrl ?? base.mediaUrl,

    progressTrackers: uniqBy(
      [...(base.progressTrackers ?? []), ...(add.progressTrackers ?? [])],
      (t) => `${t.offset}|${t.url}`,
    ),
    skip: add.skip ?? base.skip,
    vastVersion: add.vastVersion ?? base.vastVersion,
    viewableImpressions: uniq([...(base.viewableImpressions ?? []), ...(add.viewableImpressions ?? [])]),

    wrapperUrl: add.wrapperUrl ?? base.wrapperUrl,
  }
}

function normalizeText(v: null | string | undefined): null | string {
  const s = (v ?? '').replace(/\s+/g, ' ').trim()
  return s ? s : null
}

function normalizeUrl(v: null | string | undefined): null | string {
  // For URLs лучше выпиливать whitespace полностью (CDATA переносы)
  const s = (v ?? '').replace(/\s+/g, '').trim()
  return s ? s : null
}

/* ---------------- parser ---------------- */

function parseTimeToSeconds(time: string): number {
  const clean = time.trim().replace(',', '.')
  const m = clean.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/)
  if (!m) {
    return 0
  }
  const h = Number(m[1]) || 0
  const min = Number(m[2]) || 0
  const sec = Number(m[3]) || 0
  return h * 3600 + min * 60 + sec
}

/* ---------------- resolver ---------------- */

function pickBestMediaFile(mediaFiles: VastParsed['mediaFiles']): null | string {
  if (!mediaFiles.length) {
    return null
  }

  // priority: mp4 > hls > webm > other, then bitrate
  const typeRank = (t: null | string): number => {
    const v = (t ?? '').toLowerCase()
    if (v === 'video/mp4') {
      return 3
    }
    if (v.includes('mpegurl') || v.includes('m3u8')) {
      return 2
    }
    if (v === 'video/webm') {
      return 1
    }
    return 0
  }

  const scored = mediaFiles
    .map((m) => {
      const rank = typeRank(m.type)
      const br = m.bitrate ?? 0
      const score = rank * 1_000_000 + br
      return { m, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored[0]?.m.url ?? null
}

function resolveUrlMaybeRelative(url: string, baseUrl?: string): string {
  try {
    // already absolute

    new URL(url)
    return url
  } catch {
    if (!baseUrl) {
      return url
    }
    return new URL(url, baseUrl).toString()
  }
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

function uniqBy<T>(arr: T[], key: (v: T) => string): T[] {
  const m = new Map<string, T>()
  for (const v of arr) {
    const k = key(v)
    if (!k) {
      continue
    }
    if (!m.has(k)) {
      m.set(k, v)
    }
  }
  return Array.from(m.values())
}
