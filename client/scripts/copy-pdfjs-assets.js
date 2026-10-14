// Copies pdf.js support files (character maps, standard fonts, wasm decoders)
// into public/ so PDFs render with zero network access beyond this server.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'pdfjs');

for (const dir of ['cmaps', 'standard_fonts', 'wasm']) {
  const src = path.join(pdfjsRoot, dir);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, dir), { recursive: true });
}
console.log(`pdf.js assets copied to ${path.relative(process.cwd(), out)}`);
