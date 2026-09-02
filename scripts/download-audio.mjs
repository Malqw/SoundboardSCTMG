// Downloads the .ogg files referenced in data/quotes.en.raw.json (URLs already resolved
// via the wiki's API from the browser session) and writes the final data/quotes.en.json
// with local relative paths.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = 'D:/soundboard';
const raw = JSON.parse(await readFile(path.join(root, 'data/quotes.en.raw.json'), 'utf-8'));

async function downloadFile(url, dest) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

const manifest = {};
let ok = 0, fail = 0;

for (const [unitKey, unit] of Object.entries(raw)) {
  const unitDir = path.join(root, 'assets/audio/en', unit.faction, unitKey);
  await mkdir(unitDir, { recursive: true });
  const outCategories = {};
  for (const [cat, lines] of Object.entries(unit.categories)) {
    outCategories[cat] = [];
    for (const line of lines) {
      if (!line.url) { fail++; continue; }
      const localName = line.file.replace(/\s+/g, '_');
      const dest = path.join(unitDir, localName);
      try {
        await downloadFile(line.url, dest);
        ok++;
        outCategories[cat].push({
          file: `assets/audio/en/${unit.faction}/${unitKey}/${localName}`,
          text: line.text,
        });
      } catch (e) {
        fail++;
        console.log(`FAIL ${unitKey}/${localName}: ${e.message}`);
      }
    }
  }
  manifest[unitKey] = { name: unit.name, faction: unit.faction, categories: outCategories };
  console.log(`${unit.name}: done`);
}

await writeFile(path.join(root, 'data/quotes.en.json'), JSON.stringify(manifest, null, 1));
console.log(`\nOK ${ok}, FAIL ${fail}`);
