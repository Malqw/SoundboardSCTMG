// Zeratul joined the TMG roster. His voice lines already exist in all three packs; his
// melee/ability effects live in the SC2 archive (not on the wiki), so pull them here.
// Full archive paths are resolved by file name from a real enumeration — hand-typed
// paths are easy to get subtly wrong (the sounds sit under base.sc2assets\assets\sounds).
import { Storage, CASC_LOCALE_ALL } from '@jamiephan/casclib';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = 'D:/soundboard';
const KEY = 'p-zeratul';
const nums = (stem, list, suffix = '') => list.map((n) => `${stem}${n}${suffix}.wav`);

const GROUPS = [
  ['Удар клинком', nums('zeratul_ac_cleave_0', [1, 2, 3, 4, 6])],
  ['Теневой удар', nums('zeratul_shadowstrike_0', [1, 2, 3, 4, 5, 6, 7, 8], 'a')],
  ['Пси-взрыв', nums('zeratul_ac_psi_blast_0', [1, 2, 3, 4])],
  ['Выстрел по воздуху', nums('zeratul_ac_aa_cast_launch_0', [1, 2, 3])],
  ['Попадание', nums('zeratul_ac_spell_hit_0', [1, 2])],
  ['Клинок активируется', ['sm_zeratul_blade_power_up01.wav', 'sm_zeratul_blade_power_up02.wav', 'zeratul_ac_ui_blade_on_big.wav']],
];

const s = Storage.openEx('D:/Program Files (x86)/StarCraft II', { localeMask: CASC_LOCALE_ALL });
const byName = new Map();
for (const e of s.files('*')) {
  const l = e.fileName.toLowerCase();
  if (!l.endsWith('.wav') || !l.includes('zeratul') || l.includes('cutscene')) continue;
  const name = l.split('\\').pop();
  if (!byName.has(name) || l.includes('\\mods\\')) byName.set(name, e.fileName);
}

const destDir = path.join(root, 'assets/audio/en/protoss', KEY);
await mkdir(destDir, { recursive: true });
const lines = [];
for (const [label, files] of GROUPS) {
  let n = 0;
  for (const file of files) {
    const full = byName.get(file);
    if (!full) { console.log('not found:', file); continue; }
    n++;
    const base = file.replace(/\.wav$/, '');
    const raw = path.join(destDir, base + '.wav');
    await writeFile(raw, await s.readFileAsync(full));
    const mp3 = path.join(destDir, base + '.mp3');
    await run(ffmpegPath, ['-y', '-i', raw, '-c:a', 'libmp3lame', '-q:a', '4', mp3]);
    await unlink(raw);
    lines.push({ file: `assets/audio/en/protoss/${KEY}/${base}.mp3`, text: `${label} ${n}` });
  }
}
s.close();

for (const [file, shared] of [['quotes.en.json', false], ['quotes.ru.json', true]]) {
  const p = path.join(root, 'data', file);
  const d = JSON.parse(await readFile(p, 'utf-8'));
  d[KEY].categories.sfx = shared ? lines.map((l) => ({ ...l, shared: true })) : lines;
  await writeFile(p, JSON.stringify(d, null, 1));
}

const up = path.join(root, 'data/units.json');
const u = JSON.parse(await readFile(up, 'utf-8'));
for (const x of u.units) if (x.key === KEY) { x.tmg = true; x.name = 'Зератул'; }
await writeFile(up, JSON.stringify(u, null, 1));
console.log('zeratul sfx:', lines.length);
