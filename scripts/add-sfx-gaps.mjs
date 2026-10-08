// Fills combat-SFX gaps found in an audit of the TMG roster: Sentry, Raynor, Kerrigan
// (SC2 archive abilities/weapon effects; Medic and Roachling have nothing in the game
// files at all), plus SC1 Raynor/Kerrigan/Zeratul which reuse the weapon of the
// closest SC1 unit (Marine / Ghost / Dark Templar psi blade) already in the pack.
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
const shared = (arr) => arr.map((l) => ({ ...l, shared: true }));

const nums = (stem, list, suffix = '') => list.map((n) => `${stem}${n}${suffix}.wav`);
const SC2 = {
  'p-sentry': { faction: 'protoss', groups: [
    ['Силовое поле', ['sentry_forcefieldlaunch.wav']],
    ['Щит стража', ['sentry_guardianshieldlaunch0.wav']],
    ['Галлюцинация', ['sentry_hallucinationlaunchsmall.wav', 'sentry_hallucinationlaunchmedium.wav', 'sentry_hallucinationlaunchlarge.wav']],
  ] },
  't-raynor': { faction: 'terran', groups: [
    ['Бронебойный выстрел', ['raynor_penetratorroundlaunch0.wav']],
    ['Граната', ['raynor_tossgrenadelaunch0.wav']],
  ], reuse: [['Выстрел (винтовка)', nums('marine_attacklaunch', [0, 1, 2, 3, 4, 5, 6, 7, 8]).map((f) => `assets/audio/en/terran/t-marine/${f.replace('.wav', '.mp3')}`)]] },
  'z-kerrigan': { faction: 'zerg', groups: [
    ['Пси-удар', ['kerrigan_energystrike_1.wav', 'kerrigan_energystrike_2.wav']],
    ['Электрический удар', ['kerrigan_electricstrike_1.wav']],
    ['Кинетический взрыв', ['kerrigan_kineticblast_impact00.wav', 'kerrigan_kineticblast_impact01.wav']],
    ['Луч', ['kerrigan_beamlaunch_01.wav', 'kerrigan_beamlaunch_02.wav', 'kerrigan_beamlaunch_03.wav', 'kerrigan_beammissile_01.wav', 'kerrigan_beammissile_02.wav', 'kerrigan_beammissile_03.wav']],
  ] },
};

const s = Storage.openEx('D:/Program Files (x86)/StarCraft II', { localeMask: CASC_LOCALE_ALL });
const byName = new Map();
for (const e of s.files('*')) {
  const l = e.fileName.toLowerCase();
  if (!l.endsWith('.wav') || l.includes('localizeddata') || l.includes('cutscene')) continue;
  const name = l.split('\\').pop();
  if (!byName.has(name) || l.includes('\\mods\\')) byName.set(name, e.fileName);
}

for (const [unitKey, set] of Object.entries(SC2)) {
  const destDir = path.join(root, 'assets/audio/en', set.faction, unitKey);
  await mkdir(destDir, { recursive: true });
  const lines = [];
  for (const [label, files] of set.groups) {
    let n = 0;
    for (const file of files) {
      const full = byName.get(file);
      if (!full) { console.log('not found:', file); continue; }
      n++;
      const base = file.replace(/\.wav$/, '');
      const raw = path.join(destDir, base + '.wav');
      await writeFile(raw, await s.readFileAsync(full));
      await run(ffmpegPath, ['-y', '-i', raw, '-c:a', 'libmp3lame', '-q:a', '4', path.join(destDir, base + '.mp3')]);
      await unlink(raw);
      lines.push({ file: `assets/audio/en/${set.faction}/${unitKey}/${base}.mp3`, text: files.length === 1 ? label : `${label} ${n}` });
    }
  }
  for (const [label, files] of set.reuse ?? []) files.forEach((file, i) => lines.push({ file, text: `${label} ${i + 1}` }));
  en[unitKey].categories.sfx = lines;
  ru[unitKey].categories.sfx = shared(lines);
  console.log(unitKey, lines.length);
}
s.close();

// SC1: reuse the nearest unit's existing weapon sound (same file, no copy)
const SC1 = {
  't-raynor': [['Выстрел', 'assets/audio/classic/terran/t-marine/tmafir00.mp3']],
  'z-kerrigan': [['Выстрел', 'assets/audio/classic/terran/t-ghost/tghfir00.mp3']],
  'p-zeratul': [['Удар клинком', 'assets/audio/classic/protoss/p-zealot/psiblade.mp3']],
};
for (const [unitKey, arr] of Object.entries(SC1)) {
  cl[unitKey].categories.sfx = arr.map(([text, file]) => ({ file, text }));
  console.log('sc1', unitKey, arr.length);
}

const wr = (f, d) => writeFile(path.join(root, 'data', f), JSON.stringify(d, null, 1));
await wr('quotes.en.json', en); await wr('quotes.ru.json', ru); await wr('quotes.classic.json', cl);
