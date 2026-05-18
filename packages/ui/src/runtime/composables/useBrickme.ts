import { computed } from 'vue'
import { useRuntimeConfig } from 'nuxt/app'
import { createBrickGreeting, toBrickClassName } from '@brickflow/utils'

interface brickflowPublicConfig {
  target?: string
}

export const usebrickflow = () => {
  const config = useRuntimeConfig()
  const brickflowConfig = computed(
    () => (config.public.brickflowUi ?? {}) as brickflowPublicConfig,
  )
  const target = computed(() => brickflowConfig.value.target ?? 'world')

  return {
    target,
    className: computed(() => `brick-demo--${toBrickClassName(target.value)}`),
    message: computed(() => createBrickGreeting(target.value)),
  }
}
