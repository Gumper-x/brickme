export function detectLocale(availableLocales: string[], fallback = 'en'): string {
  if (typeof navigator === 'undefined') {
    return fallback
  }

  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]

  for (const lang of languages) {
    const short = lang.toLowerCase().split('-')[0]

    if (availableLocales.includes(short)) {
      return short
    }
  }

  return fallback
}

export function getCountryName(locale: string, country: string): string {
  const normalizedCountry = String(country).toUpperCase()

  if (!Intl.DisplayNames) {
    return normalizedCountry
  }

  const regionNames = new Intl.DisplayNames([locale], { type: 'region' })
  return String(regionNames.of(normalizedCountry) ?? normalizedCountry)
}

export function sprintfTranslate(
  translate: string,
  params: (number | string)[] | Record<string, number | string>,
): string {
  if (Array.isArray(params)) {
    let result = translate

    for (const param of params) {
      result = result.replace('%s', param.toString())
    }

    return result
  }

  return translate.replace(/%\(([^)]+)\)s/g, (_, key): string => {
    return String(params[key]) || ''
  })
}
