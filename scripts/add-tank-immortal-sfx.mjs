// Siege Tank and Immortal joined the TMG roster but had no combat SFX in the SC2 pack
// (the wiki only has their voice lines). Pull the weapon sounds straight from the archive.
// Voice-free effects are language-agnostic, so the RU pack points at the same files.
import { Storage, CASC_LOCALE_ALL } from '@jamiephan/casclib';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = 'D:/soundboard';
const BASE = String.raw`mods\liberty.sc2mod\base.sc2assets\assets\sounds` + '\\'; // raw template can't end in a backslash

const SETS = {
  't-siege-tank': {
    faction: 'terran',
    groups: [
      ['Выстрел (танк)', String.raw`terran\siegetank\siegetank_attacklaunch`, 4],
      ['Выстрел (осадный режим)', String.raw`terran\siegetank\siegetank_siegeattacklaunch`, 10],
      ['Попадание (осадный режим)', String.raw`terran\siegetank\siegetank_siegeattackimpact`, 5],
      ['Переход в осадный режим', String.raw`terran\siegetank\siegetank_morphtosiege`, 0],
      ['Переход в режим танка', String.raw`terran\siegetank\siegetank_morphtotank`, 0],
    ],
  },
  'p-immortal': {
    faction: 'protoss',
    groups: [
      ['Выстрел', String.raw`protoss\immortal\immortal_attacklaunch`, 3],
      ['Щит поглотил удар', String.raw`protoss\immortal\immortal_hardenedshieldimpact`, 3],
    ],
  },
};

const s = Storage.openEx('D:/Program Files (x86)/StarCraft II', { localeMask: CASC_LOCALE_ALL });
const quotes = {
  en: JSON.parse(await readFile(path.join(root, 'data/quotes.en.json'), 'utf-8')),
  ru: JSON.parse(await readFile(path.join(root, 'data/quotes.ru.json'), 'utf-8')),
};

for (const [unitKey, set] of Object.entries(SETS)) {
  const destDir = path.join(root, 'assets/audio/en', set.faction, unitKey);
  await mkdir(destDir, { recursive: true });
  const lines = [];
  for (const [label, stem, count] of set.groups) {
    const names = count === 0 ? [stem] : Array.from({ length: count }, (_, i) => stem + i);
    let n = 0;
    for (const name of names) {
      n++;
      const base = name.split('\\').pop();
      const raw = path.join(destDir, base + '.wav');
      await writeFile(raw, await s.readFileAsync(BASE + name + '.wav'));
      const mp3 = path.join(destDir, base + '.mp3');
      await run(ffmpegPath, ['-y', '-i', raw, '-c:a', 'libmp3lame', '-q:a', '4', mp3]);
      await unlink(raw);
      lines.push({ file: `assets/audio/en/${set.faction}/${unitKey}/${base}.mp3`, text: count === 0 ? label : `${label} ${n}` });
    }
  }
  quotes.en[unitKey].categories.sfx = lines;
  quotes.ru[unitKey].categories.sfx = lines.map((l) => ({ ...l, shared: true }));
  console.log(unitKey, lines.length, 'sfx');
}
s.close();

await writeFile(path.join(root, 'data/quotes.en.json'), JSON.stringify(quotes.en, null, 1));
await writeFile(path.join(root, 'data/quotes.ru.json'), JSON.stringify(quotes.ru, null, 1));
