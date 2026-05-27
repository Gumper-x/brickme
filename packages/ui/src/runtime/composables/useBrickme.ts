import { useRuntimeConfig } from 'nuxt/app'
import { computed, type ComputedRef } from 'vue'

interface brickflowComposable {
  className: ComputedRef<string>
  message: ComputedRef<string>
  target: ComputedRef<string>
}

interface brickflowPublicConfig {
  message?: string
  target?: string
}

export const usebrickflow = (): brickflowComposable => {
  const config = useRuntimeConfig()
  const brickflowConfig = computed(() => (config.public.brickflowUi ?? {}) as brickflowPublicConfig)
  const target = computed(() => brickflowConfig.value.target ?? 'world')
  const message = computed(() => brickflowConfig.value.message ?? `Hello ${target.value}`)
  const className = computed(() => (target.value === 'world' ? 'ring-1 ring-brick-100/70' : ''))

  return {
    className,
    message,
    target,
  }
}
