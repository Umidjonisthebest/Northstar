// Print the layout of one page: text lines (x, y, height, font) and drawn shapes.
// Usage: node layout.mjs <pdf> <pageNo>
import { openPdf, readPage, toLines } from './lib.mjs';

const [file, pageNo] = process.argv.slice(2);
const doc = await openPdf(file);
const { items, shapes } = await readPage(doc, Number(pageNo));
for (const l of toLines(items)) {
  const fonts = [...new Set(l.items.map((it) => it.font.slice(-2)))].join(',');
  console.log(`y${l.y.toFixed(1).padStart(6)} x${l.x.toFixed(1).padStart(6)}-${l.x2.toFixed(0).padStart(3)} h${l.h.toFixed(1)} ${fonts.padEnd(8)}| ${l.text.slice(0, 95)}`);
}
console.log('--- shapes (x1,y1,x2,y2 w×h)');
for (const s of shapes) {
  const w = s.x2 - s.x1; const h = s.y2 - s.y1;
  if (w > 600 && h > 700) continue;
  console.log(`${s.kind}/${s.paint} x${s.x1.toFixed(1)}-${s.x2.toFixed(1)} y${s.y1.toFixed(1)}-${s.y2.toFixed(1)}  ${w.toFixed(1)}×${h.toFixed(1)}`);
}
