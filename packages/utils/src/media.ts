export type Cue = {
  end: number
  h: number
  sprite: string
  start: number
  w: number
  x: number
  y: number
}

export async function download(url: string, filename: string): Promise<void> {
  const response = await fetch(url)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.click()

  URL.revokeObjectURL(objectUrl)
}

export function formatVideoDuration(durationSeconds: number): string {
  const hours = Math.floor(durationSeconds / 3600)
  const minutes = Math.floor((durationSeconds % 3600) / 60)
  const seconds = Math.floor(durationSeconds % 60)

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatVideoQuality(height: number, width: number): string {
  const aspectRatio = width / height
  const base = aspectRatio < 1 ? width : height

  const qualitySteps = [
    { label: '8K', min: 4320 },
    { label: '4K', min: 2160 },
    { label: '2K', min: 1440 },
    { label: '1080p', min: 1080 },
    { label: '720p', min: 720 },
    { label: '576p', min: 576 },
    { label: '480p', min: 480 },
    { label: '360p', min: 360 },
    { label: '240p', min: 240 },
  ]

  return qualitySteps.find((item) => base >= item.min)?.label ?? 'Unknown'
}

export function getCueForTime(time: number, cues: Cue[]): Cue | null {
  let low = 0
  let high = cues.length - 1

  while (low <= high) {
    const mid = (low + high) >> 1
    const cue = cues[mid]

    if (time < cue.start) {
      high = mid - 1
    } else {
      low = mid + 1
    }
  }

  return cues[high] ?? null
}

export function getExtension(value: string): string {
  return value.slice(value.lastIndexOf('.')).toLocaleLowerCase()
}

export function getImageDimensions(file: File): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ height: image.height, width: image.width })
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    image.src = url
  })
}

export function getVideoFit(width: number, height: number): 'contain' | 'cover' {
  if (width > height) {
    return 'contain'
  }

  return width / height > 0.85 ? 'contain' : 'cover'
}

export function getVideoFrameBlobUrl(videoUrl: string, timeInSeconds = 0): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = videoUrl

    const targetTime = Math.max(timeInSeconds + 0.04, 0.04)
    let done = false

    const cleanup = (): void => {
      video.pause()
      video.src = ''
      video.load()
      video.remove()
    }

    const capture = (): void => {
      if (done || video.readyState < 2) {
        return
      }

      done = true

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1
      canvas.height = video.videoHeight || 1

      const context = canvas.getContext('2d')
      if (!context) {
        cleanup()
        reject(new Error('Failed to get canvas context'))
        return
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        cleanup()

        if (!blob) {
          reject(new Error('Failed to create preview blob'))
          return
        }

        resolve(URL.createObjectURL(blob))
      }, 'image/jpeg')
    }

    const fail = (error: unknown): void => {
      if (done) {
        return
      }

      done = true
      cleanup()
      reject(error instanceof Event ? ((error as unknown as { error?: unknown }).error ?? error) : error)
    }

    video.addEventListener('seeked', capture)
    video.addEventListener('timeupdate', capture)
    video.addEventListener('canplay', capture, { once: true })
    video.addEventListener('error', fail, { once: true })
    video.addEventListener(
      'loadedmetadata',
      async () => {
        try {
          video.currentTime = targetTime
        } catch {
          await new Promise((resolveSeek) => setTimeout(resolveSeek, 50))

          try {
            video.currentTime = targetTime
          } catch (error) {
            fail(error)
            return
          }
        }

        try {
          await video.play()
        } catch {
          return
        } finally {
          video.pause()
        }
      },
      { once: true },
    )
  })
}

export function getVideoFrameFile(file: File, timeInSeconds = 0): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true

    const sourceUrl = URL.createObjectURL(file)
    const targetTime = Math.max(timeInSeconds + 0.04, 0.04)
    let done = false

    const cleanup = (): void => {
      video.pause()
      video.src = ''
      video.load()
      video.remove()
      URL.revokeObjectURL(sourceUrl)
    }

    const fail = (error: unknown): void => {
      if (done) {
        return
      }

      done = true
      cleanup()
      reject(error)
    }

    const capture = (): void => {
      if (done || video.readyState < 2) {
        return
      }

      done = true

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1
      canvas.height = video.videoHeight || 1

      const context = canvas.getContext('2d')
      if (!context) {
        fail(new Error('Failed to get canvas context'))
        return
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (!blob) {
          fail(new Error('Failed to create preview blob'))
          return
        }

        const fileName = file.name.replace(/\.[^.]+$/, '') || 'video-frame'
        cleanup()
        resolve(new File([blob], `${fileName}-preview.jpg`, { type: 'image/jpeg' }))
      }, 'image/jpeg')
    }

    video.addEventListener('seeked', capture)
    video.addEventListener('timeupdate', capture)
    video.addEventListener('canplay', capture, { once: true })
    video.addEventListener('error', fail, { once: true })
    video.addEventListener(
      'loadedmetadata',
      async () => {
        try {
          video.currentTime = targetTime
        } catch {
          await new Promise((resolveSeek) => setTimeout(resolveSeek, 50))

          try {
            video.currentTime = targetTime
          } catch (error) {
            fail(error)
            return
          }
        }

        try {
          await video.play()
        } catch {
          return
        } finally {
          video.pause()
        }
      },
      { once: true },
    )

    video.src = sourceUrl
  })
}

