// Batch: extract signatures for recipes, then generate images for missing signatures
import 'dotenv/config';
import { pool, getRecipesWithoutSignature, setRecipeSignature, getSignaturesWithoutImage, saveRecipeImage } from '../src/store.js';
import { extractImageSignature } from '../src/llmClient.js';
import { generateRecipeImage, buildFoodPrompt } from '../src/falClient.js';

const DRY_RUN = process.argv.includes('--dry');
const LIMIT = Number(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? 100);

// Step 1: signatures
const recipes = await getRecipesWithoutSignature(LIMIT);
console.log(`${recipes.length} recipes need signatures`);
for (const r of recipes) {
  try {
    const { signature, visualItems } = await extractImageSignature(r.name, r.items, r.cuisine);
    await setRecipeSignature(r.id, signature);
    console.log(`  ✓ ${r.name.slice(0, 50)} → ${signature}`);
  } catch (e: any) {
    console.error(`  ✗ ${r.name.slice(0, 50)}: ${e.message}`);
  }
}

// Step 2: images for signatures without one
const pending = await getSignaturesWithoutImage(LIMIT);
console.log(`\n${pending.length} signatures need images`);
if (DRY_RUN) {
  for (const p of pending) {
    console.log(`  [dry] ${p.signature}: ${buildFoodPrompt(p.name, p.items.slice(0, 4).join(', '), p.signature).slice(0, 120)}...`);
  }
} else {
  let ok = 0, fail = 0;
  for (const p of pending) {
    try {
      const { visualItems } = await extractImageSignature(p.name, p.items, p.cuisine);
      const { localPath } = await generateRecipeImage(p.signature, p.name, visualItems);
      const prompt = buildFoodPrompt(p.name, visualItems, p.signature);
      await saveRecipeImage(p.signature, prompt, localPath);
      console.log(`  ✓ ${p.signature} → ${localPath}`);
      ok++;
    } catch (e: any) {
      console.error(`  ✗ ${p.signature}: ${e.message}`);
      fail++;
    }
  }
  console.log(`\ndone: ${ok} generated, ${fail} failed`);
}
await pool.end();
