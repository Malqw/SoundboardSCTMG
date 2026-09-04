// Hand-picked "greatest hits" from StarCraft II's score (SC2's dynamic combat/ambient
// music library, mods\liberty.sc2mod\base.sc2assets\assets\music\ — the same score
// engine drives both campaign and ladder/multiplayer background music). Filtered out:
// per-cue dynamic layering stems (files split "a"/"b"/"c"... meant to crossfade live,
// not stand-alone songs — one representative variant kept per piece), UI stingers,
// campaign mission-specific cues, cutscene-only tracks, and the bundled Warcraft III
// assets that ship inside the same client. StarCraft (1)/Remastered's CASC storage has
// no file-name table at all (unlike SC2), so its OST isn't extractable the same way —
// not included here, flagged as a gap in the project notes.
import { Storage, CASC_LOCALE_ALL } from '@jamiephan/casclib';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = 'D:/soundboard';

const TRACKS = [
  { key: 'battlenet-theme', name: 'Battle.net Theme', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\battlenet_musicwithendfade.ogg` },
  { key: 'broken-wings', name: 'Broken Wings', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\broken wings a.ogg` },
  { key: 'brood-war-aria', name: 'Brood War Aria', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\broodwararia.ogg` },
  { key: 'cities-in-ruin', name: 'Cities in Ruin', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\cities_in_ruin_full.ogg` },
  { key: 'directorate-menace', name: 'Directorate Menace', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\directorate menace a.ogg` },
  { key: 'evolution-1', name: 'Evolution I', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\evolution_1_full.ogg` },
  { key: 'evolution-2', name: 'Evolution II', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\evolution_2_full.ogg` },
  { key: 'evolution-3', name: 'Evolution III', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\evolution_3_full.ogg` },
  { key: 'furiousity', name: 'Furiousity', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\furiousity a.ogg` },
  { key: 'fury', name: 'Fury', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\fury a.ogg` },
  { key: 'haunted-mines-1', name: 'Haunted Mines I', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\hauntedmines_01.ogg` },
  { key: 'haunted-mines-2', name: 'Haunted Mines II', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\hauntedmines_02.ogg` },
  { key: 'space-ambient-hots', name: 'Space Ambient (HotS)', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\hots_music_space_ambient.ogg` },
  { key: 'zerus-ambient-1', name: 'Zerus Ambient I', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\hots_music_zerus_ambient.ogg` },
  { key: 'zerus-ambient-2', name: 'Zerus Ambient II', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\hots_music_zerus_ambient2.ogg` },
  { key: 'love-theme', name: 'Love Theme', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\love_theme_v2_full.ogg` },
  { key: 'onslaught', name: 'Onslaught', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\onslaught_full.ogg` },
  { key: 'space-1', name: 'Space I', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\space_1_full.ogg` },
  { key: 'space-2', name: 'Space II', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\space_2_full.ogg` },
  { key: 'space-battle-2', name: 'Space Battle II', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\space_battle_2_full.ogg` },
  { key: 'the-rescue', name: 'The Rescue', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\the_rescue_full.ogg` },
  { key: 'swarm-titan', name: 'Swarm: Titan', file: String.raw`mods\liberty.sc2mod\base.sc2assets\assets\music\zswarm_music_titan_full.ogg` },
];

const storage = Storage.openEx('D:/Program Files (x86)/StarCraft II', { localeMask: CASC_LOCALE_ALL });
console.log('opened, total files:', storage.getTotalFileCount());

const destDir = path.join(root, 'assets/music/sc2');
await mkdir(destDir, { recursive: true });

const manifest = [];
let ok = 0, fail = 0;

for (const t of TRACKS) {
  if (!storage.fileExists(t.file)) {
    console.log('MISSING', t.key, t.file);
    fail++;
    continue;
  }
  try {
    const buf = await storage.readFileAsync(t.file);
    const oggPath = path.join(destDir, t.key + '.ogg');
    await writeFile(oggPath, buf);
    const mp3Path = path.join(destDir, t.key + '.mp3');
    await run(ffmpegPath, ['-y', '-i', oggPath, '-c:a', 'libmp3lame', '-q:a', '3', mp3Path]);
    await import('node:fs/promises').then((fs) => fs.unlink(oggPath));
    const rel = path.relative(root, mp3Path).split(path.sep).join('/');
    manifest.push({ key: t.key, name: t.name, file: rel, source: 'sc2' });
    ok++;
    console.log('OK', t.key, `(${(buf.length / 1024 / 1024).toFixed(1)}MB)`);
  } catch (e) {
    console.log('FAIL', t.key, e.message);
    fail++;
  }
}

storage.close();
await writeFile(path.join(root, 'data/music.json'), JSON.stringify(manifest, null, 1));
console.log(`\nOK ${ok}, FAIL ${fail}. Wrote data/music.json`);
