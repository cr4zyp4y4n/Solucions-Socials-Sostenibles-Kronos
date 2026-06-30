import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseJotriAlbaran, parseAlbaranText } from '../src/services/obradorAlbaranParser.js';
import { buildOcrDebugReport, formatOcrDebugText } from '../src/utils/obradorOcrDebug.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const samplePath = path.join(root, 'JOTRI_ocr_sample.txt');

const text = `| 157037 | 28052 | | 006 F67499186 931 742.054
ALBARA DE VENDA Pagina 1 de 1
CUINATS JOTRI S.L.U.
NIF: B17209693
###JOTRI_BODY###
210704/0  |Patates braves caixa 4kg. 14012726 (1) 1 4,00 6,24 24,96
2400.0.0.0¢ |Truita de patates i ceba 1kg x 4 u. 26129 (1) 1 4,00 6,30 25,20
310002/J Lasanya de carn 500 g 25114526 (1) 1,00 5,89 5,89`;

const parsed = parseJotriAlbaran(text);
console.log(JSON.stringify(parsed, null, 2));
console.log('--- debug ---');
console.log(formatOcrDebugText(buildOcrDebugReport({ fileName: 'JOTRI.pdf', ocrMeta: { source: 'test' }, ocrText: text, parsed })));
