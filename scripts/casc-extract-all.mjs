// Full extraction pass using @jamiephan/casclib (direct CASC storage reader, no GUI tool
// needed): (1) fills in voice barks for units the wiki had nothing for (Zergling, Roach,
// Queen, Kerrigan — Roachling turned out to have no dedicated sounds in-game, skipped),
// (2) adds a new "combat SFX" category (actual weapon fire / impact sounds, as opposed to
// the spoken "Attack" voice barks) for every unit that has one.
import { Storage, CASC_LOCALE_ALL } from '@jamiephan/casclib';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = 'D:/soundboard';
const GAME_PATH = 'D:/Program Files (x86)/StarCraft II';

const storage = Storage.openEx(GAME_PATH, { localeMask: CASC_LOCALE_ALL });
console.log('Storage opened, total files:', storage.getTotalFileCount());

const quotesPath = path.join(root, 'data/quotes.en.json');
const quotes = JSON.parse(await readFile(quotesPath, 'utf-8'));

console.log('Listing all file names...');
const allFiles = [];
for (const e of storage.files('*')) allFiles.push(e.fileName);
console.log('Listed', allFiles.length, 'files');

function findAll(substrings, opts = {}) {
  const { excludeCampaign = false } = opts;
  return allFiles.filter((f) => {
    const l = f.toLowerCase();
    if (excludeCampaign && l.includes('campaign')) return false;
    return substrings.some((s) => l.includes(s.toLowerCase()));
  });
}

async function extractFiles(fileList, destDir) {
  await mkdir(destDir, { recursive: true });
  const written = [];
  for (const cascPath of fileList) {
    const base = cascPath.split('\\').pop();
    const dest = path.join(destDir, base);
    const buf = await storage.readFileAsync(cascPath);
    await writeFile(dest, buf);
    written.push({ cascPath, base });
  }
  return written;
}

function sfxLabel(filename) {
  const l = filename.toLowerCase();
  if (l.includes('melee')) return 'Удар';
  if (l.includes('launch')) return 'Выстрел';
  if (l.includes('impact')) return 'Попадание';
  return 'Атака';
}

// ---------------------------------------------------------------------------
// 1) Voice barks for units the wiki had nothing for
// ---------------------------------------------------------------------------

const VOICE_UNITS = [
  {
    key: 'z-zergling', faction: 'zerg', name: 'Zergling',
    patterns: ['\\zerg\\zergling\\zergling_ready', '\\zerg\\zergling\\zergling_what',
      '\\zerg\\zergling\\zergling_yes', '\\zerg\\zergling\\zergling_attack0', '\\zerg\\zergling\\zergling_attack1',
      '\\zerg\\zergling\\zergling_attack2', '\\zerg\\zergling\\zergling_attack3', '\\zerg\\zergling\\zergling_attack4',
      '\\zerg\\zergling\\zergling_pissed', '\\zerg\\zergling\\zergling_death'],
    categoryOf: (f) => {
      const l = f.toLowerCase();
      if (l.includes('ready')) return 'arrive';
      if (l.includes('what')) return 'select';
      if (l.includes('yes')) return 'move';
      if (l.includes('attack')) return 'attack';
      if (l.includes('pissed')) return 'witty';
      if (l.includes('death')) return 'other';
      return 'other';
    },
  },
  {
    key: 'z-roach', faction: 'zerg', name: 'Roach',
    patterns: ['\\zerg\\roach\\roach_ready', '\\zerg\\roach\\roach_what', '\\zerg\\roach\\roach_yes',
      '\\zerg\\roach\\roach_attack0', '\\zerg\\roach\\roach_attack1', '\\zerg\\roach\\roach_attack2', '\\zerg\\roach\\roach_attack3',
      '\\zerg\\roach\\roach_pissed', '\\zerg\\roach\\roach_death'],
    categoryOf: (f) => {
      const l = f.toLowerCase();
      if (l.includes('ready')) return 'arrive';
      if (l.includes('what')) return 'select';
      if (l.includes('yes')) return 'move';
      if (l.includes('attack')) return 'attack';
      if (l.includes('pissed')) return 'witty';
      if (l.includes('death')) return 'other';
      return 'other';
    },
  },
  {
    key: 'z-queen', faction: 'zerg', name: 'Queen',
    patterns: ['\\zerg\\queen\\queen_ready', '\\zerg\\queen\\queen_what', '\\zerg\\queen\\queen_yes',
      '\\zerg\\queen\\queen_attack0', '\\zerg\\queen\\queen_attack1', '\\zerg\\queen\\queen_attack2', '\\zerg\\queen\\queen_attack3',
      '\\zerg\\queen\\queen_attack4', '\\zerg\\queen\\queen_attack5', '\\zerg\\queen\\queen_attack6', '\\zerg\\queen\\queen_attack7',
      '\\zerg\\queen\\queen_attack8', '\\zerg\\queen\\queen_attack9', '\\zerg\\queen\\queen_death'],
    categoryOf: (f) => {
      const l = f.toLowerCase();
      if (l.includes('ready')) return 'arrive';
      if (l.includes('what')) return 'select';
      if (l.includes('yes')) return 'move';
      if (l.includes('attack')) return 'attack';
      if (l.includes('death')) return 'other';
      return 'other';
    },
  },
];

