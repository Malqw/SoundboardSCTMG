// Maps the SC1 weapon/impact sounds the user extracted (D:\sound\SD\sound\bullet, real
// original 8.3-DOS-style filenames from 1998) onto units by their well-known abbreviation
// prefixes (tma=Terran MArine, zqu=Zerg QUeen, etc.) and adds them as an "sfx" category in
// data/quotes.classic.json, same as the SC2 combat-SFX category. Only confident mappings
// are included — a chunk of the files (blastcan, shcklnch, pshield...) are too ambiguous
// to attribute to one unit without documentation and are left out rather than guessed.
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = 'D:/soundboard';
const srcDir = 'D:/sound/SD/sound/bullet';

const MAPPING = {
  't-firebat': ['Tfrhit.wav', 'Tfrshoot.wav'],
  'p-dragoon': ['dragbull.wav'],
  'p-zealot': ['psiblade.wav'],
  'z-guardian': ['zgufir00.wav', 'zguhit00.wav'],
  'z-hydralisk': ['zhyfir00.wav', 'zhyhit00.wav', 'hkmissle.wav'],
  'z-mutalisk': ['zmufir00.wav'],
  'z-queen': ['zqufir00.wav', 'zquhit00.wav', 'zquhit01.wav', 'zquhit02.wav'],
  'z-drone': ['zdrhit00.wav'],
  'z-broodling': ['zbghit00.wav'],
  'z-devourer': ['zdeatt00.wav'],
  'z-lurker': ['ZLrkFir1.wav', 'ZLrkFir2.wav', 'ZLrkHit1.wav', 'ZLrkHit2.wav', 'zlufir00.wav', 'zluhit00.wav'],
  't-goliath': ['tgofir00.wav', 'tgofi200.wav'],
  't-siege-tank': ['ttafir00.wav', 'ttafi200.wav', 'ttahit00.wav', 'ttahi200.wav'],
  't-vulture': ['tvufir00.wav', 'tvuhit00.wav', 'tvuhit01.wav', 'tvuhit02.wav'],
  't-marine': ['tmafir00.wav'],
  't-scv': ['tscfir00.wav'],
  't-ghost': ['tghfir00.wav'],
  't-wraith': ['tphfi100.wav', 'tphfi200.wav', 'tphfi201.wav'],
  't-battlecruiser': ['tbayam00.wav'],
  'p-archon': ['parfir00.wav'],
  'p-scout': ['phofir00.wav', 'phohit00.wav', 'laserb.wav', 'laserhit.wav', 'lasrhit1.wav', 'lasrhit2.wav', 'lasrhit3.wav'],
  'p-high-templar': ['ptrfir00.wav', 'ptrfir01.wav', 'psibolt.wav'],
};

function sfxLabel(filename) {
  const l = filename.toLowerCase();
  if (l.includes('hit')) return 'Попадание';
  if (l.includes('fir') || l.includes('shoot') || l.includes('bull') || l.includes('blade') || l.includes('bolt') || l.includes('missle') || l.includes('yam') || l.includes('laser')) return 'Выстрел';
  return 'Атака';
}

const quotesClassic = JSON.parse(await readFile(path.join(root, 'data/quotes.classic.json'), 'utf-8'));
let added = 0, skippedNoUnit = 0;

for (const [unitKey, files] of Object.entries(MAPPING)) {
  if (!quotesClassic[unitKey]) { skippedNoUnit++; continue; }
  const destDir = path.join(root, 'assets/audio/classic', quotesClassic[unitKey].faction, unitKey);
  await mkdir(destDir, { recursive: true });
  quotesClassic[unitKey].categories.sfx = quotesClassic[unitKey].categories.sfx || [];
  let n = 0;
  for (const file of files) {
    n++;
    const baseName = file.replace(/\.wav$/i, '');
    const mp3Path = path.join(destDir, baseName + '.mp3');
    try {
      await run(ffmpegPath, ['-y', '-i', path.join(srcDir, file), '-c:a', 'libmp3lame', '-q:a', '4', mp3Path]);
      const rel = path.relative(root, mp3Path).split(path.sep).join('/');
      quotesClassic[unitKey].categories.sfx.push({ file: rel, text: `${sfxLabel(file)} ${n}` });
      added++;
    } catch (e) {
      console.log('FAIL', unitKey, file, e.message);
    }
  }
  console.log(unitKey, '+', files.length, 'sfx files');
}

await writeFile(path.join(root, 'data/quotes.classic.json'), JSON.stringify(quotesClassic, null, 1));
console.log(`\nDone. Added ${added} sfx files. Units without a classic.json entry (skipped): ${skippedNoUnit}`);
