// Builds the Russian voice pack: for every line already in data/quotes.en.json, find
// its matching enus.sc2assets path in the CASC archive by filename, swap the locale to
// ruru.sc2assets, and pull that file if it exists. Units that don't actually "speak" in
// English either (Hydralisk, Sentry, Zergling, Roach, Queen — their bark is a universal
// screech/beep, not localized dialogue) have no ruru variant to find, so those lines
// just keep pointing at the shared EN file (same audio either way). Combat SFX (the
// "sfx" category — gunfire/impact) is likewise language-agnostic and always shared.
import { Storage, CASC_LOCALE_ALL } from '@jamiephan/casclib';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = 'D:/soundboard';
const storage = Storage.openEx('D:/Program Files (x86)/StarCraft II', { localeMask: CASC_LOCALE_ALL });
console.log('Storage opened, total files:', storage.getTotalFileCount());

console.log('Listing all file names...');
const allFiles = [];
for (const e of storage.files('*')) allFiles.push(e.fileName);
console.log('Listed', allFiles.length, 'files');

// basename (lowercase, no ext) -> array of full enus paths that end with it
const enusIndex = new Map();
for (const f of allFiles) {
  const lower = f.toLowerCase();
  if (!lower.includes('enus.sc2assets')) continue;
  if (!(lower.endsWith('.ogg') || lower.endsWith('.wav'))) continue;
  const base = path.basename(lower).replace(/\.(ogg|wav)$/, '');
  if (!enusIndex.has(base)) enusIndex.set(base, []);
  enusIndex.get(base).push(f);
}
console.log('Indexed', enusIndex.size, 'unique enus basenames');

function pickEnusPath(basename, unitKey) {
  const candidates = enusIndex.get(basename);
  if (!candidates || !candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  if (unitKey === 'z-kerrigan') {
    const camp = candidates.find((c) => c.toLowerCase().includes('liberty.sc2campaign'));
    if (camp) return camp;
  }
  const mod = candidates.find((c) => c.toLowerCase().includes('\\mods\\'));
  return mod || candidates[0];
}

async function extractAndTranscode(cascPath, destDir, destBaseName) {
  await mkdir(destDir, { recursive: true });
  const buf = await storage.readFileAsync(cascPath);
  const ext = cascPath.toLowerCase().endsWith('.wav') ? '.wav' : '.ogg';
  const tmpPath = path.join(destDir, destBaseName + ext);
  await writeFile(tmpPath, buf);
  if (ext === '.mp3') return tmpPath;
  const mp3Path = path.join(destDir, destBaseName + '.mp3');
  await run(ffmpegPath, ['-y', '-i', tmpPath, '-c:a', 'libmp3lame', '-q:a', '4', mp3Path]);
  await unlink(tmpPath);
  return mp3Path;
}

const quotesEn = JSON.parse(await readFile(path.join(root, 'data/quotes.en.json'), 'utf-8'));
const quotesRu = {};

let ruFound = 0, ruShared = 0, ruFailed = 0;

for (const [unitKey, unit] of Object.entries(quotesEn)) {
  const outCategories = {};
  for (const [cat, lines] of Object.entries(unit.categories)) {
    outCategories[cat] = [];
    for (const line of lines) {
      const baseNoExt = path.basename(line.file).replace(/\.mp3$/i, '');
      const basenameLower = baseNoExt.toLowerCase();
      const enusPath = pickEnusPath(basenameLower, unitKey);
      if (!enusPath) {
        // universal sound (no localized speech) — share the EN asset
        outCategories[cat].push({ file: line.file, text: line.text, shared: true });
        ruShared++;
        continue;
      }
      const ruPath = enusPath.replace(/enus\.sc2assets/i, 'ruru.sc2assets');
      if (!storage.fileExists(ruPath)) {
        outCategories[cat].push({ file: line.file, text: line.text, shared: true });
        ruShared++;
        continue;
      }
      const destDir = path.join(root, 'assets/audio/ru', unit.faction, unitKey);
      try {
        const mp3Path = await extractAndTranscode(ruPath, destDir, baseNoExt);
        const rel = path.relative(root, mp3Path).split(path.sep).join('/');
        outCategories[cat].push({ file: rel, text: line.text });
        ruFound++;
      } catch (e) {
        console.log('FAILED', ruPath, e.message);
        outCategories[cat].push({ file: line.file, text: line.text, shared: true });
        ruFailed++;
      }
    }
  }
  quotesRu[unitKey] = { name: unit.name, faction: unit.faction, categories: outCategories };
  console.log(unitKey, 'done');
}

await writeFile(path.join(root, 'data/quotes.ru.json'), JSON.stringify(quotesRu, null, 1));
storage.close();
console.log(`\nDone. RU-specific: ${ruFound}, shared with EN: ${ruShared}, failed: ${ruFailed}`);
