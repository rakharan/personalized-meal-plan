// Saji design token sync — reads tokens.json, writes tokens.css
// Run: node design-system/sync-tokens.js
// ponytail: minimal — covers our token shape. For full DTCG spec, use style-dictionary.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(join(__dirname, 'tokens.json'), 'utf-8'));

function resolveRef(val, root) {
  // Resolve {primitive.color.brown.900.value} references
  if (typeof val !== 'string') return val;
  const refs = val.match(/\{([^}]+)\}/g);
  if (!refs) return val;
  let result = val;
  for (const ref of refs) {
    const path = ref.slice(1, -1).split('.'); // e.g. ['primitive','color','brown','900','value']
    let node = root;
    for (const seg of path) {
      if (node == null) break;
      node = node[seg];
    }
    if (node != null) result = result.replace(ref, String(node));
  }
  return result;
}

function resolveAll(obj, root) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object' && !Array.isArray(v)) {
      out[k] = resolveAll(v, root);
    } else {
      out[k] = resolveRef(v, root);
    }
  }
  return out;
}

const resolved = resolveAll(tokens, tokens);

// Build CSS
const lines = [
  '/* Saji Design System — tokens.css',
  '   Generated from tokens.json. Do not edit directly.',
  '   Run: node design-system/sync-tokens.js to regenerate.',
  '*/',
  '',
  ':root {',
];

// Primitive colors
lines.push('  /* ── Primitive: Color ── */');
for (const [group, shades] of Object.entries(resolved.primitive.color)) {
  if (group === 'white' || group === 'black') {
    lines.push(`  --${group}: ${shades.value};`);
    continue;
  }
  for (const [shade, token] of Object.entries(shades)) {
    lines.push(`  --${group}-${shade}: ${token.value};`);
  }
}

// Primitive font
lines.push('', '  /* ── Primitive: Font ── */');
lines.push(`  --font-sans: ${resolved.primitive.font.family.sans.value};`);
lines.push(`  --font-mono: ${resolved.primitive.font.family.mono.value};`);
for (const [name, token] of Object.entries(resolved.primitive.font.weight)) {
  lines.push(`  --fw-${name}: ${token.value};`);
}
for (const [name, token] of Object.entries(resolved.primitive.font.size)) {
  lines.push(`  --fs-${name}: ${token.value};`);
}
for (const [name, token] of Object.entries(resolved.primitive.font.lineHeight)) {
  lines.push(`  --lh-${name}: ${token.value};`);
}
for (const [name, token] of Object.entries(resolved.primitive.font.letterSpacing)) {
  lines.push(`  --ls-${name}: ${token.value};`);
}

// Primitive space
lines.push('', '  /* ── Primitive: Space ── */');
for (const [name, token] of Object.entries(resolved.primitive.space)) {
  lines.push(`  --space-${name}: ${token.value};`);
}

// Primitive radius
lines.push('', '  /* ── Primitive: Radius ── */');
for (const [name, token] of Object.entries(resolved.primitive.radius)) {
  lines.push(`  --radius-${name}: ${token.value};`);
}

// Primitive shadow
lines.push('', '  /* ── Primitive: Shadow ── */');
for (const [name, token] of Object.entries(resolved.primitive.shadow)) {
  lines.push(`  --shadow-${name}: ${token.value};`);
}

// Primitive motion
lines.push('', '  /* ── Primitive: Motion ── */');
for (const [name, token] of Object.entries(resolved.primitive.motion.duration)) {
  lines.push(`  --duration-${name}: ${token.value};`);
}
for (const [name, token] of Object.entries(resolved.primitive.motion.easing)) {
  lines.push(`  --ease-${name}: ${token.value};`);
}

// Primitive grid
lines.push('', '  /* ── Primitive: Grid ── */');
for (const [name, token] of Object.entries(resolved.primitive.grid)) {
  lines.push(`  --grid-${name}: ${token.value};`);
}

// Semantic dark theme
lines.push('', '  /* ── Semantic: Dark theme (default) ── */');
const dark = resolved.semantic.color.dark;
for (const [name, token] of Object.entries(dark)) {
  lines.push(`  --${name}: ${token.value};`);
}
lines.push('}');

// Light theme via prefers-color-scheme
lines.push('', '@media (prefers-color-scheme: light) {', '  :root {');
const light = resolved.semantic.color.light;
const lightEntries = Object.entries(light);
const [firstLight, ...restLight] = lightEntries;
lines.push(`    --${firstLight[0]}: ${firstLight[1].value};`);
for (const [name, token] of restLight) {
  lines.push(`    --${name}: ${token.value};`);
}
lines.push('  }', '}');

// Manual overrides
for (const theme of ['light', 'dark']) {
  lines.push('', `[data-theme="${theme}"] {`);
  const entries = Object.entries(theme === 'light' ? light : dark);
  const [first, ...rest] = entries;
  lines.push(`  --${first[0]}: ${first[1].value};`);
  for (const [name, token] of rest) {
    lines.push(`  --${name}: ${token.value};`);
  }
  lines.push('}');
}

writeFileSync(join(__dirname, 'tokens.css'), lines.join('\n') + '\n');
console.log(`✓ tokens.css written (${lines.length} lines)`);
