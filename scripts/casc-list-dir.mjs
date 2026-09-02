import { Storage } from '@jamiephan/casclib';
import { writeFile } from 'node:fs/promises';

const storage = await Storage.openAsync('D:/Program Files (x86)/StarCraft II');
const prefix = process.argv[2].toLowerCase();
const out = [];
for (const entry of storage.files('*')) {
  if (entry.fileName.toLowerCase().includes(prefix)) out.push(entry.fileName);
}
out.sort();
console.log('matches:', out.length);
await writeFile('D:/soundboard/scripts/_casc-list-out.txt', out.join('\n'));
storage.close();
