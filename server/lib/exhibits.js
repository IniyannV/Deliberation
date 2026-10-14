import fs from 'node:fs';

export const EXHIBIT_TYPES = ['pdf', 'image', 'transcript'];
export const PARTIES = ['prosecution', 'defense', 'joint', 'court'];

const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

/**
 * Decide an upload's exhibit type by sniffing the file's first bytes, not
 * by trusting the browser-supplied MIME type. SVG and HTML are refused
 * because they can carry script.
 */
export function sniffFile(filePath, originalName) {
  const fd = fs.openSync(filePath, 'r');
  const head = Buffer.alloc(16);
  fs.readSync(fd, head, 0, 16, 0);
  fs.closeSync(fd);
  const ext = originalName.toLowerCase().split('.').pop();

  if (head.subarray(0, 5).toString('latin1') === '%PDF-') return { type: 'pdf', mime: 'application/pdf' };
  if (head[0] === 0x89 && head.subarray(1, 4).toString('latin1') === 'PNG') return { type: 'image', mime: IMAGE_MIME.png };
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { type: 'image', mime: IMAGE_MIME.jpg };
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return { type: 'image', mime: IMAGE_MIME.webp };
  if (head.subarray(0, 4).toString('latin1') === 'GIF8') return { type: 'image', mime: IMAGE_MIME.gif };
  if (ext === 'txt') {
    const text = fs.readFileSync(filePath, 'utf8');
    if (!/<\s*(svg|script|html)/i.test(text)) return { type: 'transcript', mime: 'text/plain; charset=utf-8' };
  }
  return null;
}

/**
 * Transcript text → numbered lines. A line that starts with an upper-case
 * label and a colon ("Q:", "MS. OKAFOR:") is split into speaker + text.
 */
export function parseTranscript(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const m = line.match(/^([A-Z][A-Z .'-]{0,40}):\s*(.*)$/);
      return m ? { n: i + 1, speaker: m[1].trim(), text: m[2] } : { n: i + 1, speaker: null, text: line };
    });
}

export function exhibitSummary(e) {
  const { lines, file, ...rest } = e;
  return { ...rest, mime: file?.mime ?? null, size: file?.size ?? null, lineCount: lines?.length ?? 0 };
}

/** Case-insensitive AND search over number, title, description and transcript lines. */
export function searchExhibits(exhibits, { q = '', type, party }) {
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (const e of exhibits) {
    if (type && e.type !== type) continue;
    if (party && e.party !== party) continue;
    if (!terms.length) {
      out.push({ ...exhibitSummary(e), hits: [] });
      continue;
    }
    const meta = `${e.number} ${e.title} ${e.description ?? ''}`.toLowerCase();
    const lineText = (e.lines ?? []).map((l) => `${l.speaker ?? ''} ${l.text}`.toLowerCase());
    const all = meta + ' ' + lineText.join(' ');
    if (!terms.every((t) => all.includes(t))) continue;
    const hits = [];
    (e.lines ?? []).forEach((l, i) => {
      if (hits.length < 3 && terms.some((t) => lineText[i].includes(t))) hits.push({ n: l.n, speaker: l.speaker, text: l.text });
    });
    out.push({ ...exhibitSummary(e), hits, titleMatch: terms.some((t) => meta.includes(t)) });
  }
  return out;
}

/** Sort P-2 before P-10, prosecution before defense, transcripts last. */
export function compareExhibitNumbers(a, b) {
  return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' });
}