// Kerrigan (Wings of Liberty "Infested Queen of Blades" form) — real transcribed text,
// pulled from the wiki's inline UnitQuoteBox (not a reusable template, so the earlier
// scraper couldn't pick it up automatically). File order matches Blizzard's own numbering.
const KERRIGAN_TEXT = {
  arrive: ['Here I come, ready or not.'],
  hurt: ["Now I'm mad.", 'Wow. What a surprise.'],
  select: ['Wanna play?', 'Careful what you ask for.', "Cat got your tongue?", 'Who asked you?!'],
  move: ["Don't get in my way.", 'This world is mine.', 'No more games.', 'The evolution continues.', 'So predictable.'],
  attack: ['The Swarm will consume all.', 'The outcome is not in question.', 'No one gets a free pass.', "Let's have some fun.", "I don't take prisoners.", 'How stimulating.'],
  witty: ['The past is dead and buried.', "Don't get yourself into something you can't get out of.",
    'Yeah, I\'m still the Queen Bitch of the Universe.', 'You pig!', "I'm all creeped out.",
    "Come closer. Don't be afraid, I'll be gentle...(screech)", 'I like you. That\'s why I\'m going to kill you last.',
    "Nice planet. I'll take it.", "You're even more desperate than I thought."],
  other: ["I'm full of surprises...", "Don't write me off just yet."],
};

async function extractKerrigan() {
  const dir = path.join(root, 'assets/audio/en/zerg/z-kerrigan');
  const files = findAll(['zergvo\\campaignunits\\kerrigan\\kerrigan_'], {}).filter((f) =>
    f.toLowerCase().includes('enus.sc2assets')
  );
  const catFile = { arrive: [], hurt: [], select: [], move: [], attack: [], witty: [], other: [] };
  const catPrefix = { ready: 'arrive', help: 'hurt', what: 'select', yes: 'move', attack: 'attack', pissed: 'witty', death: 'other' };
  for (const f of files) {
    const base = f.split('\\').pop().toLowerCase();
    const m = base.match(/kerrigan_([a-z]+)(\d+)\.(ogg|wav)/);
    if (!m) continue;
    const [, word, idx] = m;
    const cat = catPrefix[word];
    if (!cat) continue;
    catFile[cat][Number(idx)] = f;
  }
  const categories = {};
  for (const [cat, arr] of Object.entries(catFile)) {
    const texts = KERRIGAN_TEXT[cat] || [];
    const lines = [];
    arr.forEach((cascPath, idx) => {
      if (cascPath == null) return;
      lines.push({ cascPath, text: texts[idx] || `Реплика ${idx + 1}` });
    });
    if (lines.length) categories[cat] = lines;
  }
  await mkdir(dir, { recursive: true });
  const outCategories = {};
  for (const [cat, lines] of Object.entries(categories)) {
    outCategories[cat] = [];
    for (const line of lines) {
      const localName = line.cascPath.split('\\').pop();
      let buf;
      for (let attempt = 1; attempt <= 5 && !buf; attempt++) {
        try {
          buf = await storage.readFileAsync(line.cascPath);
        } catch (e) {
          if (attempt === 5) console.log('FAILED:', JSON.stringify(line.cascPath), e.message);
        }
      }
      if (!buf) continue;
      await writeFile(path.join(dir, localName), buf);
      outCategories[cat].push({ file: `assets/audio/en/zerg/z-kerrigan/${localName}`, text: line.text });
    }
  }
  quotes['z-kerrigan'] = { name: 'Kerrigan', faction: 'zerg', categories: outCategories };
  const total = Object.values(outCategories).reduce((n, a) => n + a.length, 0);
  console.log(`Kerrigan: ${total} voice files wired in`);
}

