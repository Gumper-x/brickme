<script setup lang="ts">
const brickflow = usebrickflow()
</script>

<template>
  <main
    class="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(247,237,232,0.9)_42%,_rgba(236,219,212,0.92))] px-6 py-16 text-zinc-950"
  >
    <section class="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <div class="grid gap-6">
        <div class="grid gap-3">
          <span
            class="text-xs font-semibold uppercase tracking-[0.3em] text-brick-600"
          >
            brickflow UI
          </span>
          <h1
            class="max-w-2xl text-5xl font-semibold tracking-[-0.04em] text-ink-950"
          >
            Tailwind v4 is now wired into the UI package.
          </h1>
          <p
            class="max-w-xl text-base/7 text-zinc-700"
            data-testid="brickflow-message"
          >
            {{ brickflow.message }}
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <BrickButton>Try BrickButton</BrickButton>
          <BrickButton variant="secondary">Inspect styles</BrickButton>
        </div>
      </div>
      <BrickDemo />
    </section>
  </main>
</template>
