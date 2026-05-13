<script setup lang="ts">
useSeoMeta({
  title: "Brick",
  description:
    "Documentation for components, CLI tools, and code quality presets.",
});

const featureCards = [
  {
    title: "Components",
    description:
      "Reusable UI building blocks with a clean API and consistent visual language.",
    to: "/essentials/components",
    icon: "◌",
  },
  {
    title: "CLI",
    description:
      "Fast project commands for scaffolding, local workflows, and team-friendly automation.",
    to: "/getting-started/installation",
    icon: "⌘",
  },
  {
    title: "ESLint & Prettier",
    description:
      "Opinionated linting and formatting rules to keep every Brick project predictable.",
    to: "",
    icon: "{}",
  },
];
</script>

<template>
  <div class="brick-home">
    <section class="brick-hero">
      <div class="brick-hero__backdrop" />
      <div class="brick-hero__content">
        <p class="brick-hero__eyebrow">Brick Documentation</p>
        <h1 class="brick-hero__title">
          Beautiful docs with a blue glow and a sharper developer focus.
        </h1>
        <p class="brick-hero__description">
          One home for your components, CLI workflows, and code style rules.
          Built to feel crisp, readable, and fast.
        </p>

        <div class="brick-hero__actions">
          <NuxtLink
            class="brick-button brick-button--primary"
            to="/getting-started/introduction"
          >
            Open docs
          </NuxtLink>

          <NuxtLink
            class="brick-button brick-button--ghost"
            to="/essentials/components"
          >
            View components
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="brick-section">
      <div class="brick-section__header">
        <p class="brick-section__eyebrow">Core Toolkit</p>
        <h2 class="brick-section__title">Three focused areas</h2>
      </div>

      <div class="brick-grid">
        <component
          :is="card.to ? 'NuxtLink' : 'article'"
          v-for="card in featureCards"
          :key="card.title"
          :to="card.to || undefined"
          class="brick-card"
        >
          <span class="brick-card__icon">{{ card.icon }}</span>
          <h3 class="brick-card__title">{{ card.title }}</h3>
          <p class="brick-card__description">{{ card.description }}</p>
        </component>
      </div>
    </section>
  </div>
</template>

<style scoped>
.brick-home {
  --brick-bg: #07111f;
  --brick-surface: rgba(7, 17, 31, 0.68);
  --brick-border: rgba(114, 214, 255, 0.22);
  --brick-text: #f3fbff;
  --brick-muted: rgba(224, 243, 255, 0.74);
  --brick-glow: rgba(69, 220, 255, 0.55);
  --brick-glow-soft: rgba(74, 129, 255, 0.18);
  min-height: 100%;
  background:
    radial-gradient(circle at top, rgba(70, 195, 255, 0.16), transparent 34%),
    linear-gradient(180deg, #06101d 0%, #07111f 45%, #040914 100%);
  color: var(--brick-text);
}

.brick-hero,
.brick-section {
  width: min(1180px, calc(100% - 2rem));
  margin: 0 auto;
}

.brick-hero {
  position: relative;
  overflow: hidden;
  min-height: 38rem;
  margin-top: 2rem;
  border: 1px solid var(--brick-border);
  border-radius: 2rem;
  background: var(--brick-surface);
  box-shadow:
    0 0 0 1px rgba(117, 210, 255, 0.08) inset,
    0 40px 120px rgba(2, 8, 20, 0.72),
    0 0 80px rgba(55, 186, 255, 0.2);
}

.brick-hero::before,
.brick-hero::after {
  content: "";
  position: absolute;
  inset: auto;
  border-radius: 999px;
  filter: blur(18px);
  pointer-events: none;
}

.brick-hero::before {
  top: 2rem;
  left: -2rem;
  width: 16rem;
  height: 16rem;
  background: var(--brick-glow);
  opacity: 0.4;
}

.brick-hero::after {
  right: -2rem;
  bottom: 0;
  width: 22rem;
  height: 22rem;
  background: var(--brick-glow-soft);
  opacity: 0.9;
}

.brick-hero__backdrop {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      110deg,
      rgba(5, 12, 24, 0.88) 18%,
      rgba(5, 12, 24, 0.5) 50%,
      rgba(5, 12, 24, 0.82) 100%
    ),
    url("/brick-hero.jpg") center right / cover no-repeat;
  transform: scale(1.02);
}

