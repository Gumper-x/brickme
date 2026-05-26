const HELP_CENTER_LOCALE_ALIAS: Record<string, string> = {
  cz: 'cs',
  dk: 'da',
  se: 'sv',
}

const HELP_CENTER_FALLBACK_LOCALES = new Set(['no'])

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

export function getHelpCenterLocale(locale = 'en'): string {
  const normalizedLocale = locale.toLowerCase()

  if (HELP_CENTER_FALLBACK_LOCALES.has(normalizedLocale)) {
    return 'en'
  }

  return HELP_CENTER_LOCALE_ALIAS[normalizedLocale] ?? normalizedLocale
}

export function makeEmailsClickable(text: string, theme: 'blue' | 'green' | 'purple' | 'red' = 'blue'): string {
  const emailRegex = /(\w+(?:\.\w+)*\[AT\][\w.-]+\.\w{2,})/g

  const colorClasses = {
    blue: 'text-blue-400 hover:text-blue-300',
    green: 'text-green-400 hover:text-green-300',
    purple: 'text-purple-400 hover:text-purple-300',
    red: 'text-red-400 hover:text-red-300',
  }

  return text.replace(emailRegex, (match) => {
    const email = match.replace(/\[AT\]/g, '@')
    return `<a href="mailto:${email}" class="${colorClasses[theme]} underline transition-colors">${email}</a>`
  })
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
