<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md'
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
})

const sizeClass = computed(() =>
  props.size === 'sm' ? 'min-h-10 px-4 text-sm' : 'min-h-12 px-5 text-sm/6',
)

const variantClass = computed(() =>
  props.variant === 'secondary'
    ? 'border border-brick-200/80 bg-white/70 text-ink-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] hover:border-brick-400/50 hover:bg-brick-50'
    : 'border border-brick-500/80 bg-linear-to-r from-brick-500 to-brick-600 text-white shadow-brick hover:from-brick-400 hover:to-brick-500',
)
</script>

<template>
  <button
    :type="props.type"
    class="inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick-500 disabled:pointer-events-none disabled:opacity-50"
    :class="[sizeClass, variantClass]"
    data-testid="brick-button"
  >
    <slot />
  </button>
</template>
