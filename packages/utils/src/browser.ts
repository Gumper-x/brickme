import { isInAppWebView, isTelegram } from './checkup'

export function addScript(script: string): void {
  const scriptNode = document.createElement('script')
  scriptNode.innerHTML = script
  scriptNode.async = true
  document.body.appendChild(scriptNode)
}

export const addScipt = addScript

export function createMarker(id: string): SVGMarkerElement {
  const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker')

  arrow.setAttribute(
    'd',
    'M8.26613 3.66781C9.24462 4.25989 9.24462 5.7401 8.26613 6.33219L4.20161 8.79161C3.22312 9.3837 2 8.64359 2 7.45943L2 2.54057C2 1.35641 3.22312 0.616301 4.20161 1.20838L8.26613 3.66781Z',
  )
  arrow.setAttribute('style', 'fill:#525252;stroke-width:0.801524;stroke-miterlimit:4;stroke-dasharray:none')

  marker.setAttribute('id', id)
  marker.setAttribute('refX', '8.8')
  marker.setAttribute('refY', '5')
  marker.setAttribute('viewBox', '0 0 10 10')
  marker.setAttribute('orient', 'auto-start-reverse')
  marker.setAttribute('markerWidth', '4')
  marker.setAttribute('markerHeight', '4')
  marker.appendChild(arrow)

  return marker
}

export function disableBodyScroll(): void {
  document.body.dataset.block = String(Number(document.body.dataset.block || '0') + 1)

  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  document.body.style.touchAction = 'none'
  document.body.style.overflow = 'hidden'
  document.body.style.paddingRight = `${scrollbarWidth}px`
  document.body.style.setProperty('--brick-scrollbar-offset', `${scrollbarWidth}px`)

  disableIOSSafariBody()
}

export function disableScroll(element = document.documentElement): void {
  element.dataset.block = String(Number(element.dataset.block || '0') + 1)

  const scrollbarWidth =
    element === document.documentElement
      ? window.innerWidth - document.documentElement.clientWidth
      : element.offsetWidth - element.clientWidth

  element.style.touchAction = 'none'
  element.style.overflow = 'hidden'
  element.style.paddingRight = `${scrollbarWidth}px`

  disableScrollBehavior()
}

export function disableScrollBehavior(): void {
  document.body.style.overscrollBehavior = 'none'
}

export function enableBodyScroll(force = false): void {
  if (force) {
    document.body.dataset.block = ''
  }

  if (document.body.dataset.block && Number(document.body.dataset.block) > 1) {
    document.body.dataset.block = String(Number(document.body.dataset.block) - 1)
    return
  }

  document.body.dataset.block = ''
  document.body.style.touchAction = ''
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''
  document.body.style.setProperty('--brick-scrollbar-offset', '0px')

  enableIOSSafariBody()
}

export function enableScroll(force = false, element = document.documentElement): void {
  if (force) {
    element.dataset.block = ''
  }

  if (element.dataset.block && Number(element.dataset.block) > 1) {
    element.dataset.block = String(Number(element.dataset.block) - 1)
    return
  }

  delete element.dataset.block

  element.style.touchAction = ''
  element.style.overflow = ''
  element.style.paddingRight = ''

  enableScrollBehavior()
}

export function enableScrollBehavior(): void {
  document.body.style.overscrollBehavior = ''
}

export function ensureWhiteContrast(color: [number, number, number], minContrast = 4.5): [number, number, number] {
  let [r, g, b] = color

  const whiteLuminance = 1
  let luminanceValue = luminance(r, g, b)

  while (contrast(luminanceValue, whiteLuminance) < minContrast) {
    r *= 0.9
    g *= 0.9
    b *= 0.9

    luminanceValue = luminance(r, g, b)

    if (r < 10 && g < 10 && b < 10) {
      break
    }
  }

  return [Math.round(r), Math.round(g), Math.round(b)]
}

