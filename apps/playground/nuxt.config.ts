export default defineNuxtConfig({
  modules: ['../../packages/ui/src/module.ts'],
  devtools: {
    enabled: true,
  },
  compatibilityDate: '2026-05-13',
  brickflowUi: {
    target: 'playground',
    componentPrefix: 'Brick',
  },
})
