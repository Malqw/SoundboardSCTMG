import { Storage } from '@jamiephan/casclib';
import { writeFile } from 'node:fs/promises';

const storage = await Storage.openAsync('D:/Program Files (x86)/StarCraft II');
console.log('opened, total files:', storage.getTotalFileCount());

const keywords = (process.argv[2] || '').toLowerCase().split(',').filter(Boolean);
const extFilter = process.argv[3]; // optional, e.g. ".ogg"

const matches = [];
for (const entry of storage.files('*')) {
  const name = entry.fileName;
  const lower = name.toLowerCase();
  if (extFilter && !lower.endsWith(extFilter)) continue;
  if (keywords.length && !keywords.some((k) => lower.includes(k))) continue;
  matches.push(name);
}
console.log('matches:', matches.length);
await writeFile('D:/soundboard/scripts/_casc-search-out.txt', matches.join('\n'));
storage.close();
