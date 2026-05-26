import { uuid } from './crypto'

export interface AdItem {
  id: string
  type: 'ad'
}

export function getIndexWithAd(
  originalIndex: number,
  interval: number,
): {
  ad?: AdItem
  indexAd: number
  indexItem: number
} {
  if (interval <= 0) {
    return {
      indexAd: 0,
      indexItem: originalIndex,
    }
  }

  const amountAd = Math.floor(originalIndex / interval)

  const shouldInsertAdAfter = (originalIndex + 1) % interval === 0

  return {
    ad: shouldInsertAdAfter
      ? {
          id: `ad-${uuid()}`,
          type: 'ad',
        }
      : undefined,

    // если это элемент перед рекламой → реклама сразу за ним
    indexAd: shouldInsertAdAfter ? originalIndex + amountAd + 1 : 0,

    // indexItem — смещён с учётом уже вставленных реклам
    indexItem: originalIndex + amountAd,
  }
}

export function getOriginalIndex(adIndex: number, interval: number): number {
  if (interval <= 0) {
    return adIndex
  }

  // сколько реклам вставлено ДО текущего индекса
  const amountAdBefore = Math.floor((adIndex + 1) / (interval + 1))

  // если это сама реклама — возвращаем индекс последнего айтема перед ней
  const isAd = (adIndex + 1) % (interval + 1) === 0

  if (isAd) {
    return adIndex - amountAdBefore
  }

  // если это обычный айтем — вычитаем количество реклам до него
  return adIndex - amountAdBefore
}

export function getTotalWithAds(total: number, interval: number): number {
  if (total < interval || interval === 0) {
    return total
  }

  const amountAd = Math.floor(total / interval)
  return total + amountAd
}

export function isAdItem(item: unknown): item is AdItem {
  return typeof item === 'object' && item !== null && 'type' in item && item.type === 'ad'
}
