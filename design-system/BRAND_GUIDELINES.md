# Brand Guidelines — Saji

**Status:** Approved
**Last approved:** 2026-09-05
**Owner:** Rakha

---

## 1. Brand foundation

- **Brand name:** Saji
- **One-sentence description:** Asisten makan harian yang bikin kamu makan enak, sehat, dan sesuai goal — pakai bahan yang ada di Indonesia.
- **Audience:** Broad mix — fitness-focused young adults (20-35), health-conscious Indonesians (25-45), students/budget-conscious (18-25).
- **Positioning:** Friendly local nutrition coach in your pocket. Not clinical, not gamified — a knowledgeable friend who knows Indonesian food.
- **Desired perception:** Warm, practical, local, trustworthy. Like a friend who happens to be a nutritionist.
- **Brand promise:** Rencana makan yang masuk akal, buat kamu, dengan bahan yang ada di Indonesia.
- **Values:** Practical, local, honest, encouraging, accessible.
- **Things the brand is not:** Clinical/medical, preachy, elitist, gamified-pointification, foreign-feeling, judgmental.

## 2. Voice and writing

- **Voice attributes:** Warm, encouraging, knowledgeable, casual, direct.
- **Person:** *kamu* (informal), never *Anda* (too formal).
- **Sentence style:** Short, conversational. Questions welcome.
- **Vocabulary to prefer:** Local food terms — tempe, kangkung, ayam, nasi merah, ikan kembung, tahu, kecap manis, tahu, sayur, buah.
- **Vocabulary to avoid:** Medical jargon, pretentious imports ("quinoa", "kale" without context), condescension, diet-culture shame words.
- **Headline behavior:** Benefit-first, often questions — "Mau makan enak hari ini?"
- **Calls to action:** "Mulai dong!", "Gas!", "Coba sekarang", "Ayo buat".
- **Accessibility and inclusive-language rules:** Never body-shame. Never assume gender. Inclusive of all dietary needs. Indonesian-first, English secondary.
- **Example approved copy (ID):**
  - "Halo! Aku Saji. Bakal bantu kamu makan enak + sehat setiap hari. Mau mulai?"
  - "Mantap! 🔥 Hari ke-3 kamu konsisten. Rencana hari ini sudah ready."
  - "Yuk coba lagi — kali ini beda masakan, mungkin lebih cocok."
- **Example approved copy (EN):**
  - "Hey! I'm Saji. I'll help you eat well every day with ingredients you can actually find. Ready to start?"

## 3. Visual principles

- **Overall art direction:** Warm Kitchen — ceramic, matte, food photography. Not glossy, not clinical.
- **Composition:** Clean but warm. Generous whitespace, food-forward imagery.
- **Density and whitespace:** Moderate — breathable, not empty. Content feels placed, not cramped.
- **Contrast and hierarchy:** Dark warm surfaces with bright food-color accents. Clear typographic hierarchy.
- **Shape language:** Rounded, organic (plates, bowls, soft edges). No harsh geometry.
- **Texture and material:** Subtle matte — like ceramic or kraft paper.
- **What to avoid:** Clinical white/blue, glossy gradients, sharp angular shapes, stock-photo sterility, flat Material Design shadows.

## 4. Color

Document color roles and meaning. Interface implementation belongs in design-system tokens (`tokens.json` / `tokens.css`).

- **Primary role:** Leaf green — growth, health, fresh food, success, primary actions.
- **Secondary role:** Cream/brown — warmth, surfaces, background, trust.
- **Accent role:** Amber/turmeric — energy, highlights, streaks, gamification-adjacent (without being gamey).
- **Neutral role:** Brown spectrum — dark surfaces; cream spectrum — light surfaces and text.
- **Feedback roles:** Tomato red — danger, errors, destructive actions. Leaf green — success, confirmation.
- **Print considerations:** Use CMYK approximations. Test on kraft paper stock.
- **Accessibility rules:** Minimum contrast 4.5:1 for text, 3:1 for large text. Never use color alone to convey meaning.

### Primitive palette (food-inspired)

| Token | Hex | Inspiration |
|---|---|---|
| brown-900 | #1A1612 | Dark espresso, charred clay |
| brown-800 | #241F1B | Roasted coffee |
| brown-700 | #2D2823 | Cocoa |
| brown-600 | #3A342E | Cinnamon bark |
| cream-100 | #E8E0D5 | Coconut cream |
| cream-200 | #C4B8A8 | Sand |
| cream-300 | #8A7E72 | Driftwood |
| cream-400 | #5C5248 | Charred wood |
| leaf-500 | #52B788 | Kangkung, fresh herbs |
| leaf-600 | #2D6A4F | Bay leaf, deep green |
| leaf-400 | #74C69D | Mint, young shoot |
| amber-500 | #F59E0B | Turmeric, kunyit |
| amber-600 | #D97706 | Palm sugar, gula merah |
| amber-400 | #FCD34D | Honey, madu |
| tomato-500 | #E5484D | Cabai, chili pepper |
| tomato-600 | #C62828 | Sambal deep |

## 5. Typography