async function extractVoiceUnit(u) {
  const dir = path.join(root, 'assets/audio/en', u.faction, u.key);
  const files = findAll(u.patterns, { excludeCampaign: true });
  const categories = {};
  const counters = {};
  for (const f of files.sort()) {
    const cat = u.categoryOf(f);
    const localName = f.split('\\').pop();
    const buf = await storage.readFileAsync(f);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, localName), buf);
    counters[cat] = (counters[cat] || 0) + 1;
    categories[cat] = categories[cat] || [];
    categories[cat].push({ file: `assets/audio/en/${u.faction}/${u.key}/${localName}`, text: `Реплика ${counters[cat]}` });
  }
  quotes[u.key] = { name: u.name, faction: u.faction, categories };
  const total = Object.values(categories).reduce((n, a) => n + a.length, 0);
  console.log(`${u.name}: ${total} voice files wired in`);
}

for (const u of VOICE_UNITS) await extractVoiceUnit(u);
await extractKerrigan();

// ---------------------------------------------------------------------------
// 2) Combat SFX (real weapon fire / impact sounds) for every unit that has one
// ---------------------------------------------------------------------------

const SFX_UNITS = [
  { key: 't-marine', faction: 'terran', patterns: ['\\terran\\marine\\marine_attacklaunch'], excludeCampaign: true },
  { key: 't-marauder', faction: 'terran', patterns: ['\\terran\\marauder\\marauder_attacklaunch'], excludeCampaign: true },
  { key: 't-goliath', faction: 'terran', patterns: ['\\terran\\goliath\\goliath_groundattacklaunch'], excludeCampaign: true },
  { key: 'p-zealot', faction: 'protoss', patterns: ['\\protoss\\zealot\\zealot_attacklaunch'], excludeCampaign: true },
  { key: 'p-adept', faction: 'protoss', patterns: ['\\sounds\\adept_attacklaunch', '\\sounds\\adept_attackimpact'], excludeCampaign: true },
  { key: 'p-stalker', faction: 'protoss', patterns: ['\\protoss\\stalker\\stalker_attacklaunch', '\\protoss\\stalker\\stalker_attackimpact'], excludeCampaign: true },
  { key: 'p-artanis-lotv', faction: 'protoss', patterns: ['\\sounds\\artanis_psibladeattacklaunch'], excludeCampaign: false },
  { key: 'p-artanis-wol', faction: 'protoss', patterns: ['\\sounds\\artanis_psibladeattacklaunch'], excludeCampaign: false },
  { key: 'z-hydralisk', faction: 'zerg', patterns: ['\\zerg\\hydralisk\\hydralisk_attacklaunchranged', '\\zerg\\hydralisk\\hydralisk_attackimpactranged'], excludeCampaign: true },
  { key: 'z-zergling', faction: 'zerg', patterns: ['\\zerg\\zergling\\zergling_attacklaunch'], excludeCampaign: true },
  { key: 'z-roach', faction: 'zerg', patterns: ['\\zerg\\roach\\roach_attacklaunch', '\\zerg\\roach\\roach_attackimpact'], excludeCampaign: true },
  { key: 'z-queen', faction: 'zerg', patterns: ['\\zerg\\queen\\queen_attackimpactranged', '\\zerg\\queenofblades\\queenofblades_rangedattacklaunch'], excludeCampaign: true },
];

for (const u of SFX_UNITS) {
  const dir = path.join(root, 'assets/audio/en', u.faction, u.key);
  const files = findAll(u.patterns, { excludeCampaign: u.excludeCampaign });
  if (!files.length) { console.log(`${u.key}: no combat SFX found`); continue; }
  await mkdir(dir, { recursive: true });
  const lines = [];
  let n = 0;
  for (const f of files.sort()) {
    n++;
    const localName = f.split('\\').pop();
    const buf = await storage.readFileAsync(f);
    await writeFile(path.join(dir, localName), buf);
    lines.push({ file: `assets/audio/en/${u.faction}/${u.key}/${localName}`, text: `${sfxLabel(localName)} ${n}` });
  }
  quotes[u.key] = quotes[u.key] || { name: u.key, faction: u.faction, categories: {} };
  quotes[u.key].categories.sfx = lines;
  console.log(`${u.key}: ${lines.length} combat SFX files wired in`);
}

await writeFile(quotesPath, JSON.stringify(quotes, null, 1));
storage.close();
console.log('\nDone. Wrote', quotesPath);
