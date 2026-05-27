import { GoogleGenAI } from '@google/genai'

import { getModelRpm } from './models.js'

const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyB2oEO4n6BtDAY157phoQesiWoBk7STGLk'
// process.env.GEMINI_API_KEY || "AIzaSyAtTDRWoIcwL4KgF6sYdp2MHhqLZln-ax8";
const client = new GoogleGenAI({ apiKey })
const modelState = new Map()

export async function generateContentWithLimits({ config, contents, maxRetries = 5, model }) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await waitForModelSlot(model)

    try {
      const response = await client.models.generateContent({
        config,
        contents,
        model,
      })

      markModelRequest(model)
      return response.text ?? ''
    } catch (error) {
      markModelRequest(model)

      if (!isRateLimitError(error)) {
        throw error
      }

      const delayMs = getRetryDelayMs(error, model)
      console.warn(
        `Rate limited for ${model}, retrying in ${Math.ceil(delayMs / 1000)}s (${attempt}/${maxRetries})`,
      )
      await sleep(delayMs)

      if (attempt === maxRetries) {
        throw error
      }
    }
  }

  return ''
}

function getModelState(model) {
  const current = modelState.get(model) ?? {
    nextAllowedAt: 0,
  }

  modelState.set(model, current)
  return current
}

function getRetryDelayMs(error, model) {
  const retryFromDetails = parseRetryDelayFromDetails(error)

  if (retryFromDetails !== null) {
    return retryFromDetails
  }

  const rpm = Math.max(getModelRpm(model), 1)
  return Math.ceil(60000 / rpm)
}

function isRateLimitError(error) {
  return error?.status === 429
}

function markModelRequest(model) {
  const state = getModelState(model)
  const rpm = Math.max(getModelRpm(model), 1)
  const intervalMs = Math.ceil(60000 / rpm)

  state.nextAllowedAt = Math.max(state.nextAllowedAt, Date.now()) + intervalMs
}

function parseDurationMs(value) {
  const match = String(value).match(/^([\d.]+)s$/i)

  if (!match) {
    return null
  }

  return Math.ceil(Number.parseFloat(match[1]) * 1000)
}

function parseRetryDelayFromDetails(error) {
  const details = error?.errorInfo?.details ?? error?.details ?? error?.message

  if (Array.isArray(details)) {
    for (const detail of details) {
      const retryDelay = detail?.retryDelay

      if (typeof retryDelay === 'string') {
        const parsed = parseDurationMs(retryDelay)

        if (parsed !== null) {
          return parsed
        }
      }
    }
  }

  if (typeof details === 'string') {
    const match = details.match(/retry in ([\d.]+)s/i) || details.match(/"retryDelay":"(\d+)s"/i)

    if (match) {
      return Math.ceil(Number.parseFloat(match[1]) * 1000)
    }
  }

  return null
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForModelSlot(model) {
  const state = getModelState(model)
  const delayMs = state.nextAllowedAt - Date.now()

  if (delayMs > 0) {
    await sleep(delayMs)
  }
}
