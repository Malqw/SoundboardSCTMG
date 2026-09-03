// Safari/iOS never supported Ogg Vorbis (WebKit only decodes MP3/AAC/WAV/CAF) — the
// whole library was in .ogg, which played fine in Chrome (used for local testing) but
// silently failed on iPhones. MP3 is the one format every browser (desktop + mobile)
// decodes natively, so re-encode everything to it and repoint quotes.en.json.
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const root = 'D:/soundboard';

async function findOggFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await findOggFiles(full)));
    else if (entry.name.toLowerCase().endsWith('.ogg')) out.push(full);
  }
  return out;
}

const audioRoot = path.join(root, 'assets/audio');
const oggFiles = await findOggFiles(audioRoot);
console.log('Found', oggFiles.length, '.ogg files to transcode to mp3');

const renameMap = {};
let done = 0;

for (const oggPath of oggFiles) {
  const mp3Path = oggPath.replace(/\.ogg$/i, '.mp3');
  await run(ffmpegPath, ['-y', '-i', oggPath, '-c:a', 'libmp3lame', '-q:a', '4', mp3Path]);
  await unlink(oggPath);
  const relOld = path.relative(root, oggPath).split(path.sep).join('/');
  const relNew = path.relative(root, mp3Path).split(path.sep).join('/');
  renameMap[relOld] = relNew;
  done++;
  if (done % 50 === 0) console.log(done, '/', oggFiles.length);
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
console.log(`\nTranscoded ${oggFiles.length} files to mp3, patched ${patched} references in quotes.en.json`);
