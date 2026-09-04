// Downloads the "classic" (original StarCraft, 1998) voice pack from
// data/quotes.classic.raw.json (URLs already resolved via the wiki API from a browser
// session — see scripts/casc-extract-ru.mjs's header comment for why that's necessary),
// transcodes to mp3, and writes data/quotes.classic.json. Units with no SC1 equivalent
// (Marauder, Adept, Sentry, Stalker, Roach, Roachling — all SC2-only unit types) fall
// back to the EN pack's files, same as RU does for non-localized units.
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = 'D:/soundboard';

const raw = JSON.parse(await readFile(path.join(root, 'data/quotes.classic.raw.json'), 'utf-8'));
const quotesEn = JSON.parse(await readFile(path.join(root, 'data/quotes.en.json'), 'utf-8'));

async function downloadAndTranscode(url, destDir, baseName) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await mkdir(destDir, { recursive: true });
  const oggPath = path.join(destDir, baseName + '.ogg');
  await writeFile(oggPath, buf);
  const mp3Path = path.join(destDir, baseName + '.mp3');
  await run(ffmpegPath, ['-y', '-i', oggPath, '-c:a', 'libmp3lame', '-q:a', '4', mp3Path]);
  await unlink(oggPath);
  return mp3Path;
}

const quotesClassic = {};
let ok = 0, fail = 0, sharedCount = 0;

for (const [unitKey, unit] of Object.entries(quotesEn)) {
  const src = raw[unitKey];
  if (!src) {
    // no SC1 equivalent at all — reuse the whole EN entry as-is
    quotesClassic[unitKey] = unit;
    sharedCount += Object.values(unit.categories).reduce((n, a) => n + a.length, 0);
    console.log(`${unitKey}: no SC1 data, shared with EN`);
    continue;
  }
  const destDir = path.join(root, 'assets/audio/classic', unit.faction, unitKey);
  const outCategories = {};
  for (const [cat, lines] of Object.entries(src.categories)) {
    outCategories[cat] = [];
    for (const line of lines) {
      if (!line.url) { fail++; continue; }
      const baseName = line.file.replace(/\.ogg$/i, '');
      try {
        const mp3Path = await downloadAndTranscode(line.url, destDir, baseName);
        const rel = path.relative(root, mp3Path).split(path.sep).join('/');
        outCategories[cat].push({ file: rel, text: line.text });
        ok++;
      } catch (e) {
        console.log('FAIL', unitKey, baseName, e.message);
        fail++;
      }
    }
  }
  quotesClassic[unitKey] = { name: unit.name, faction: unit.faction, categories: outCategories };
  console.log(`${unitKey}: done`);
}

await writeFile(path.join(root, 'data/quotes.classic.json'), JSON.stringify(quotesClassic, null, 1));
console.log(`\nOK ${ok}, FAIL ${fail}, shared-with-EN units contributed ${sharedCount} lines`);
