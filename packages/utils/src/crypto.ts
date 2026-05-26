export function fastDevHash(data: unknown): string {
  const str = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // преобразовать в 32-битное целое
  }
  return Math.abs(hash).toString(16)
}

export async function hashData(data: unknown): Promise<string> {
  // Быстро сериализуем в строку
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    const encoded = new TextEncoder().encode(JSON.stringify(data))
    const buffer = await subtle.digest('SHA-1', encoded)
    const array = Array.from(new Uint8Array(buffer))
    return array.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  // ⚙️ иначе fallback для дев-режима
  return fastDevHash(data)
}

export function uuid(): string {
  return window && typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : Math.random().toString(36).substring(2, 9) + Date.now().toString()
}
