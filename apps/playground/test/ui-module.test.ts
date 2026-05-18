import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

await setup({
  rootDir: fileURLToPath(new URL('..', import.meta.url)),
  browser: false,
  port: 4173,
})

describe('playground ui module', () => {
  it('renders greeting from workspace utils through the ui module', async () => {
    const html = await $fetch('/')

    expect(html).toContain('Hello from playground')
    expect(html).toContain('Try BrickButton')
    expect(html).toContain('Component from @brickflow/ui')
  })
})
