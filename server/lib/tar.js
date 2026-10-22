import fs from 'node:fs';

/*
 * A minimal POSIX ustar writer and reader for case packages (the court admin
 * app exports one; lib/case-import.js reads it). Plain tar keeps the
 * package readable with any tar tool, needs no dependency, and streams
 * multi-gigabyte trial video without holding it in memory. Only regular
 * files with short names are supported, which is all a package contains.
 */

const BLOCK = 512;
const MAX_SIZE = 8 ** 11 - 1; // the 11-digit octal size field: just under 8 GB

const octal = (n, width) => n.toString(8).padStart(width - 1, '0') + '\0';

function header(name, size, mtime) {
  if (Buffer.byteLength(name) > 100) throw new Error(`Name too long for the package: ${name}`);
  if (size > MAX_SIZE) throw new Error(`File too large for the package: ${name}`);
  const h = Buffer.alloc(BLOCK);
  h.write(name, 0, 100, 'utf8');
  h.write(octal(0o644, 8), 100, 8, 'latin1');
  h.write(octal(0, 8), 108, 8, 'latin1');
  h.write(octal(0, 8), 116, 8, 'latin1');
  h.write(octal(size, 12), 124, 12, 'latin1');
  h.write(octal(Math.floor(mtime / 1000), 12), 136, 12, 'latin1');
  h.fill(' ', 148, 156); // checksum is computed with this field as spaces
  h.write('0', 156, 1, 'latin1');
  h.write('ustar\0', 257, 6, 'latin1');
  h.write('00', 263, 2, 'latin1');
  let sum = 0;
  for (const b of h) sum += b;
  h.write(octal(sum, 7) + ' ', 148, 8, 'latin1');
  return h;
}

const padding = (size) => Buffer.alloc((BLOCK - (size % BLOCK)) % BLOCK);

/** Write a buffer, waiting when the destination is full (e.g. a slow download). */
const put = (out, chunk) => new Promise((resolve, reject) => {
  if (out.destroyed) return reject(new Error('The download was cancelled'));
  if (out.write(chunk)) resolve();
  else out.once('drain', resolve);
});

/**
 * Stream a tar to `out` (a writable such as an HTTP response). Each entry is
 * `{ name, data }` (a Buffer) or `{ name, path }` (a file on disk).
 */
export async function writeTar(out, entries) {
  const now = Date.now();
  for (const entry of entries) {
    const size = entry.data ? entry.data.length : fs.statSync(entry.path).size;
    await put(out, header(entry.name, size, now));
    if (entry.data) {
      await put(out, entry.data);
    } else {
      for await (const chunk of fs.createReadStream(entry.path)) await put(out, chunk);
    }
    await put(out, padding(size));
  }
  await put(out, Buffer.alloc(BLOCK * 2));
}

/**
 * List a tar file's entries without reading their contents:
 * `[{ name, size, offset }]`, where `offset` is where the data starts.
 */
export function listTar(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const total = fs.fstatSync(fd).size;
    const entries = [];
    const h = Buffer.alloc(BLOCK);
    let pos = 0;
    while (pos + BLOCK <= total) {
      fs.readSync(fd, h, 0, BLOCK, pos);
      if (h.every((b) => b === 0)) break; // end-of-archive marker
      let sum = 0;
      for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 32 : h[i];
      if (sum !== parseInt(h.toString('latin1', 148, 156), 8)) throw new Error('This is not a valid case package (bad tar header)');
      const name = h.toString('utf8', 0, 100).replace(/\0.*$/s, '');
      const size = parseInt(h.toString('latin1', 124, 136), 8);
      const type = h.toString('latin1', 156, 157);
      if (!Number.isFinite(size) || size < 0) throw new Error('This is not a valid case package (bad size)');
      if (pos + BLOCK + size > total) throw new Error('This case package is incomplete. Copy it again.');
      if (type === '0' || type === '\0') entries.push({ name, size, offset: pos + BLOCK });
      pos += BLOCK + size + padding(size).length;
    }
    return entries;
  } finally {
    fs.closeSync(fd);
  }
}

/** Read one small entry (such as manifest.json) into memory. */
export function readTarEntry(filePath, entry) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(entry.size);
    fs.readSync(fd, buf, 0, entry.size, entry.offset);
    return buf;
  } finally {
    fs.closeSync(fd);
  }
}

/** A stream of one entry's bytes, for copying large files out. */
export const tarEntryStream = (filePath, entry) =>
  fs.createReadStream(filePath, { start: entry.offset, end: entry.offset + entry.size - 1 });
