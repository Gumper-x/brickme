type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${P1}${Uppercase<P2>}${CamelCase<P3>}`
  : S

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function capitalizeWords(value: string): string {
  return value
    .split(' ')
    .map((item) => capitalize(item))
    .join(' ')
}

export function convertToHex(color: string): string {
  // If color is hex
  if (/^#[0-9a-f]+/i.test(color)) {
    return color.toUpperCase()
  }

  // If color is rgb
  const match = color.match(/^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/)

  if (!match) {
    return color
  }

  const [_, rStr, gStr, bStr] = match
  if (!rStr || !gStr || !bStr) {
    return color
  }

  const r = parseInt(rStr, 10)
  const g = parseInt(gStr, 10)
  const b = parseInt(bStr, 10)

  if ([r, g, b].some((value) => value < 0 || value > 255)) {
    return color
  }

  const toHex = (value: number): string => value.toString(16).padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}
export function convertToRGB(color: string): string {
  // Remove any whitespace and convert to lowercase
  const cleanColor = color.trim().toLowerCase()

  // HEX format (#RRGGBB or #RGB)
  if (cleanColor.startsWith('#')) {
    const hex = cleanColor.slice(1)

    if (hex.length === 3) {
      // Convert short HEX (#RGB) to full HEX (#RRGGBB)
      const [rChar, gChar, bChar] = hex.split('')
      if (!rChar || !gChar || !bChar) {
        return ''
      }

      const r = parseInt(rChar + rChar, 16)
      const g = parseInt(gChar + gChar, 16)
      const b = parseInt(bChar + bChar, 16)
      return `rgb(${r}, ${g}, ${b})`
    }

    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return `rgb(${r}, ${g}, ${b})`
    }

    return '' // Invalid HEX format
  }

  // RGB format (rgb(r, g, b))
  if (cleanColor.startsWith('rgb')) {
    return color
  }
  return ''
}

export function getRootDomain(host: string): string {
  const parts = host.split('.')

  const isIp = /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(host)
  const isLocalhost = /^localhost(?::\d+)?$/.test(host)

  const convert = !isIp && !isLocalhost && parts.length > 2 ? parts.slice(1).join('.') : host
  return convert
}

export function lowerCase<T extends string>(value: T): Lowercase<T> {
  return value.toLowerCase() as Lowercase<T>
}

export function pascalCaseToKebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

export function replaceCharAt(str: string, index: number, char: string): string {
  const arr = str.split('')
  arr[index] = char
  return arr.join('')
}

export function stripQueryAndHash(url: string): string {
  const q = url.indexOf('?')
  const h = url.indexOf('#')

  if (q === -1 && h === -1) {
    return url
  }

  if (q === -1) {
    return url.slice(0, h)
  }
  if (h === -1) {
    return url.slice(0, q)
  }

  return url.slice(0, Math.min(q, h))
}

export function toCamelCase<T extends string>(str: T): CamelCase<T> {
  return str.replace(/_([a-z])/g, (match, p1) => p1.toUpperCase()) as CamelCase<T>
}

export function truncateString(str: null | string | undefined, maxLength: number): string {
  return String(str).length > maxLength ? `${String(str).slice(0, maxLength).trim()}...` : String(str)
}