export function getVideoMetadata(file: File): Promise<{ duration: number; height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true

    const url = URL.createObjectURL(file)

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({
        duration: video.duration,
        height: video.videoHeight,
        width: video.videoWidth,
      })
    }

    video.onerror = (error) => {
      URL.revokeObjectURL(url)
      reject(error)
    }

    video.src = url
  })
}

export async function hasFileAnimation(fileExtension: string, file: File): Promise<boolean> {
  switch (fileExtension) {
    case '.avif':
      return await isAnimatedAVIF(file)
    case '.png':
      return await isAnimatedPNG(file)
    case '.webp':
      return await isAnimatedWebP(file)
    default:
      return false
  }
}

export function isAnimatedAVIF(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)

    video.src = url
    video.preload = 'metadata'

    video.addEventListener('loadedmetadata', () => {
      resolve(video.duration > 0 && video.duration > 1)
      URL.revokeObjectURL(url)
    })

    video.onerror = () => {
      resolve(false)
      URL.revokeObjectURL(url)
    }
  })
}

export async function isAnimatedPNG(file: File): Promise<boolean> {
  const buffer = await readFileAsUint8Array(file)
  if (!buffer) {
    return false
  }

  const signature = [0x61, 0x63, 0x54, 0x4c]
  return includesSignature(buffer, signature)
}

export async function isAnimatedWebP(file: File): Promise<boolean> {
  const buffer = await readFileAsUint8Array(file)
  if (!buffer) {
    return false
  }

  const signature = [0x41, 0x4e, 0x49, 0x4d]
  return includesSignature(buffer, signature)
}

export function isImage(type: string): boolean {
  return type.startsWith('image/')
}

export function isVideo(type: string): boolean {
  return type.startsWith('video/')
}

export function parseVtt(vtt: string): Cue[] {
  const cues: Cue[] = []
  const lines = vtt.replace(/\r/g, '').split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim()

    if (!line?.includes('-->')) {
      continue
    }

    const [startRaw, endRaw] = line.split('-->').map((part) => part.trim())
    let payload = ''

    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j]?.trim()

      if (!candidate || candidate.includes('-->')) {
        break
      }

      if (candidate.includes('#xywh=')) {
        payload = candidate
        break
      }
    }

    if (!payload) {
      continue
    }

    const [spriteRaw, xywhRaw] = payload.split('#xywh=')
    if (!xywhRaw) {
      continue
    }

    const [x, y, w, h] = xywhRaw.split(',').map(Number)

    cues.push({
      end: toSec(endRaw),
      h,
      sprite: spriteRaw.trim(),
      start: toSec(startRaw),
      w,
      x,
      y,
    })
  }

  return cues.sort((left, right) => left.start - right.start)
}

export function progressStepper<T extends [string, number][]>(steps: T) {
  const mapIndex: Record<string, number> = {}

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (!step) {
      continue
    }

    mapIndex[step[0]] = i
  }

  return (key: T[number][0], percent?: number): number => {
    const currentIndex = mapIndex[key]
    if (typeof currentIndex !== 'number') {
      return 0
    }

    let result = 0

    for (let i = currentIndex; i >= 0; i--) {
      const step = steps[i]
      if (!step) {
        continue
      }

      const value = i === currentIndex && typeof percent === 'number' ? (step[1] * percent) / 100 : step[1]
      result += value
    }

    return result
  }
}

export function resizeImage(inputFileOrUrl: Blob | File | string, maxSize: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new window.Image()

    image.onload = () => {
      const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1)
      const width = Math.round(image.width * ratio)
      const height = Math.round(image.height * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d')
      if (context) {
        context.drawImage(image, 0, 0, width, height)
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create resized image'))
          return
        }

        resolve(new File([blob], 'resized.png', { type: 'image/png' }))
      }, 'image/png')
    }

    image.onerror = reject

    if (inputFileOrUrl instanceof Blob) {
      image.src = URL.createObjectURL(inputFileOrUrl)
      return
    }

    image.src = inputFileOrUrl
  })
}

export function toSec(time: string): number {
  if (!time) {
    return 0
  }

  const parts = time.trim().split(':').map(Number)

  if (parts.length === 1) {
    return parts[0] || 0
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts
    return (minutes || 0) * 60 + (seconds || 0)
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    return (hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0)
  }

  return 0
}

function includesSignature(buffer: Uint8Array, signature: number[]): boolean {
  for (let i = 0; i <= buffer.length - signature.length; i++) {
    if (signature.every((byte, index) => buffer[i + index] === byte)) {
      return true
    }
  }

  return false
}

async function readFileAsUint8Array(file: File): Promise<null | Uint8Array> {
  const reader = new FileReader()

  const result = await new Promise<ArrayBuffer | null>((resolve) => {
    reader.onload = (event) => {
      const value = event.target?.result
      resolve(value instanceof ArrayBuffer ? value : null)
    }
    reader.onerror = () => resolve(null)
    reader.readAsArrayBuffer(file)
  })

  return result ? new Uint8Array(result) : null
}