.brick-hero__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 38rem;
  max-width: 38rem;
  padding: 4.5rem 3rem;
}

.brick-hero__eyebrow,
.brick-section__eyebrow {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #87e8ff;
}

.brick-hero__title,
.brick-section__title {
  margin: 1rem 0 0;
  letter-spacing: -0.04em;
}

.brick-hero__title {
  font-size: clamp(2.75rem, 5vw, 5.25rem);
  line-height: 0.95;
  text-wrap: balance;
}

.brick-hero__description {
  margin: 1.5rem 0 0;
  font-size: 1.1rem;
  line-height: 1.7;
  color: var(--brick-muted);
}

.brick-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  margin-top: 2rem;
}

.brick-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3.25rem;
  padding: 0.85rem 1.35rem;
  border-radius: 999px;
  border: 1px solid transparent;
  font-weight: 700;
  text-decoration: none;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease;
}

.brick-button:hover {
  transform: translateY(-1px);
}

.brick-button--primary {
  color: #03111e;
  background: linear-gradient(135deg, #9af0ff 0%, #43d7ff 55%, #7fc2ff 100%);
  box-shadow: 0 0 28px rgba(77, 218, 255, 0.34);
}

.brick-button--ghost {
  color: var(--brick-text);
  border-color: rgba(140, 228, 255, 0.28);
  background: rgba(7, 17, 31, 0.24);
  backdrop-filter: blur(12px);
}

.brick-section {
  padding: 4rem 0 5rem;
}

.brick-section__header {
  max-width: 32rem;
}

.brick-section__title {
  font-size: clamp(2rem, 4vw, 3.25rem);
  line-height: 1;
}

.brick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
  margin-top: 2rem;
}

.brick-card {
  position: relative;
  display: block;
  min-height: 15rem;
  padding: 1.5rem;
  border: 1px solid rgba(130, 219, 255, 0.16);
  border-radius: 1.5rem;
  background: linear-gradient(
    180deg,
    rgba(12, 27, 45, 0.88) 0%,
    rgba(6, 15, 28, 0.92) 100%
  );
  box-shadow:
    0 16px 50px rgba(1, 7, 17, 0.52),
    0 0 0 1px rgba(92, 208, 255, 0.04) inset;
  text-decoration: none;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.brick-card:hover {
  transform: translateY(-4px);
  border-color: rgba(130, 219, 255, 0.3);
  box-shadow:
    0 22px 60px rgba(1, 7, 17, 0.56),
    0 0 28px rgba(61, 197, 255, 0.14);
}

.brick-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 1rem;
  background: linear-gradient(
    135deg,
    rgba(86, 230, 255, 0.24),
    rgba(78, 124, 255, 0.16)
  );
  color: #a8f5ff;
  font-size: 1.15rem;
  font-weight: 700;
  box-shadow: 0 0 26px rgba(69, 220, 255, 0.15);
}

.brick-card__title {
  margin: 1.25rem 0 0;
  font-size: 1.4rem;
  color: var(--brick-text);
}

.brick-card__description {
  margin: 0.85rem 0 0;
  color: var(--brick-muted);
  line-height: 1.65;
}

@media (max-width: 900px) {
  .brick-grid {
    grid-template-columns: 1fr;
  }

  .brick-hero {
    min-height: auto;
  }

  .brick-hero__content {
    min-height: auto;
    max-width: 100%;
    padding: 3.5rem 1.5rem;
  }

  .brick-hero__backdrop {
    background-position: 68% center;
  }
}

@media (max-width: 640px) {
  .brick-hero,
  .brick-section {
    width: min(100% - 1rem, 1180px);
  }

  .brick-hero {
    margin-top: 1rem;
    border-radius: 1.5rem;
  }

  .brick-hero__title {
    font-size: 2.5rem;
  }

  .brick-hero__description {
    font-size: 1rem;
  }
}
</style>
