interface Spread {
  day: number
  hour: number
  minute: number
  month: number
  second: number
  year: number
}

export function convertToTimezone(date: Date = new Date(), timeZone = 'UTC'): Date {
  return new Date(Date.parse(date.toLocaleString('en-US', { timeZone })))
}

export function createDateFromUnix(date: number): Date {
  return new Date(date * 1000)
}

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  delay: number,
  handler: T,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>

  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => handler(...args), delay)
  }
}

export function formatDate(date: Date, format: string): string {
  const formatter = (value: number): string => String(value).padStart(2, '0')
  const spread = getSpreadDate(date)

  return format
    .replaceAll('YYYY', formatter(spread.year))
    .replaceAll('MM', formatter(spread.month))
    .replaceAll('DD', formatter(spread.day))
    .replaceAll('HH', formatter(spread.hour))
    .replaceAll('mm', formatter(spread.minute))
    .replaceAll('ss', formatter(spread.second))
}

export function formatTime(sec: number): string {
  const seconds = Math.max(0, Math.floor(sec))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const tailSeconds = seconds % 60

  const paddedMinutes = minutes < 10 ? `0${minutes}` : String(minutes)
  const paddedSeconds = tailSeconds < 10 ? `0${tailSeconds}` : String(tailSeconds)

  if (hours > 0) {
    const paddedHours = hours < 10 ? `0${hours}` : String(hours)
    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`
  }

  return `${paddedMinutes}:${paddedSeconds}`
}

export function getCooldownTimer(cooldown: number): Record<string, number> {
  const time = Number(cooldown)

  return {
    days: Math.floor((time % (60 * 60 * 24 * 365)) / (60 * 60 * 24)),
    hours: Math.floor((time % (60 * 60 * 24)) / (60 * 60)),
    minutes: Math.floor((time % (60 * 60)) / 60),
    seconds: Math.floor(time % 60),
    years: Math.floor(time / (60 * 60 * 24 * 365)),
  }
}

export function getDateAgo(
  date: Date | number,
  locale: string = 'en',
  style: Intl.RelativeTimeFormatStyle = 'long',
): string {
  const time = typeof date === 'number' ? date : date.getTime()
  const now = Date.now()
  const diffInSeconds = Math.floor((now - time * 1000) / 1000)

  const relativeFormatter = new Intl.RelativeTimeFormat(locale, {
    numeric: locale ? 'always' : 'auto',
    style,
  })

  if (diffInSeconds < 60) {
    return relativeFormatter.format(-diffInSeconds, 'second').replace(/^[+-]/g, '')
  }
  if (diffInSeconds < 3600) {
    return relativeFormatter.format(-Math.floor(diffInSeconds / 60), 'minute').replace(/^[+-]/g, '')
  }
  if (diffInSeconds < 86400) {
    return relativeFormatter.format(-Math.floor(diffInSeconds / 3600), 'hour').replace(/^[+-]/g, '')
  }

  return relativeFormatter.format(-Math.floor(diffInSeconds / 86400), 'day').replace(/^[+-]/g, '')
}

export function getFirstDayOfWeek(date: Date): Date {
  const value = new Date(date)
  const dayOfWeek = value.getDay()
  const firstDayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  return new Date(value.setDate(value.getDate() - firstDayOffset))
}

export function getLastDayOfWeek(date: Date): Date {
  const value = new Date(date)
  const currentDay = value.getDay()
  const lastDay = currentDay === 0 ? 6 : currentDay - 1
  return new Date(value.setDate(value.getDate() + (6 - lastDay)))
}

export function getRetryDelay(attempt: number, baseDelay: number): number {
  return Math.random() * baseDelay * 2 ** attempt
}

export function getSpreadDate(date: Date): Spread {
  return {
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    month: date.getMonth() + 1,
    second: date.getSeconds(),
    year: date.getFullYear(),
  }
}

export function secondToMillisecond(second: number): number {
  return second * 1000
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  delay: number,
  handler: T,
): (...args: Parameters<T>) => void {
  let lastUse = 0

  return (...args: Parameters<T>) => {
    const now = Date.now()

    if (lastUse + delay < now) {
      if (handler(...args) !== false) {
        lastUse = now
      }
    }
  }
}

export function toTime(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isFinite(time) ? time : 0
  }
  if (typeof value === 'string') {
    const time = Date.parse(value)
    return Number.isFinite(time) ? time : 0
  }

  return 0
}

export function waitUntil(condition: () => boolean, timeout = 1000000): Promise<void> {
  return new Promise((resolve) => {
    const intervalTime = 50
    let elapsed = 0

    if (condition()) {
      resolve()
      return
    }

    const interval = setInterval(() => {
      elapsed += intervalTime

      if (condition() || elapsed > timeout) {
        clearInterval(interval)
        resolve()
      }
    }, intervalTime)
  })
}
