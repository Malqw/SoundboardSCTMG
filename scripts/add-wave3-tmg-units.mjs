// Third wave of tabletop units: Nova, Raven, Defiler, Zagara, High Templar, Tassadar.
// Most already exist in the scraped roster and only need the TMG flag, a Russian name and
// combat SFX from the SC2 archive. Zagara has no wiki audio, so her hero barks come from the
// archive (text from the wiki's text-only quote box, matched by file index like Kerrigan).
// Spec Ops Marauder / Twilight Templar: no separate sound files exist -> not split out.
import { Storage, CASC_LOCALE_ALL } from '@jamiephan/casclib';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = 'D:/soundboard';
const rd = async (f) => JSON.parse(await readFile(path.join(root, 'data', f), 'utf-8'));
const en = await rd('quotes.en.json'), ru = await rd('quotes.ru.json'), units = await rd('units.json');

const s = Storage.openEx('D:/Program Files (x86)/StarCraft II', { localeMask: CASC_LOCALE_ALL });
const all = [];
for (const e of s.files('*')) all.push(e.fileName);
const readable = (f) => { const i = s.getFileInfo(f); return i && i.size !== 4294967295; };

// basename (lowercase) -> full path, non-localized, preferring base mod over campaigns
const byName = new Map();
for (const f of all) {
  const l = f.toLowerCase();
  if (!/\.(wav|ogg)$/.test(l) || l.includes('localizeddata') || l.includes('cutscene')) continue;
  const n = l.split('\\').pop();
  if (!byName.has(n) || l.includes('\\mods\\')) byName.set(n, f);
}
const find = (stem, limit = 99) =>
  [...byName.keys()].filter((n) => new RegExp(`^${stem}_?\\d+\\.(wav|ogg)$`).test(n) || n === `${stem}.wav`)
    .sort().slice(0, limit).filter((n) => readable(byName.get(n)));

async function toMp3(buf, ext, dir, base) {
  await mkdir(dir, { recursive: true });
  const raw = path.join(dir, base + ext);
  await writeFile(raw, buf);
  await run(ffmpegPath, ['-y', '-i', raw, '-c:a', 'libmp3lame', '-q:a', '4', path.join(dir, base + '.mp3')]);
  await unlink(raw);
}

// ---- combat SFX for existing units ---------------------------------------------------------
const SFX = {
  't-raven': { dir: 'terran', groups: [
    ['Авто-турель', 'raven_autoturretattack'], ['Ракета-охотник: пуск', 'raven_hunterseekerlaunch'],
    ['Ракета-охотник: взрыв', 'raven_seekermissile_explosion'], ['Дрон-защитник', 'raven_pointdefensedroneattacklaunch']] },
  'p-high-templar': { dir: 'protoss', groups: [
    ['Пси-шторм: пуск', 'hightemplar_psionicstormlaunch'], ['Пси-шторм: удар', 'hightemplar_psionicstormimpact'],
    ['Слияние в архонта', 'hightemplar_archonwarp']] },
  't-nova-wo-l': { dir: 'terran', groups: [
    ['Плазменная винтовка', 'nova_plasmarifle_attacklaunch'], ['Попадание', 'nova_plasmarifle_attackimpact'],
    ['Снайперская винтовка', 'nova_sniperrifleattacklaunch'], ['Попадание (снайпер)', 'nova_sniperriflebulletimpact', 4]] },
};
SFX['p-high-templar-lot-v'] = SFX['p-high-templar'];
SFX['t-nova-nco'] = SFX['t-nova-wo-l'];

for (const [key, cfg] of Object.entries(SFX)) {
  const dest = path.join(root, 'assets/audio/en', cfg.dir, key);
  const lines = [];
  for (const [label, stem, limit] of cfg.groups) {
    const names = find(stem, limit);
    let n = 0;
    for (const name of names) {
      n++;
      const base = name.replace(/\.(wav|ogg)$/, '');
      await toMp3(await s.readFileAsync(byName.get(name)), path.extname(name), dest, base);
      lines.push({ file: `assets/audio/en/${cfg.dir}/${key}/${base}.mp3`, text: names.length === 1 ? label : `${label} ${n}` });
    }
  }
  en[key].categories.sfx = lines;
  ru[key].categories.sfx = lines.map((l) => ({ ...l, shared: true }));
  console.log(key, 'sfx', lines.length);
}

