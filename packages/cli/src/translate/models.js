export const GEMINI_MODEL_LIMITS = {
  'gemini-3-flash-preview': {
    rpm: 5,
  },
  'gemini-3.1-flash-lite-preview': {
    rpm: 15,
  },
}

export function getModelRpm(model) {
  return GEMINI_MODEL_LIMITS[model]?.rpm ?? 5
}
