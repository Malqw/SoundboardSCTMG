// Sentry's Disruption Beam (its actual attack): sentry_weaponstart / weaponloop / weaponend
// in the SC2 archive. Put them first in the Sentry's combat category, ahead of the abilities.
import { Storage, CASC_LOCALE_ALL } from '@jamiephan/casclib';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = 'D:/soundboard';
const KEY = 'p-sentry';
const FILES = [['Disruption Beam: старт', 'sentry_weaponstart'], ['Disruption Beam', 'sentry_weaponloop'], ['Disruption Beam: конец', 'sentry_weaponend']];

const s = Storage.openEx('D:/Program Files (x86)/StarCraft II', { localeMask: CASC_LOCALE_ALL });
const byName = new Map();
for (const e of s.files('*')) {
  const l = e.fileName.toLowerCase();
  if (l.includes('\\protoss\\sentry\\') && l.endsWith('.wav') && !l.includes('campaign')) byName.set(l.split('\\').pop(), e.fileName);
}
const dir = path.join(root, 'assets/audio/en/protoss', KEY);
await mkdir(dir, { recursive: true });
const beam = [];
for (const [label, base] of FILES) {
  const raw = path.join(dir, base + '.wav');
  await writeFile(raw, await s.readFileAsync(byName.get(base + '.wav')));
  await run(ffmpegPath, ['-y', '-i', raw, '-c:a', 'libmp3lame', '-q:a', '4', path.join(dir, base + '.mp3')]);
  await unlink(raw);
  beam.push({ file: `assets/audio/en/protoss/${KEY}/${base}.mp3`, text: label });
}
s.close();

for (const [file, shared] of [['quotes.en.json', false], ['quotes.ru.json', true]]) {
  const p = path.join(root, 'data', file);
  const d = JSON.parse(await readFile(p, 'utf-8'));
  const rest = d[KEY].categories.sfx.filter((l) => !l.file.includes('sentry_weapon'));
  d[KEY].categories.sfx = [...(shared ? beam.map((l) => ({ ...l, shared: true })) : beam), ...rest];
  await writeFile(p, JSON.stringify(d, null, 1));
  console.log(file, d[KEY].categories.sfx.length);
}
