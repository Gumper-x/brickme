export function shuffle<T extends unknown[]>(array: T): T {
  return array.toSorted(() => Math.random() - 0.5) as T
}
