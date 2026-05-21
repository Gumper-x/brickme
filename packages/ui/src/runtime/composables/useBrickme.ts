import { createBrickGreeting, toBrickClassName } from '@brickflow/utils'
import { useRuntimeConfig } from 'nuxt/app'
import { computed, type ComputedRef } from 'vue'

interface brickflowComposable {
  className: ComputedRef<string>
  message: ComputedRef<string>
  target: ComputedRef<string>
}

interface brickflowPublicConfig {
  target?: string
}

export const usebrickflow = (): brickflowComposable => {
  const config = useRuntimeConfig()
  const brickflowConfig = computed(() => (config.public.brickflowUi ?? {}) as brickflowPublicConfig)
  const target = computed(() => brickflowConfig.value.target ?? 'world')

  return {
    className: computed(() => `brick-demo--${toBrickClassName(target.value)}`),
    message: computed(() => createBrickGreeting(target.value)),
    target,
  }
}
