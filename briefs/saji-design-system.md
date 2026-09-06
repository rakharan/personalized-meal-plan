# Creation Brief: Saji Design System

**Slug:** `saji-design-system`
**Status:** In progress
**Created:** 2026-09-05
**Output type:** Design System (Web)

## Goal

- Build a production-ready design system for Saji — Indonesian daily meal plan bot.
- Replace ad-hoc inline HTML/CSS in dashboard with a formal token-driven component library.
- Enable future outputs: landing page, social media, onboarding screens.

## Audience

- **Primary:** Developer (Rakha) — needs clean, typed, reusable components.
- **End users:** Broad mix of Indonesian users — fitness, health-conscious, students.
- **Tone:** Friendly coach — warm, encouraging, casual, knowledgeable.

## Brand decisions

- **Name:** Saji (Indonesian "serve/plate")
- **Visual direction:** Warm Kitchen — earthy, food-inspired, matte ceramic.
- **Personality:** Friendly coach (nutritionist friend).
- **Indonesian-first:** Voice, imagery, ingredients, culture.
- **Font:** Plus Jakarta Sans (Indonesian foundry Tokotype, OFL).
- **Color system:** Brown/cream surfaces, leaf-green primary, amber accent, tomato danger.
- **Framework:** Svelte 5 + Vite (SPA, no SvelteKit).
- **Backend:** Express becomes API-only; dashboard → SPA.

## Component inventory

### Dashboard
- StatCard, DataTable, ChartCard, BarList, Sidebar, Pagination, Badge, Button, Input, Alert, Modal, EmptyState, Skeleton

### Landing page
- Hero, FeatureCard, StepCard, CTASection, Footer, PhoneMockup

### Social + Onboarding
- PostTemplate (SVG), StoryTemplate (SVG), WelcomeScreen

## Production plan

1. ✅ BRAND_GUIDELINES.md — source of truth
2. ✅ tokens.json + tokens.css — token system
3. ⬜ Web scaffold — Vite + Svelte 5 config
4. ⬜ Core components — all 13 dashboard components
5. ⬜ Stores — theme, auth, api
6. ⬜ Workshop + Theme Editor routes
7. ⬜ Dashboard SPA route
8. ⬜ api.ts — Express API-only server
9. ⬜ Landing page
10. ⬜ Social templates + Onboarding screen
11. ⬜ Bot i18n → Saji voice
12. ⬜ PM2 config + build + test

## Checkpoint

- Workshop page must render all components in all states before dashboard refactor.
- Dashboard SPA must consume API + show same data as old SSR dashboard.
- Theme editor must export valid tokens.json.

## Completion

- Editable source: `web/src/lib/components/`
- Final export: `web/dist/` (built SPA)
- Tokens: `design-system/tokens.json` + `tokens.css`