- **Display type:** Plus Jakarta Sans, weight 700, letter-spacing -0.03em.
- **Heading type:** Plus Jakarta Sans, weight 600, letter-spacing -0.02em.
- **Body type:** Plus Jakarta Sans, weight 400, 0.875rem base.
- **Utility type:** JetBrains Mono, weight 400, for data/code/numeric.
- **Pairing logic:** Plus Jakarta Sans for everything user-facing. JetBrains Mono only for technical/data context.
- **Hierarchy rules:**
  - Display: 2rem / 700 / -0.03em
  - H1: 1.5rem / 600 / -0.02em
  - H2: 1.25rem / 600
  - H3: 0.75rem / 600 / uppercase / 0.05em
  - Body: 0.875rem / 400
  - Small: 0.75rem / 400
  - Tabular: font-variant-numeric: tabular-nums
- **Licensing or fallback notes:** Plus Jakarta Sans is free via Google Fonts (Open Font License). Fallback: system sans-serif stack. Self-host for production.

## 6. Logo and identity

- **Approved marks:** Wordmark "Saji" in Plus Jakarta Sans 700, lowercase, leaf-500 color. Optional plate/bowl icon.
- **Clear space:** Equal to height of lowercase "a" in the wordmark.
- **Minimum size:** 24px width for wordmark, 32px for icon.
- **Color variants:**
  - Primary: leaf-500 on cream-100/white background.
  - Reversed: cream-100 on brown-900 background.
  - Monochrome: current text color.
- **Background usage:** Always on solid backgrounds. Never on busy photos without overlay.
- **Misuse to avoid:** No stretching, no rotation, no color outside approved palette, no drop shadows, no outline.

## 7. Photography, imagery, and illustration

- **Subject matter:** Indonesian food, local ingredients, real kitchen scenes, everyday eating moments.
- **Lighting:** Natural, warm, soft. Window light. No flash.
- **Color treatment:** Warm, slightly saturated. Matte finish.
- **Camera perspective:** Top-down for food, 45° for meals, eye-level for people.
- **Cropping:** Tight on food. Show the plate, not the whole table.
- **People and representation:** Diverse Indonesians, everyday settings, no posed stock smiles.
- **Illustration style:** Organic, hand-drawn feel. Rounded lines. Food motifs (bowls, plates, leaves, chilis).
- **Generated-image rules:** Use for hero backgrounds and decorative elements only. Never for nutrition information or clinical content.
- **Prohibited treatments:** Glossy food styling, marble countertops, unrealistic portion sizes, foreign ingredients as heroes.

## 8. Layout by output type

### Websites and products

- **Layout principles:** Sidebar navigation for dashboard. Full-width sections for landing. Max-width 1200px content.
- **Responsive behavior:** Sidebar collapses to hamburger under 768px. Stats grid reflows. Tables scroll horizontally.
- **Interaction character:** Gentle, responsive. Hover states are subtle. No aggressive animations.

### Presentations

- **Narrative rhythm:** Problem → solution → benefit → CTA.
- **Slide density:** One idea per slide. Maximum 3 bullet points.
- **Image-to-text balance:** 60% image, 40% text for impact slides.
- **Data visualization:** Bar lists for comparisons. Stat cards for single metrics. No pie charts.

### Documents and print

- **Page hierarchy:** Clear H1 → H2 → body. No deeper than H3.
- **Grid and margins:** 24mm margins on A4. 12-column grid.
- **Tables and callouts:** Warm surface backgrounds. Amber left-border for callouts.
- **Print production notes:** Use CMYK. Test on uncoated stock for warm feel.

### Social media

- **Campaign consistency:** Saji green + cream palette always. Plus Jakarta Sans always.
- **Safe areas:** 80px margin for square posts. 120px for stories.
- **Text density:** Maximum 15 words on image. CTA in caption.
- **Template families:** Daily meal plan share, streak celebration, ingredient spotlight, recipe tip.

## 9. Motion

- **Motion personality:** Gentle, organic — like food settling on a plate.
- **Duration:** 150ms (micro), 200ms (small), 300ms (large).
- **Easing:** cubic-bezier(0.4, 0, 0.2, 1) — ease-out standard.
- **Entry and exit behavior:** Fade + slight upward translate (4px). Exit reverses.
- **Looping:** No looping animations. Motion is one-shot.
- **Reduced-motion behavior:** All transitions disabled, instant state changes. Respected via prefers-reduced-motion.
- **Effects to avoid:** Bounce, elastic, spin, slide-over-distance, parallax.

## 10. Asset and file rules

- **Approved source formats:** .svelte (components), .svg (icons/illustrations), .json (tokens), .css (generated), .ts (logic).
- **Naming convention:** kebab-case for files. PascalCase for Svelte components.
- **Editable-source requirements:** All components have source in `web/src/lib/components/`. Tokens have source in `design-system/tokens.json`.
- **Final-export requirements:** Built SPA in `web/dist/`. Static assets in `outputs/`.
- **Versioning:** Git. No silent overwrites. Branch for experiments.
- **Rights and attribution:** Plus Jakarta Sans = OFL. All food photography must be licensed or original.

## 11. Examples

### Dashboard stat card

Demonstrates: warm surface, leaf-green number, tabular-nums, subtle elevation, hover lift.

### Landing hero

Demonstrates: warm background, Plus Jakarta Sans display, food-forward imagery, amber CTA accent.

### Bot message

Demonstrates: Saji voice — "Mau makan enak hari ini?", informal *kamu*, local food terms, encouraging tone.
