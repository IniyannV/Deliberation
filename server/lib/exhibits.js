import fs from 'node:fs';

export const EXHIBIT_TYPES = ['pdf', 'image', 'transcript', 'video', 'youtube'];
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
  // MP4 and QuickTime share the ISO box format: an 'ftyp' box comes first.
  if (head.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = head.subarray(8, 12).toString('latin1');
    if (/^M4[ABP]/.test(brand)) return null; // audio-only and audiobook files
    return { type: 'video', mime: brand === 'qt  ' ? 'video/quicktime' : 'video/mp4' };
  }
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return { type: 'video', mime: 'video/webm' };
  if (ext === 'txt') {
    const text = fs.readFileSync(filePath, 'utf8');
    if (!/<\s*(svg|script|html)/i.test(text)) return { type: 'transcript', mime: 'text/plain; charset=utf-8' };
  }
  return null;
}

/**
 * Frames per second of an MP4/MOV's video track, read from its header boxes
 * (moov → trak → mdia: the 'vide' handler's mdhd timescale over the most
 * common stts sample delta). Lets jurors step exactly one frame at a time.
 * Returns null for WebM or anything it can't read.
 */
export function probeVideoFps(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const total = fs.fstatSync(fd).size;
    const head = Buffer.alloc(16);
    // Find the top-level moov box without reading the (possibly huge) media data.
    let pos = 0;
    let moov = null;
    while (pos + 8 <= total) {
      fs.readSync(fd, head, 0, 16, pos);
      let size = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      let hdr = 8;
      if (size === 1) { size = Number(head.readBigUInt64BE(8)); hdr = 16; }
      if (size === 0) size = total - pos;
      if (size < hdr) return null;
      if (type === 'moov') {
        if (size > 64 * 1024 * 1024) return null;
        moov = Buffer.alloc(size - hdr);
        fs.readSync(fd, moov, 0, moov.length, pos + hdr);
        break;
      }
      pos += size;
    }
    if (!moov) return null;

    const children = (buf, start = 0, end = buf.length) => {
      const out = [];
      for (let p = start; p + 8 <= end;) {
        const size = buf.readUInt32BE(p);
        if (size < 8 || p + size > end) break;
        out.push({ type: buf.toString('latin1', p + 4, p + 8), start: p + 8, end: p + size });
        p += size;
      }
      return out;
    };
    const child = (buf, box, type) => children(buf, box.start, box.end).find((b) => b.type === type);

    for (const trak of children(moov).filter((b) => b.type === 'trak')) {
      const mdia = child(moov, trak, 'mdia');
      const hdlr = mdia && child(moov, mdia, 'hdlr');
      if (!hdlr || moov.toString('latin1', hdlr.start + 8, hdlr.start + 12) !== 'vide') continue;
      const mdhd = child(moov, mdia, 'mdhd');
      const stbl = child(moov, child(moov, mdia, 'minf') ?? { start: 0, end: 0 }, 'stbl');
      const stts = stbl && child(moov, stbl, 'stts');
      if (!mdhd || !stts) return null;
      const timescale = moov.readUInt32BE(mdhd.start + (moov[mdhd.start] === 1 ? 20 : 12));
      const entries = moov.readUInt32BE(stts.start + 4);
      let best = { count: 0, delta: 0 };
      for (let i = 0; i < entries && stts.start + 16 + i * 8 <= stts.end; i++) {
        const count = moov.readUInt32BE(stts.start + 8 + i * 8);
        const delta = moov.readUInt32BE(stts.start + 12 + i * 8);
        if (count > best.count) best = { count, delta };
      }
      const fps = best.delta ? timescale / best.delta : 0;
      return fps >= 1 && fps <= 240 ? Math.round(fps * 1000) / 1000 : null;
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * A YouTube video ID from a watch, share, embed, shorts or live link, or a bare ID.
 * Returns null if it isn't one.
 */
export function youtubeId(input) {
  const s = String(input ?? '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let url;
  try { url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/)?.[1] ?? null;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
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
  const { lines, file, spec, ...rest } = e;
  return {
    ...rest,
    mime: file?.mime ?? null,
    size: file?.size ?? null,
    lineCount: lines?.length ?? 0,
    // The first few lines, so the locker can show what a transcript looks like.
    preview: lines ? lines.slice(0, 8) : null,
  };
}

/** Case-insensitive AND search over number, title, description and transcript lines. */
export function searchExhibits(exhibits, { q = '', type, party }) {
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (const e of exhibits) {
    // YouTube exhibits are videos to a juror, so the video filter takes them too.
    if (type && e.type !== type && !(type === 'video' && e.type === 'youtube')) continue;
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
