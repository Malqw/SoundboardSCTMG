// Ravager appeared in the TMG after the original roster scrape; the wiki has no quote
// template for it (non-verbal unit, like Roach), so pull its sounds straight from the
// SC2 archive. Voice barks are language-agnostic -> RU pack shares the EN files.
import { Storage, CASC_LOCALE_ALL } from '@jamiephan/casclib';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = 'D:/soundboard';
const KEY = 'z-ravager';
const destDir = path.join(root, 'assets/audio/en/zerg', KEY);
const s = Storage.openEx('D:/Program Files (x86)/StarCraft II', { localeMask: CASC_LOCALE_ALL });
const all = [];
for (const e of s.files('*')) {
  const l = e.fileName.toLowerCase();
  if (l.includes('ravager') && /\.(ogg|wav)$/.test(l) && !l.includes('campaign') && !l.includes('_comp')) all.push(e.fileName);
}
const groups = { arrive: [], select: [], move: [], attack: [], witty: [], other: [], sfx: [] };
const rules = [
  [/vox_ready/, 'arrive'], [/vox_what/, 'select'], [/vox_ok/, 'move'], [/vox_attack/, 'attack'],
  [/vox_pissed/, 'witty'], [/vox_death/, 'other'],
  [/corrosivebile_attacklaunch/, 'sfx'], [/corrosivebile_explosion/, 'sfx'], [/ravager_impact_/, 'sfx'],
];
for (const f of all.sort()) {
  const l = f.toLowerCase();
  const r = rules.find(([re]) => re.test(l));
  if (r) groups[r[1]].push(f);
}
await mkdir(destDir, { recursive: true });
const categories = {};
for (const [cat, files] of Object.entries(groups)) {
  if (!files.length) continue;
  categories[cat] = [];
  let n = 0;
  for (const f of files) {
    n++;
    const base = f.split('\\').pop().replace(/\.(ogg|wav)$/i, '');
    const raw = path.join(destDir, base + (f.endsWith('.wav') ? '.wav' : '.ogg'));
    await writeFile(raw, await s.readFileAsync(f));
    const mp3 = path.join(destDir, base + '.mp3');
    await run(ffmpegPath, ['-y', '-i', raw, '-c:a', 'libmp3lame', '-q:a', '4', mp3]);
    await unlink(raw);
    const text = cat === 'sfx' ? `${/impact|explosion/.test(base) ? 'Попадание' : 'Выстрел'} ${n}` : `Реплика ${n}`;
    categories[cat].push({ file: `assets/audio/en/zerg/${KEY}/${base}.mp3`, text });
  }
}
s.close();

const entry = { name: 'Ravager', faction: 'zerg', categories };
for (const [file, shared] of [['quotes.en.json', false], ['quotes.ru.json', true]]) {
  const p = path.join(root, 'data', file);
  const d = JSON.parse(await readFile(p, 'utf-8'));
  d[KEY] = shared ? { ...entry, categories: Object.fromEntries(Object.entries(categories).map(([c, a]) => [c, a.map((x) => ({ ...x, shared: true }))])) } : entry;
  await writeFile(p, JSON.stringify(d, null, 1));
}

const up = path.join(root, 'data/units.json');
const u = JSON.parse(await readFile(up, 'utf-8'));
if (!u.units.some((x) => x.key === KEY)) u.units.push({ key: KEY, faction: 'zerg', name: 'Рэвэджер', subtitle: 'Ravager', games: ['sc2'], tmg: true });
// existing units that joined the tabletop roster
const rename = { 't-siege-tank': 'Осадный танк', 'p-immortal': 'Иммортал' };
for (const x of u.units) if (rename[x.key]) { x.name = rename[x.key]; x.tmg = true; }
await writeFile(up, JSON.stringify(u, null, 1));
console.log(Object.fromEntries(Object.entries(categories).map(([c, a]) => [c, a.length])));
