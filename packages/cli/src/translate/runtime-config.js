export const DEFAULT_CONTEXT_MODEL = 'gemini-3.1-flash-lite-preview'

let runtimeConfig = null

export function buildTranslateHelp(command = 'brick translate') {
  return `${command}

Required options:
  --product-context "<text>"
  --terminology "<text>"
  --tone "<text>"
  --api-key "<key>"

Optional:
  --context-model "<model>"  Default: ${DEFAULT_CONTEXT_MODEL}

Example:
  ${command} \\
    --product-context "Creators sell adult content collections with free previews and paid unlocks." \\
    --terminology "Collection=content pack; Unlock=paid access; VIP=paid content" \\
    --tone "Natural, modern, conversion-oriented, explicit when source is explicit." \\
    --api-key "your-gemini-api-key" \\
    --context-model "${DEFAULT_CONTEXT_MODEL}"`
}

export function getTranslateRuntimeConfig() {
  if (!runtimeConfig) {
    throw new Error(
      'Translate runtime config is not initialized. Pass --product-context, --terminology, --tone, and --api-key.',
    )
  }

  return runtimeConfig
}

export function parseTranslateRuntimeArgs(rawArgs) {
  const options = {
    apiKey: null,
    contextModel: DEFAULT_CONTEXT_MODEL,
    productContext: null,
    terminology: null,
    tone: null,
  }
  const positional = []

  for (let index = 0; index < rawArgs.length; index += 1) {
    const value = rawArgs[index]

    if (value === '--product-context') {
      options.productContext = rawArgs[index + 1] ?? null
      index += 1
      continue
    }

    if (value === '--terminology') {
      options.terminology = rawArgs[index + 1] ?? null
      index += 1
      continue
    }

    if (value === '--tone') {
      options.tone = rawArgs[index + 1] ?? null
      index += 1
      continue
    }

    if (value === '--api-key') {
      options.apiKey = rawArgs[index + 1] ?? null
      index += 1
      continue
    }

    if (value === '--context-model') {
      options.contextModel = rawArgs[index + 1] ?? DEFAULT_CONTEXT_MODEL
      index += 1
      continue
    }

    positional.push(value)
  }

  return {
    options,
    positional,
  }
}

export function setTranslateRuntimeConfig(config) {
  validateTranslateRuntimeConfig(config)
  runtimeConfig = {
    ...config,
    contextModel: config.contextModel || DEFAULT_CONTEXT_MODEL,
  }
}

export function validateTranslateRuntimeConfig(config) {
  const missing = []

  if (!config.productContext) {
    missing.push('--product-context')
  }

  if (!config.terminology) {
    missing.push('--terminology')
  }

  if (!config.tone) {
    missing.push('--tone')
  }

  if (!config.apiKey) {
    missing.push('--api-key')
  }

  if (missing.length > 0) {
    throw new Error(`Missing required translate options: ${missing.join(', ')}`)
  }
}
