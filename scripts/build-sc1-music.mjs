// Transcodes the SC1 music the user extracted with MPQ Editor (D:\sound\music, already
// Ogg Vorbis — but re-encode to mp3 for the same Safari/iOS reason as everything else)
// and merges it into data/music.json alongside the existing SC2 tracks (source: 'sc2').
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = 'D:/soundboard';
const srcDir = 'D:/sound/music';

const NAMES = {
  title: 'Title Theme',
  terran1: 'Terran I', terran2: 'Terran II', terran3: 'Terran III', terran4: 'Terran IV',
  protoss1: 'Protoss I', protoss2: 'Protoss II', protoss3: 'Protoss III', protoss4: 'Protoss IV',
  zerg1: 'Zerg I', zerg2: 'Zerg II', zerg3: 'Zerg III', zerg4: 'Zerg IV',
  trdyroom: 'Terran Ready Room', prdyroom: 'Protoss Ready Room', zrdyroom: 'Zerg Ready Room',
  tvict: 'Terran Victory', pvict: 'Protoss Victory', zvict: 'Zerg Victory',
  tdefeat: 'Terran Defeat', pdefeat: 'Protoss Defeat', zdefeat: 'Zerg Defeat',
  radiofreezerg: 'Radio Free Zerg',
};

const destDir = path.join(root, 'assets/music/sc1');
await mkdir(destDir, { recursive: true });

const files = (await readdir(srcDir)).filter((f) => f.toLowerCase().endsWith('.ogg'));
const entries = [];
for (const f of files) {
  const key = f.replace(/\.ogg$/i, '');
  const mp3Path = path.join(destDir, key + '.mp3');
  await run(ffmpegPath, ['-y', '-i', path.join(srcDir, f), '-c:a', 'libmp3lame', '-q:a', '3', mp3Path]);
  const rel = path.relative(root, mp3Path).split(path.sep).join('/');
  entries.push({ key: `sc1-${key}`, name: NAMES[key] || key, file: rel, source: 'sc1' });
  console.log('transcoded', key);
}

const musicPath = path.join(root, 'data/music.json');
const music = JSON.parse(await readFile(musicPath, 'utf-8'));
const existingKeys = new Set(music.map((m) => m.key));
for (const e of entries) if (!existingKeys.has(e.key)) music.push(e);
await writeFile(musicPath, JSON.stringify(music, null, 1));
console.log(`\nDone. Added ${entries.length} SC1 tracks. Total tracks: ${music.length}`);
