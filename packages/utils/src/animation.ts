export type Keyframe<T> = {
  _bezier?: Bezier
  easing: 'linear' | [number, number, number, number]
  time: number
  values: T
}

type AnimateOptions<T extends Record<string, number>> = {
  duration: number
  easing?: EasingName
  from: T
  onUpdate: (values: T) => void
  to: T
}

type Bezier = {
  solve: (x: number, epsilon: number) => number
}

type EasingName =
  | 'easeInCubic'
  | 'easeInOutCubic'
  | 'easeInOutQuad'
  | 'easeInOutQuart'
  | 'easeInOutQuint'
  | 'easeInQuad'
  | 'easeInQuart'
  | 'easeInQuint'
  | 'easeOutQuad'
  | 'linear'

export class Animation<T extends Record<string, number | number[]>> {
  isCompleted: boolean
  keys: Keyframe<T>[]
  result: T
  resultKeys: string[]

  constructor(keys: Keyframe<T>[]) {
    this.isCompleted = false
    this.keys = keys
    this.resultKeys = Object.keys(keys[0]?.values || {})
    this.result = JSON.parse(JSON.stringify(keys[0]?.values || {})) as T

    this.keys.forEach((key) => {
      if (Array.isArray(key.easing)) {
        key._bezier = bezier(key.easing[0], key.easing[1], key.easing[2], key.easing[3])
      }
    })
  }

  getValues(time: number): T {
    let currentKey: Keyframe<T> | undefined
    let nextKey: Keyframe<T> | undefined

    for (let i = this.keys.length - 1; i >= 0; i--) {
      if ((this.keys[i]?.time || 0) <= time) {
        currentKey = this.keys[i]
        nextKey = this.keys[i + 1] || this.keys[i]
        break
      }
    }

    if (!currentKey) {
      currentKey = this.keys[this.keys.length - 1]
      nextKey = this.keys[this.keys.length - 1]
    }

    if (currentKey && nextKey) {
      const startTime = currentKey.time || 0
      const endTime = nextKey.time || 0

      let keyTime = Math.min(1, (time - startTime) / (endTime - startTime))
      if (endTime - startTime <= 0) {
        keyTime = 1
      }

      let easedKeyTime = keyTime
      if (Array.isArray(nextKey.easing) && nextKey._bezier) {
        easedKeyTime = nextKey._bezier.solve(keyTime, 0.001)
      }

      this.resultKeys.forEach((key) => {
        const startValue = currentKey.values[key]
        const endValue = nextKey.values[key]

        if (Array.isArray(startValue)) {
          if (!Array.isArray(endValue) || !Array.isArray(this.result[key])) {
            return
          }

          for (let i = 0; i < startValue.length; i++) {
            this.result[key][i] = interpolation(startValue[i] || 0, endValue[i] || 0, easedKeyTime)
          }

          return
        }

        this.result[key as keyof T] = interpolation(
          Number(startValue),
          Number(endValue),
          easedKeyTime,
        ) as T[string]
      })
    }

    const lastKey = this.keys[this.keys.length - 1]
    if (lastKey) {
      this.isCompleted = time >= lastKey.time
    }

    return this.result
  }
}
const easingFunctions: Record<EasingName, (t: number) => number> = {
  easeInCubic: (t) => t * t * t,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - (-2 * t + 2) ** 4 / 2),
  easeInOutQuint: (t) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - (-2 * t + 2) ** 5 / 2),
  easeInQuad: (t) => t * t,
  easeInQuart: (t) => t * t * t * t,
  easeInQuint: (t) => t * t * t * t * t,
  easeOutQuad: (t) => t * (2 - t),
  linear: (t) => t,
}

export function animate<T extends Record<string, number>>({
  duration,
  easing = 'easeInOutCubic',
  from,
  onUpdate,
  to,
}: AnimateOptions<T>): Promise<void> {
  if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
    onUpdate(to)
    return Promise.resolve()
  }

  const start = performance.now()
  const keys = Object.keys(from) as (keyof T)[]
  const ease = easingFunctions[easing] ?? easingFunctions.easeInOutCubic

  return new Promise<void>((resolve) => {
    const frame = (now: number): void => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = ease(progress)

      const current = {} as T
      for (const key of keys) {
        current[key] = interpolation(from[key], to[key], eased) as T[keyof T]
      }

      onUpdate(current)

      if (progress < 1) {
        requestAnimationFrame(frame)
        return
      }

      onUpdate(to)
      resolve()
    }

    requestAnimationFrame(frame)
  })
}

function bezier(p1x: number, p1y: number, p2x: number, p2y: number): Bezier {
  const cx = 3.0 * p1x
  const bx = 3.0 * (p2x - p1x) - cx
  const ax = 1.0 - cx - bx
  const cy = 3.0 * p1y
  const by = 3.0 * (p2y - p1y) - cy
  const ay = 1.0 - cy - by

  const sampleCurveDerivativeX = (t: number): number => (3.0 * ax * t + 2.0 * bx) * t + cx
  const sampleCurveX = (t: number): number => ((ax * t + bx) * t + cx) * t
  const sampleCurveY = (t: number): number => ((ay * t + by) * t + cy) * t

  const solveCurveX = (x: number, epsilon: number): number => {
    let t0 = 0
    let t1 = 1
    let t2 = x

    for (let i = 0; i < 8; i++) {
      const x2 = sampleCurveX(t2) - x
      if (Math.abs(x2) < epsilon) {
        return t2
      }

      const d2 = sampleCurveDerivativeX(t2)
      if (Math.abs(d2) < 1e-6) {
        break
      }

      t2 -= x2 / d2
    }

    if (t2 < t0) {
      return t0
    }
    if (t2 > t1) {
      return t1
    }

    while (t0 < t1) {
      const x2 = sampleCurveX(t2)
      if (Math.abs(x2 - x) < epsilon) {
        return t2
      }

      if (x > x2) {
        t0 = t2
      } else {
        t1 = t2
      }

      t2 = (t1 - t0) * 0.5 + t0
    }

    return t2
  }

  return {
    solve: (x: number, epsilon: number) => sampleCurveY(solveCurveX(x, epsilon)),
  }
}

function interpolation(a: number, b: number, time: number): number {
  return a + (b - a) * time
}
