// Downloads every photo listed in lib/media.ts into public/photos as WebP at three widths.
// Runs in CI (see .github/workflows/photos.yml) so the site never hotlinks a third party.
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import sharp from "sharp";

const WIDTHS = [480, 960, 1600];
const source = await readFile(new URL("../lib/media.ts", import.meta.url), "utf8");
const entries = [...source.matchAll(/^\s{2}(\w+): \{\s*\n\s*id: "([^"]+)"/gm)].map(([, key, id]) => ({ key, id }));
if (!entries.length) throw new Error("No photos found in lib/media.ts");

const outDir = new URL("../public/photos/", import.meta.url);
await mkdir(outDir, { recursive: true });

for (const { key, id } of entries) {
  const done = await Promise.all(
    WIDTHS.map((w) => access(new URL(`${key}-${w}.webp`, outDir)).then(() => true, () => false)),
  );
  if (done.every(Boolean)) {
    console.log(`skip ${key}`);
    continue;
  }
  const response = await fetch(`https://images.unsplash.com/${id}?fm=jpg&q=90&w=2000`);
  if (!response.ok) throw new Error(`${key}: HTTP ${response.status}`);
  const original = Buffer.from(await response.arrayBuffer());
  for (const w of WIDTHS) {
    const file = await sharp(original).resize({ width: w, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
    await writeFile(new URL(`${key}-${w}.webp`, outDir), file);
  }
  console.log(`saved ${key}`);
}
