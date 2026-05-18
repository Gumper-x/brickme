import {
  addComponentsDir,
  addImportsDir,
  createResolver,
  defineNuxtModule,
} from '@nuxt/kit'
import tailwindcss from '@tailwindcss/vite'
import { createBrickGreeting } from '@brickflow/utils'

export interface ModuleOptions {
  target?: string
  componentPrefix?: string
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@brickflow/ui',
    configKey: 'brickflowUi',
    compatibility: {
      nuxt: '>=4.0.0',
    },
  },
  defaults: {
    target: 'world',
    componentPrefix: 'Brick',
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    const currentConfig = nuxt.options.runtimeConfig.public.brickflowUi ?? {}

    nuxt.options.runtimeConfig.public.brickflowUi = {
      ...currentConfig,
      target: options.target ?? 'world',
      message: createBrickGreeting(options.target ?? 'world'),
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
      prefix: options.componentPrefix ?? 'Brick',
      pathPrefix: false,
    })
  },
})