export function getAverageColor(img: HTMLImageElement): Promise<[number, number, number]> {
  return new Promise((resolve, reject) => {
    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const context = canvas.getContext('2d')
    if (!context) {
      reject(new Error('Canvas not supported'))
      return
    }

    context.drawImage(img, 0, 0, size, size)
    const { data } = context.getImageData(0, 0, size, size)

    const buckets = new Map<string, number>()
    const fallbackBuckets = new Map<string, number>()

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3]
      if (alpha < 128) {
        continue
      }

      const r = (data[i] >> 4) << 4
      const g = (data[i + 1] >> 4) << 4
      const b = (data[i + 2] >> 4) << 4

      const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b
      if (brightness < 70) {
        continue
      }

      const maxC = Math.max(r, g, b)
      const minC = Math.min(r, g, b)
      if (maxC - minC < 20) {
        continue
      }

      const [h, s] = rgbToHsv(r, g, b)
      const key = `${r},${g},${b}`

      if (s > 0.35 && h >= 250 && h <= 330) {
        buckets.set(key, (buckets.get(key) ?? 0) + s * 2)
      } else {
        fallbackBuckets.set(key, (fallbackBuckets.get(key) ?? 0) + 1)
      }
    }

    const dominant = buckets.size > 0 ? pickDominantColor(buckets) : pickDominantColor(fallbackBuckets)
    resolve(dominant)
  })
}

export function getAverageColorSrc(src: string): Promise<[number, number, number]> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = src

    image.onload = () => {
      resolve(getAverageColor(image))
    }

    image.onerror = reject
  })
}

export function getDeviceType(): 'android' | 'ios' | 'mac' | 'other' | 'windows' {
  const userAgent = window.navigator.userAgent

  if (/Android/i.test(userAgent)) {
    return 'android'
  }
  if (/iPad|iPhone|iPod/i.test(userAgent)) {
    return 'ios'
  }
  if (/Macintosh|MacIntel|MacPPC|Mac68K/i.test(userAgent) && !('ontouchend' in document)) {
    return 'mac'
  }
  if (/Win32|Win64|Windows|WinCE/i.test(userAgent)) {
    return 'windows'
  }

  return 'other'
}

export function getDistanceToElementEdge(
  element: HTMLElement,
  scrollable: Element,
): {
  bottom: number
  left: number
  right: number
  top: number
} {
  const elementRect = element.getBoundingClientRect()
  const scrollableRect = scrollable.getBoundingClientRect()

  return {
    bottom: scrollableRect.height - (elementRect.bottom - scrollableRect.top),
    left: elementRect.left - scrollableRect.left,
    right: scrollableRect.width - (elementRect.right - scrollableRect.left),
    top: elementRect.top - scrollableRect.top,
  }
}

export async function getImgResolution(src: string): Promise<{ height: number; width: number }> {
  return await new Promise((resolve) => {
    const image = new Image()

    image.onload = () => {
      resolve({
        height: image.height,
        width: image.width,
      })
    }

    image.src = src
  })
}

export function getPlatform(): 'browser' | 'telegram' {
  return isTelegram() ? 'telegram' : 'browser'
}

export function hasDisableScroll(element = document.documentElement): boolean {
  return Boolean(element.dataset.block && Number(element.dataset.block) >= 1)
}

export function isFirefox(): boolean {
  return navigator.userAgent.toLowerCase().includes('firefox')
}

export function isIOSSafari(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const currentWindow = window as Window & { isSafari?: boolean }
  if (currentWindow.isSafari !== undefined) {
    return currentWindow.isSafari
  }

  const userAgent = currentWindow.navigator.userAgent
  currentWindow.isSafari =
    Boolean(userAgent.match(/Safari/i) && !userAgent.match(/Chrome/i) && !userAgent.match(/CriOS/i)) &&
    !userAgent.match(/FxiOS/i)

  return currentWindow.isSafari
}

