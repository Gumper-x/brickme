import { createBrickGreeting } from '@brickflow/utils'
import { addComponentsDir, addImportsDir, createResolver, defineNuxtModule } from '@nuxt/kit'
import tailwindcss from '@tailwindcss/vite'

export interface ModuleOptions {
  componentPrefix?: string
  target?: string
}

export default defineNuxtModule<ModuleOptions>({
  defaults: {
    componentPrefix: 'Brick',
    target: 'world',
  },
  meta: {
    compatibility: {
      nuxt: '>=4.0.0',
    },
    configKey: 'brickflowUi',
    name: '@brickflow/ui',
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    const currentConfig = nuxt.options.runtimeConfig.public.brickflowUi ?? {}

    nuxt.options.runtimeConfig.public.brickflowUi = {
      ...currentConfig,
      message: createBrickGreeting(options.target ?? 'world'),
      target: options.target ?? 'world',
    }

    nuxt.options.css.push(resolver.resolve('./runtime/assets/css/main.css'))

    nuxt.hook('vite:extendConfig', (config) => {
      const viteConfig = config as { plugins?: unknown[] }
      viteConfig.plugins ??= []
      viteConfig.plugins.push(tailwindcss() as unknown)
    })

    addImportsDir(resolver.resolve('./runtime/composables'))
    addComponentsDir({
      path: resolver.resolve('./runtime/components'),
      pathPrefix: false,
      prefix: options.componentPrefix ?? 'Brick',
    })
  },
})
