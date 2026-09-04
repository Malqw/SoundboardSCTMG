// Merges the full-roster wiki scrape (data in scripts/_full-roster-raw.json, produced by
// a one-off browser session — the wiki is behind Cloudflare, see README) into the existing
// curated data. Existing TMG units keep their hand-verified entries (real Kerrigan text,
// CASC-sourced Zergling/Roach/Queen, etc.) — only genuinely new units get downloaded here.
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = 'D:/soundboard';

const raw = JSON.parse(await readFile(path.join(root, 'scripts/_full-roster-raw.json'), 'utf-8'));
const quotesEn = JSON.parse(await readFile(path.join(root, 'data/quotes.en.json'), 'utf-8'));
const quotesClassic = JSON.parse(await readFile(path.join(root, 'data/quotes.classic.json'), 'utf-8'));
const unitsCfg = JSON.parse(await readFile(path.join(root, 'data/units.json'), 'utf-8'));

const FACTION_LETTER = { Terran: 't', Protoss: 'p', Zerg: 'z' };

const SC2_OVERLAP = {
  QuotesSC2Marine: 't-marine', QuotesSC2Marauder: 't-marauder', QuotesSC2Medic: 't-medic',
  QuotesSC2Goliath: 't-goliath', QuotesSC2Raynor: 't-raynor', QuotesSC2Zealot: 'p-zealot',
  QuotesSC2Adept: 'p-adept', QuotesSC2Sentry: 'p-sentry', QuotesSC2Stalker: 'p-stalker',
  QuotesSC2ArtanisWoL: 'p-artanis-wol', QuotesSC2ArtanisLotV: 'p-artanis-lotv',
  QuotesSC2Hydralisk: 'z-hydralisk',
};
const SC1_OVERLAP = {
  QuotesSC1Marine: 't-marine', QuotesSC1Medic: 't-medic', QuotesSC1Goliath: 't-goliath',
  QuotesSC1RaynorMarine: 't-raynor', QuotesSC1Zealot: 'p-zealot', QuotesSC1Artanis: 'p-artanis-lotv',
  QuotesSC1Zergling: 'z-zergling', QuotesSC1Hydralisk: 'z-hydralisk', QuotesSC1Queen: 'z-queen',
  QuotesSC1KerriganGhost: 'z-kerrigan',
};

function templateSlug(template, prefix) {
  return template.slice(prefix.length).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

async function mapLimit(items, limit, fn) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
}

async function downloadAndTranscode(url, destDir, baseName) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await mkdir(destDir, { recursive: true });
  const oggPath = path.join(destDir, baseName + `.${Math.random().toString(36).slice(2)}.ogg`);
  await writeFile(oggPath, buf);
  const mp3Path = path.join(destDir, baseName + '.mp3');
  await run(ffmpegPath, ['-y', '-i', oggPath, '-c:a', 'libmp3lame', '-q:a', '4', mp3Path]);
  await unlink(oggPath);
  return mp3Path;
}

// --- build the flat job list -------------------------------------------------
const newUnitsByKey = new Map();
const jobs = [];

function registerGame(gameKey, results, overlapMap, langFile, prefix, audioSubdir) {
  for (const [template, unit] of Object.entries(results)) {
    const faction = FACTION_LETTER[unit.race];
    if (!faction) continue;
    if (overlapMap[template]) continue;

    const key = `${faction}-${templateSlug(template, prefix)}`;
    if (!newUnitsByKey.has(key)) {
      newUnitsByKey.set(key, { key, faction: unit.race.toLowerCase(), name: unit.label, subtitle: unit.label, games: [], tmg: false });
    }
    if (!langFile[key]) {
      langFile[key] = { name: unit.label, faction: unit.race.toLowerCase(), categories: {} };
    }
    const entry = newUnitsByKey.get(key);
    if (!entry.games.includes(gameKey)) entry.games.push(gameKey);

    const destDir = path.join(root, 'assets/audio', audioSubdir, unit.race.toLowerCase(), key);
    for (const [cat, lines] of Object.entries(unit.categories)) {
      langFile[key].categories[cat] = langFile[key].categories[cat] || [];
      for (const line of lines) {
        if (!line.url) continue;
        jobs.push({ key, cat, line, destDir, langFile, gameKey });
      }
    }
  }
}

registerGame('sc2', raw.sc2, SC2_OVERLAP, quotesEn, 'QuotesSC2', 'en');
registerGame('sc1', raw.sc1, SC1_OVERLAP, quotesClassic, 'QuotesSC1', 'classic');

console.log(`Jobs: ${jobs.length}, new units: ${newUnitsByKey.size}`);

let ok = 0, fail = 0, done = 0;
const inFlight = new Map(); // dedupe: same file can appear in >1 category (e.g. Marine What00)
await mapLimit(jobs, 16, async (job) => {
  const baseName = job.line.file.replace(/\.ogg$/i, '');
  const dedupeKey = `${job.destDir}|${baseName}`;
  try {
    if (!inFlight.has(dedupeKey)) {
      inFlight.set(dedupeKey, downloadAndTranscode(job.line.url, job.destDir, baseName));
    }
    const mp3Path = await inFlight.get(dedupeKey);
    const rel = path.relative(root, mp3Path).split(path.sep).join('/');
    job.langFile[job.key].categories[job.cat].push({ file: rel, text: job.line.text });
    ok++;
  } catch (e) {
    fail++;
  }
  done++;
  if (done % 200 === 0) console.log(`${done}/${jobs.length} (ok ${ok}, fail ${fail})`);
});

// drop units that ended up with zero successfully downloaded lines
for (const [key, entry] of newUnitsByKey) {
  const total = Object.values(quotesEn[key]?.categories ?? {}).reduce((n, a) => n + a.length, 0)
    + Object.values(quotesClassic[key]?.categories ?? {}).reduce((n, a) => n + a.length, 0);
  if (total === 0) {
    newUnitsByKey.delete(key);
    delete quotesEn[key];
    delete quotesClassic[key];
  }
}

const SC1_NATIVE_TMG = new Set(Object.values(SC1_OVERLAP));
for (const u of unitsCfg.units) {
  const games = ['sc2'];
  if (SC1_NATIVE_TMG.has(u.key)) games.push('sc1');
  u.games = games;
  u.tmg = true;
}
unitsCfg.units.push(...newUnitsByKey.values());

await writeFile(path.join(root, 'data/quotes.en.json'), JSON.stringify(quotesEn, null, 1));
await writeFile(path.join(root, 'data/quotes.classic.json'), JSON.stringify(quotesClassic, null, 1));
await writeFile(path.join(root, 'data/units.json'), JSON.stringify(unitsCfg, null, 1));

console.log(`\nDone. ok=${ok} fail=${fail}. New units: ${newUnitsByKey.size}`);
