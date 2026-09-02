// The game ships some sounds as IMA ADPCM .wav, which browsers refuse to decode
// (<audio> throws a decode error). Convert every such file to .ogg (Vorbis) with
// ffmpeg-static, then repoint data/quotes.en.json at the new files and delete the .wav.
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = 'D:/soundboard';

async function findWavFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await findWavFiles(full)));
    else if (entry.name.toLowerCase().endsWith('.wav')) out.push(full);
  }
  return out;
}

const audioRoot = path.join(root, 'assets/audio');
const wavFiles = await findWavFiles(audioRoot);
console.log('Found', wavFiles.length, '.wav files to transcode');

const renameMap = {}; // old relative path (posix, with /) -> new relative path

for (const wavPath of wavFiles) {
  const oggPath = wavPath.replace(/\.wav$/i, '.ogg');
  await run(ffmpegPath, ['-y', '-i', wavPath, '-c:a', 'libvorbis', '-q:a', '4', oggPath]);
  await unlink(wavPath);
  const relOld = path.relative(root, wavPath).split(path.sep).join('/');
  const relNew = path.relative(root, oggPath).split(path.sep).join('/');
  renameMap[relOld] = relNew;
  console.log('transcoded', relOld, '->', relNew);
}

const quotesPath = path.join(root, 'data/quotes.en.json');
const quotes = JSON.parse(await readFile(quotesPath, 'utf-8'));
let patched = 0;
for (const unit of Object.values(quotes)) {
  for (const lines of Object.values(unit.categories)) {
    for (const line of lines) {
      if (renameMap[line.file]) {
        line.file = renameMap[line.file];
        patched++;
      }
    }
  }
}
await writeFile(quotesPath, JSON.stringify(quotes, null, 1));
console.log(`\nTranscoded ${wavFiles.length} files, patched ${patched} references in quotes.en.json`);