export function isPWA(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const nav = window.navigator as Navigator & { standalone?: boolean }

  const standaloneDisplay =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches
  const standaloneIos = nav.standalone === true
  const isAndroidApp = document.referrer?.startsWith('android-app://')
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches

  return Boolean(standaloneDisplay || standaloneIos || isAndroidApp || isFullscreen)
}

export function isSafari(): boolean {
  const userAgent = window.navigator.userAgent
  return (
    userAgent.includes('Safari') &&
    !userAgent.includes('Chrome') &&
    !userAgent.includes('CriOS') &&
    !userAgent.includes('FxiOS')
  )
}

export function isSupportVP9(): boolean {
  const video = document.createElement('video')
  return video.canPlayType('video/webm; codecs="vp9"') !== ''
}

export function loadFont(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingLink = document.querySelector(`link[href*="${src}"]`)

    if (existingLink) {
      resolve()
      return
    }

    const link = document.createElement('link')
    link.crossOrigin = ''
    link.rel = 'stylesheet'
    link.href = src
    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`Failed to load font: ${name}`))

    document.head.appendChild(link)
  })
}

export function measureVH(unit: 'lvh' | 'svh'): number {
  const element = document.createElement('div')
  element.style.position = 'fixed'
  element.style.top = '0'
  element.style.height = `100${unit}`
  element.style.pointerEvents = 'none'
  element.style.visibility = 'hidden'

  document.body.appendChild(element)

  const height = element.getBoundingClientRect().height
  document.body.removeChild(element)

  return Math.round(height)
}

export function openUrlSafe(url: string): void {
  openWindow({ url })
}

export function openWindow(option: {
  target?: '_blank' | '_parent' | '_self' | '_top'
  url: string
}): null | WindowProxy {
  if (isInAppWebView()) {
    window.location.href = option.url
    return null
  }

  const width = (80 * window.screen.width) / 100
  const height = (80 * window.screen.height) / 100
  const left = (window.screen.width - width) / 2
  const top = (window.screen.height - height) / 2
  const windowFeatures = `width=${width},height=${height},scrollbars=yes,resizable=yes,left=${left},top=${top}`

  const newWindow = window.open(option.url, option.target ?? '_blank', windowFeatures)

  if (!newWindow) {
    window.location.href = option.url
  }

  return newWindow
}

let payPostLock = false

export function openWindowPost(
  option: {
    action: string
    target?: '_blank' | '_parent' | '_self' | '_top'
  },
  data: {
    name: string
    value?: number | number[] | string | string[]
  }[],
): void {
  if (option.action.includes('/pay')) {
    if (payPostLock) {
      return
    }

    payPostLock = true
    setTimeout(() => {
      payPostLock = false
    }, 1000)
  }

  const form = document.createElement('form')
  form.method = 'POST'
  form.action = option.action

  for (const { name, value } of data) {
    if (value === undefined) {
      continue
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = `${String(name)}[]`
        input.value = String(item)
        form.appendChild(input)
      })
      continue
    }

    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = String(name)
    input.value = String(value)
    form.appendChild(input)
  }

  if (isInAppWebView()) {
    form.target = '_self'
    document.body.appendChild(form)
    form.submit()
    document.body.removeChild(form)
    return
  }

  const width = (80 * window.screen.width) / 100
  const height = (80 * window.screen.height) / 100
  const left = (window.screen.width - width) / 2
  const top = (window.screen.height - height) / 2
  const windowFeatures = `width=${width},height=${height},scrollbars=yes,resizable=yes,left=${left},top=${top}`

  const newWindow = window.open('', option.target ?? '_blank', windowFeatures)

  if (!newWindow?.document?.body) {
    form.target = '_self'
    document.body.appendChild(form)
    form.submit()
    document.body.removeChild(form)
    return
  }

  form.target = option.target ?? '_self'
  newWindow.document.body.appendChild(form)
  form.submit()
}

