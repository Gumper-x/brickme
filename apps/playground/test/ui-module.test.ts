import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

await setup({
  browser: false,
  port: 4173,
  rootDir: fileURLToPath(new URL('..', import.meta.url)),
})

describe('playground ui module', () => {
  it('renders greeting from workspace utils through the ui module', async () => {
    const html = await $fetch('/')

    expect(html).toContain('Hello from playground')
    expect(html).toContain('Try BrickButton')
    expect(html).toContain('Component from @brickflow/ui')
  })
})
