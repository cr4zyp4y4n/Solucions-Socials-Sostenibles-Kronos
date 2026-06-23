import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseMultiembalajesAlbaran, parseAlbaranText } from '../src/services/obradorAlbaranParser.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const text = fs.readFileSync(path.join(root, 'MULTIEMBALAJES_ocr_sample.txt'), 'utf8');

console.log(JSON.stringify(parseMultiembalajesAlbaran(text), null, 2));
console.log('--- via parseAlbaranText ---');
console.log(JSON.stringify(parseAlbaranText(text), null, 2));
