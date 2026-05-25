export function isArrayString(value: unknown[]): value is string[] {
  return typeof value[0] === 'string'
}
/**
 * @returns isEmpty('') => true
 * @returns isEmpty([]) => true
 * @returns isEmpty([1]) => false
 * @returns isEmpty([null]) => false
 * @returns isEmpty({}) => true
 * @returns isEmpty({ key: '' }) => false
 * @returns isEmpty(undefined) => true
 * @returns isEmpty(null) => true
 * @returns isEmpty(new Date()) => false
 * @returns isEmpty(new Date('Invalid Date')) => false
 * @returns isEmpty(true) => false
 * @returns isEmpty(false) => false
 * @returns isEmpty(0), 0, false
 * @returns isEmpty(() => undefined) => false
 * @returns isEmpty(Infinity) => false
 * @returns isEmpty(-Infinity) => false
 * @returns isEmpty(new Promise((resolve) => resolve(''))) => true
 */
export function isEmpty<T>(value: T): value is Extract<T, [] | null | undefined> {
  if (typeof value === 'boolean' || typeof value === 'function') {
    return false
  }
  if (typeof value === 'undefined' || value === null || (typeof value === 'string' && value.length === 0)) {
    return true
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return false
  }
  if (Array.isArray(value) && value.length === 0) {
    return true
  }
  if (isDate(value)) {
    return false
  }

  return Object.keys(value).length === 0
}

export function isFloat(value: number): boolean {
  return Number(value) === value && value % 1 !== 0
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}

export function isPromise<T>(value: T): value is T extends Promise<unknown> ? T : never {
  return (
    Boolean(value) &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: () => void })?.then === 'function'
  )
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isValidDate(date: Date | number | string): boolean {
  if (typeof date === 'string') {
    return Boolean(Date.parse(date))
  }
  if (isNaN(date as number)) {
    return false
  }

  return typeof date === 'number' || date instanceof Date
}
function isDate(value: unknown): value is Date {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return true
  }
  return false
}

export const isNonNullable = <T>(value: T): value is NonNullable<T> => {
  return value !== undefined && value !== null
}

export function isElement<T>(value: T): value is Extract<T, Element> {
  return value instanceof Element
}

export function isExternalLink(link: string): boolean {
  const EXTERNAL_LINK_REGEX = /^(?:https?:\/\/|mailto:|tel:)/

  return EXTERNAL_LINK_REGEX.test(link)
}

export function isFormData(value?: FormData | Record<string, unknown> | unknown): value is FormData {
  if (!value) {
    return false
  }
  return (
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).append === 'function' &&
    typeof (value as Record<string, unknown>).has === 'function'
  )
}

export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

export function isInAppWebView(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const ua = window.navigator.userAgent || window.navigator.vendor || ''

  if (/Instagram/i.test(ua)) {
    return true
  }

  if (/FBAN|FBAV|FB_IAB|FBIOS|FBSS/i.test(ua)) {
    return true
  }

  if (/TikTok|musical_ly|BytedanceWebview|ByteLocale/i.test(ua)) {
    return true
  }

  if (/Twitter/i.test(ua)) {
    return true
  }

  if (/Snapchat/i.test(ua)) {
    return true
  }

  if (/Line\//i.test(ua)) {
    return true
  }

  if (/MicroMessenger/i.test(ua)) {
    return true
  }

  if (/LinkedInApp/i.test(ua)) {
    return true
  }

  if (/Pinterest/i.test(ua)) {
    return true
  }

  if (/Android.+wv\)/i.test(ua) || /; wv\)/i.test(ua)) {
    return true
  }

  if (/iPhone|iPad|iPod/i.test(ua) && !/Safari/i.test(ua)) {
    return true
  }

  if (isTelegram()) {
    return true
  }

  return false
}

export function isTelegram(): boolean {
  return (
    /tgWebAppData/.test(window?.location?.hash) ||
    'Telegram' in window ||
    Boolean(sessionStorage.getItem('telegram-uri-hash'))
  )
}

export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.maxTouchPoints > 0
}
