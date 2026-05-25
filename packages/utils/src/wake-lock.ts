let wakeLock: null | WakeLockSentinel = null

export function releaseWakeLock(): void {
  if (!wakeLock) {
    return
  }

  wakeLock.release()
  wakeLock = null
}

export async function requestWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) {
    return
  }
  if (wakeLock) {
    return
  } // уже активен

  try {
    wakeLock = await navigator.wakeLock.request('screen')

    wakeLock.addEventListener('release', () => {
      wakeLock = null
    })
  } catch (err) {
    console.warn('WakeLock request failed', err)
  }
}
