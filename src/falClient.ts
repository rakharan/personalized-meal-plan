// fal.ai client — Seedream image generation for recipe photos
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const FAL_KEY = process.env.FAL_API_KEY || '';
const FAL_URL = 'https://fal.run/fal-ai/bytedance/seedream/v5/lite/text-to-image';
const IMAGE_DIR = join(process.cwd(), 'web', 'public', 'images', 'recipes');

export interface FalImageResult {
  url: string;
  localPath: string; // web-relative: /images/recipes/<sig>.jpg
}

const PLATING: Record<string, string> = {
  id: 'rustic ceramic plate on dark wooden table, banana leaf accent',
  jp: 'minimal ceramic bowl on light wood, zen styling',
  kr: 'stone bowl, dark slate background',
  md: 'white ceramic plate, olive wood board, linen napkin',
  th: 'banana leaf on woven tray, tropical backdrop',
  vn: 'bamboo tray, fresh herbs scattered',
  in: 'copper bowl, dark rustic surface',
  mx: 'colorful talavera plate, rustic wood',
  mix: 'rustic ceramic plate on dark wooden table',
};

function cuisineCode(signature: string): string {
  const tail = signature.split('-').pop() || 'mix';
  return PLATING[tail] ? tail : 'mix';
}

export function buildFoodPrompt(dishName: string, visualItems: string, signature: string): string {
  const plating = PLATING[cuisineCode(signature)] || PLATING.mix;
  return `Professional food photography of ${dishName}: ${visualItems}. Served on ${plating}. Warm golden side light, gentle steam rising, shallow depth of field, 85mm lens, editorial food magazine quality, appetizing.`;
}

export async function generateRecipeImage(
  signature: string,
  dishName: string,
  visualItems: string,
): Promise<FalImageResult> {
  if (!FAL_KEY) throw new Error('FAL_API_KEY not set');
  const prompt = buildFoodPrompt(dishName, visualItems, signature);

  const res = await fetch(FAL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${FAL_KEY}`,
    },
    body: JSON.stringify({
      prompt,
      image_size: { width: 1024, height: 768 },
      num_images: 1,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`fal ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error('fal returned no image url');

  // Download + store locally (no hotlink dependency)
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`image download failed: ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  await mkdir(IMAGE_DIR, { recursive: true });
  const filename = `${signature}.jpg`;
  await writeFile(join(IMAGE_DIR, filename), buf);

  return { url, localPath: `/images/recipes/${filename}` };
}
