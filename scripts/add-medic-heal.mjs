// Medic has no weapon, but it does have a heal beam. SC1: real Medic ability sounds from the
// user's MPQ Editor extraction (D:\sound\SD\sound\terran\medic). SC2: the game ships no
// dedicated Medic effect files, so the Medivac's heal beam (start/loop/end) stands in.
import { Storage, CASC_LOCALE_ALL } from '@jamiephan/casclib';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = 'D:/soundboard';
const rd = async (f) => JSON.parse(await readFile(path.join(root, 'data', f), 'utf-8'));
const en = await rd('quotes.en.json'), ru = await rd('quotes.ru.json'), cl = await rd('quotes.classic.json');

// --- SC1 ---------------------------------------------------------------
const srcDir = 'D:/sound/SD/sound/terran/medic';
const SC1 = [
  ['Луч лечения', ['Tmedheal.wav', 'Tmedheal2.wav']],
  ['Лечение (снятие эффектов)', ['TmedCure.wav', 'TmedCure2.wav']],
  ['Восстановление', ['TMedRest.wav', 'Tmedrest1.wav']],
  ['Вспышка', ['TMedflsh.wav']],
];
const d1 = path.join(root, 'assets/audio/classic/terran/t-medic');
await mkdir(d1, { recursive: true });
const sc1 = [];
for (const [label, files] of SC1) {
  let n = 0;
  for (const f of files) {
    n++;
    const base = f.replace(/\.wav$/i, '').toLowerCase();
    await run(ffmpegPath, ['-y', '-i', path.join(srcDir, f), '-c:a', 'libmp3lame', '-q:a', '4', path.join(d1, base + '.mp3')]);
    sc1.push({ file: `assets/audio/classic/terran/t-medic/${base}.mp3`, text: files.length === 1 ? label : `${label} ${n}` });
  }
}
cl['t-medic'].categories.sfx = sc1;

// --- SC2 ---------------------------------------------------------------
const s = Storage.openEx('D:/Program Files (x86)/StarCraft II', { localeMask: CASC_LOCALE_ALL });
const byName = new Map();
for (const e of s.files('*')) {
  const l = e.fileName.toLowerCase();
  if (l.includes('\\terran\\medivac\\') && l.endsWith('.wav')) byName.set(l.split('\\').pop(), e.fileName);
}
const d2 = path.join(root, 'assets/audio/en/terran/t-medic');
await mkdir(d2, { recursive: true });
const sc2 = [];
for (const [label, f] of [['Луч лечения: старт', 'medivac_healstart.wav'], ['Луч лечения', 'medivac_healloop.wav'], ['Луч лечения: конец', 'medivac_healend.wav']]) {
  const full = byName.get(f);
  if (!full) { console.log('not found', f); continue; }
  const base = f.replace('.wav', '');
  const raw = path.join(d2, base + '.wav');
  await writeFile(raw, await s.readFileAsync(full));
  await run(ffmpegPath, ['-y', '-i', raw, '-c:a', 'libmp3lame', '-q:a', '4', path.join(d2, base + '.mp3')]);
  await unlink(raw);
  sc2.push({ file: `assets/audio/en/terran/t-medic/${base}.mp3`, text: label });
}
s.close();
en['t-medic'].categories.sfx = sc2;
ru['t-medic'].categories.sfx = sc2.map((l) => ({ ...l, shared: true }));

const wr = (f, d) => writeFile(path.join(root, 'data', f), JSON.stringify(d, null, 1));
await wr('quotes.en.json', en); await wr('quotes.ru.json', ru); await wr('quotes.classic.json', cl);
console.log('medic sfx: SC1', sc1.length, 'SC2', sc2.length);
