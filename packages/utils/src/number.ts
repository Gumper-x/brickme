import { isFloat } from './checkup'

export function calculateScale(
  original: { height: number; width: number },
  displayed: { height: number; width: number },
): { scaleHeight: number; scaleWidth: number } {
  const scaleWidth = displayed.width / original.width
  const scaleHeight = displayed.height / original.height

  return { scaleHeight, scaleWidth }
}

export function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value))
}

export function convertSize(
  value: number,
  unitFrom: 'b' | 'gb' | 'kb' | 'mb' | 'pb' | 'tb',
  unitTo: 'b' | 'gb' | 'kb' | 'mb' | 'pb' | 'tb',
  binary = false,
): number {
  const base = binary ? 1024 : 1000

  const units: Record<typeof unitFrom, number> = {
    b: 1,
    gb: base ** 3,
    kb: base,
    mb: base ** 2,
    pb: base ** 5,
    tb: base ** 4,
  }

  if (!(unitFrom in units) || !(unitTo in units)) {
    throw new Error(`Unknown unit: ${unitFrom} → ${unitTo}`)
  }

  // Переводим в байты → переводим в целевую единицу
  const bytes = value * units[unitFrom]
  return bytes / units[unitTo]
}

export function formatPercent(decimal: null | string | undefined): string {
  const value = parseFloat(decimal || '0')
  if (isNaN(value)) {
    return '0.00%'
  }
  return `${value.toFixed(2)}%`
}

export function getAspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) {
    throw new Error('Width and height must be positive numbers.')
  }

  const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b)
  }

  const divisor = gcd(width, height)
  return `${width / divisor}/${height / divisor}`
}

export function getDigit(number: number): string {
  return number.toString().split('.')[1] || ''
}

export function getRandom(min: number, max: number): number {
  const hasFloat = isFloat(min) || isFloat(max)
  return hasFloat ? Math.random() * (max - min) + min : Math.floor(Math.random() * (max - min + 1)) + min
}

export function getRandomMedian(min: number, max: number, median: number): number {
  const offset = (median - min) / (max - min)
  const invertedOffset = 1 - offset

  let random = Math.random()
  if (random > invertedOffset) {
    random = offset + ((random - invertedOffset) / offset) * (1 - offset)
  } else {
    random = (random / invertedOffset) * offset
  }

  return min + random * (max - min)
}

export function subFloat(number: number, digits: number): number {
  if (!Number.isFinite(number)) {
    return number
  }

  const [int, dec = ''] = String(number).split('.')
  if (dec.length <= digits) {
    return number
  }

  return Number(int + (digits > 0 ? `.${dec.slice(0, digits)}` : ''))
}
