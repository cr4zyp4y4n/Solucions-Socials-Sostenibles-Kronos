import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseAlvilardanAlbaran } from '../src/services/obradorAlbaranParser.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const text = fs.readFileSync(path.join(root, 'ALVILARDAN_ocr_sample.txt'), 'utf8');

const p = parseAlvilardanAlbaran(text);
console.log('lot:', p.lotProveidor, p.lotProveidor === '455739' ? 'OK' : 'FAIL');
console.log(JSON.stringify(p, null, 2));