export function persistentFocus(element: HTMLElement): void {
  let attempts = 0
  const maxAttempts = 10

  const tryFocus = (): void => {
    if (document.activeElement === element) {
      return
    }

    element.focus({ preventScroll: true })
    attempts += 1

    if (attempts < maxAttempts) {
      requestAnimationFrame(tryFocus)
    }
  }

  tryFocus()
}

export function resetHTMLScroll(): void {
  document.documentElement.scrollTop = 0
}

export function safeWindowOpen(url: string, target: '_blank' | '_self' = '_blank'): void {
  if (isInAppWebView()) {
    window.location.href = url
    return
  }

  const newWindow = window.open(url, target)
  if (!newWindow) {
    window.location.href = url
  }
}

export function scrollTo(x: number, y: number): void {
  if (isIOSSafari()) {
    if (document.body.style.position === 'fixed') {
      document.body.style.top = `${-y}px`
    } else {
      window.scrollTo(0, y)
    }

    return
  }

  window.scrollTo(x, y)
}

export function scrollToItemCenter(parent: Element | undefined, item: Element | undefined, yAxis = false): void {
  if (!parent || !item) {
    return
  }

  requestAnimationFrame(() => {
    const parentRect = parent.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()

    let center = itemRect.left + itemRect.width / 2 - (parentRect.left + parentRect.width / 2)
    if (yAxis) {
      center = -(itemRect.top + itemRect.height / 2 - (parentRect.top + parentRect.height / 2))
    }

    const scrollOffset = yAxis ? parent.scrollTop : parent.scrollLeft
    parent.scrollBy({
      behavior: 'smooth',
      [yAxis ? 'top' : 'left']: Math.max(-scrollOffset, center),
    })
  })
}

export async function waitUntilNotEditable(): Promise<void> {
  while (true) {
    const element = document.activeElement as HTMLElement | null

    if (
      !element ||
      (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA' && !element.isContentEditable)
    ) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

let wakeLock: null | WakeLockSentinel = null

export function releaseWakeLock(): void {
  if (!wakeLock) {
    return
  }

  wakeLock.release()
  wakeLock = null
}

export async function requestWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator) || wakeLock) {
    return
  }

  try {
    wakeLock = await navigator.wakeLock.request('screen')
    wakeLock.addEventListener('release', () => {
      wakeLock = null
    })
  } catch (error) {
    console.warn('WakeLock request failed', error)
  }
}

function contrast(l1: number, l2: number): number {
  const bright = Math.max(l1, l2)
  const dark = Math.min(l1, l2)

  return (bright + 0.05) / (dark + 0.05)
}

function disableIOSSafariBody(): void {
  if (!document.body.style.top && isIOSSafari()) {
    document.body.style.top = `-${window.scrollY}px`
    document.body.style.position = 'fixed'
  }
}

function enableIOSSafariBody(): void {
  if (!isIOSSafari()) {
    return
  }

  const bodyTop = parseFloat(document.body.style.top)
  document.body.style.top = ''
  document.body.style.position = ''

  if (bodyTop) {
    document.documentElement.scrollTo({
      behavior: 'instant',
      top: -bodyTop,
    })
  }
}

function luminance(r: number, g: number, b: number): number {
  const rgb = [r, g, b].map((value) => {
    const normalized = value / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function pickDominantColor(colorMap: Map<string, number>): [number, number, number] {
  let max = 0
  let color: [number, number, number] = [0, 0, 0]

  for (const [key, count] of colorMap) {
    if (count > max) {
      max = count
      color = key.split(',').map(Number) as [number, number, number]
    }
  }

  return color
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const red = r / 255
  const green = g / 255
  const blue = b / 255

  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min

  let hue = 0
  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6
    } else if (max === green) {
      hue = (blue - red) / delta + 2
    } else {
      hue = (red - green) / delta + 4
    }

    hue *= 60
    if (hue < 0) {
      hue += 360
    }
  }

  const saturation = max === 0 ? 0 : delta / max

  return [hue, saturation, max]
}
