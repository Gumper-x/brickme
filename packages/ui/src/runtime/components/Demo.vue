<script setup lang="ts">
import Button from './Button.vue'
import { usebrickflow } from '../composables/usebrickflow'

const brickflow = usebrickflow()
</script>

<template>
  <section
    class="grid gap-4 rounded-3xl border border-brick-200/70 bg-white/75 p-6 shadow-brick backdrop-blur"
    :class="brickflow.className"
    data-testid="brick-demo"
  >
    <div class="grid gap-1">
      <strong class="text-base font-semibold tracking-[-0.02em] text-ink-950">
        {{ brickflow.message }}
      </strong>
      <span class="text-sm text-zinc-600">Component from @brickflow/ui</span>
    </div>
    <div class="flex flex-wrap gap-3">
      <Button>Primary action</Button>
      <Button variant="secondary">Secondary action</Button>
    </div>
  </section>
</template>