// ---- Zagara hero voice ---------------------------------------------------------------------
const ZTEXT = {
  ready: ['The Swarm prevails.', 'I am eternal.'],
  help: ['The Brood is under attack.', 'You think you can defeat me?'],
  what: ['What are your commands?', 'I listen.', 'We are ready to kill.', 'The Swarm hungers.'],
  yes: ['We move.', 'Agreed.', 'The fittest shall survive.', 'Your bidding.', 'This world shall fall.', 'Our vengeance will be complete.', 'Without question.'],
  attack: ['You can not escape the Swarm!', 'Our prey nears.', 'We devour.', 'The Swarm comes for you!', 'Feel the fury of the Swarm!', 'I am your undoing.', 'Die!'],
  pissed: ['I am not interested in the possibilities of defeat, they do not exist!', "Shouldn't You be spawning more overlords?", 'Feeble creature.', 'One day I shall rule the Swarm!', 'And on that day, You die first!', 'I feel top-heavy!', "I'm a killer queen!"],
  death: ['The Swarm will never die!', 'You can not kill me!'],
};
const CAT = { ready: 'arrive', what: 'select', yes: 'move', attack: 'attack', help: 'hurt', pissed: 'witty', death: 'other' };
const zagara = new Map();
for (const f of all) {
  const l = f.toLowerCase();
  if (l.includes('enus.sc2assets') && /zagarahero_[a-z]+\d+\.(ogg|wav)$/.test(l)) zagara.set(l.split('\\').pop(), f);
}
const zEn = {}, zRu = {};
for (const [name, full] of [...zagara].sort()) {
  const m = name.match(/zagarahero_([a-z]+)(\d+)\.(ogg|wav)$/);
  if (!m || !CAT[m[1]] || !readable(full)) continue;
  const [, word, idx, ext] = m;
  const cat = CAT[word];
  const text = ZTEXT[word]?.[Number(idx)] ?? `Реплика ${Number(idx) + 1}`;
  const base = name.replace(/\.(ogg|wav)$/, '');
  await toMp3(await s.readFileAsync(full), '.' + ext, path.join(root, 'assets/audio/en/zerg/z-zagara'), base);
  (zEn[cat] ??= []).push({ file: `assets/audio/en/zerg/z-zagara/${base}.mp3`, text });
  const ruFull = full.replace(/enus\.sc2assets/i, 'ruru.sc2assets');
  let ruLine = { file: `assets/audio/en/zerg/z-zagara/${base}.mp3`, text, shared: true };
  if (all.includes(ruFull) && readable(ruFull)) {
    await toMp3(await s.readFileAsync(ruFull), '.' + ext, path.join(root, 'assets/audio/ru/zerg/z-zagara'), base);
    ruLine = { file: `assets/audio/ru/zerg/z-zagara/${base}.mp3`, text };
  }
  (zRu[cat] ??= []).push(ruLine);
}
en['z-zagara'] = { name: 'Zagara', faction: 'zerg', categories: zEn };
ru['z-zagara'] = { name: 'Zagara', faction: 'zerg', categories: zRu };
console.log('zagara', Object.fromEntries(Object.entries(zEn).map(([c, a]) => [c, a.length])));
s.close();

// ---- units.json ----------------------------------------------------------------------------
const patch = {
  't-raven': { name: 'Ворон' },
  't-nova-wo-l': { name: 'Нова', subtitle: 'Nova · Wings of Liberty', hero: true },
  't-nova-nco': { name: 'Нова', subtitle: 'Nova · Covert Ops', hero: true },
  'z-defiler': { name: 'Дефайлер' },
  'p-high-templar': { name: 'Верховный тамплиер', subtitle: 'High Templar · Wings of Liberty' },
  'p-high-templar-lot-v': { name: 'Верховный тамплиер', subtitle: 'High Templar · Legacy of the Void' },
  'p-tassadar': { name: 'Тассадар', subtitle: 'Tassadar', hero: true },
};
for (const u of units.units) if (patch[u.key]) Object.assign(u, patch[u.key], { tmg: true });
if (!units.units.some((u) => u.key === 'z-zagara')) {
  units.units.push({ key: 'z-zagara', faction: 'zerg', name: 'Загара', subtitle: 'Zagara', hero: true, games: ['sc2'], tmg: true });
}
const wr = (f, d) => writeFile(path.join(root, 'data', f), JSON.stringify(d, null, 1));
await wr('quotes.en.json', en); await wr('quotes.ru.json', ru); await wr('units.json', units);
console.log('TMG entries:', units.units.filter((u) => u.tmg).length);
