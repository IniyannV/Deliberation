import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { canvas, exhibitTag } from './raster.js';

/* ── PDFs ──────────────────────────────────────────────────────────── */

function wrap(text, font, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Builds a simple court-style document. `blocks` is a list of
 * { heading } | { para } | { rows: [[label, value], ...] } | { table: { cols, rows } } | { pageBreak: true }
 */
export async function makePdf({ exhibit, title, subtitle, blocks }) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${exhibit}: ${title}`);
  doc.setProducer('Deliberation Room seed script');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612, H = 792, M = 64;
  let page, y;

  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
    page.drawText('MILLBROOK COUNTY SUPERIOR COURT  ·  26-CR-0418', { x: M, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    // Exhibit sticker
    page.drawRectangle({ x: W - M - 92, y: y - 14, width: 92, height: 30, color: rgb(0.98, 0.96, 0.84), borderColor: rgb(0.47, 0.43, 0.27), borderWidth: 1 });
    page.drawText(`EXHIBIT ${exhibit}`, { x: W - M - 84, y: y - 3, size: 10, font: bold, color: rgb(0.27, 0.24, 0.12) });
    y -= 44;
  };
  const ensure = (h) => { if (y - h < M) newPage(); };

  newPage();
  page.drawText(title, { x: M, y, size: 18, font: bold });
  y -= 22;
  if (subtitle) {
    page.drawText(subtitle, { x: M, y, size: 11, font, color: rgb(0.35, 0.35, 0.35) });
    y -= 18;
  }
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: rgb(0.7, 0.7, 0.7) });
  y -= 22;

  for (const b of blocks) {
    if (b.pageBreak) { newPage(); continue; }
    if (b.heading) {
      ensure(30);
      page.drawText(b.heading, { x: M, y, size: 12, font: bold });
      y -= 20;
    }
    if (b.para) {
      for (const l of wrap(b.para, font, 11, W - 2 * M)) {
        ensure(16);
        page.drawText(l, { x: M, y, size: 11, font });
        y -= 15;
      }
      y -= 8;
    }
    if (b.rows) {
      for (const [label, value] of b.rows) {
        const lines = wrap(String(value), font, 11, W - 2 * M - 160);
        ensure(16 * lines.length);
        page.drawText(label, { x: M, y, size: 11, font: bold });
        lines.forEach((l, i) => page.drawText(l, { x: M + 160, y: y - i * 15, size: 11, font }));
        y -= 15 * lines.length + 5;
      }
      y -= 8;
    }
    if (b.table) {
      const { cols, rows } = b.table;
      const colW = (W - 2 * M) / cols.length;
      ensure(22);
      page.drawRectangle({ x: M, y: y - 5, width: W - 2 * M, height: 19, color: rgb(0.92, 0.92, 0.9) });
      cols.forEach((c, i) => page.drawText(c, { x: M + 6 + i * colW, y, size: 10, font: bold }));
      y -= 20;
      for (const r of rows) {
        ensure(16);
        r.forEach((c, i) => page.drawText(String(c), { x: M + 6 + i * colW, y, size: 10, font }));
        page.drawLine({ start: { x: M, y: y - 5 }, end: { x: W - M, y: y - 5 }, thickness: 0.4, color: rgb(0.85, 0.85, 0.85) });
        y -= 17;
      }
      y -= 10;
    }
  }
  return Buffer.from(await doc.save());
}

export const PDF_EXHIBITS = {
  'P-1': () => makePdf({
    exhibit: 'P-1',
    title: 'Incident Report #MPD-26-03141',
    subtitle: 'Millbrook Police Department · Reporting officer: R. Delgado #4471',
    blocks: [
      { rows: [
        ['Incident type', 'Commercial burglary'],
        ['Location', "Callan's Hardware, 412 Ferris Street, Millbrook"],
        ['Alarm received', 'March 14, 2026, 11:47 PM'],
        ['Officer on scene', 'March 14, 2026, 11:56 PM'],
        ['Reporting party', 'Alarm monitoring company; store manager M. Okafor notified 12:10 AM'],
      ] },
      { heading: 'Narrative' },
      { para: 'Upon arrival I checked the rear lot of the premises. The rear steel service door was ajar. Fresh pry marks were visible adjacent to the latch, approximately 4.5 feet above ground. No persons were present in the lot. The interior was cleared with the assistance of Officer Banks (#5120).' },
      { para: 'Inside, the office desk bottom-left drawer was open and the store cash box was missing. Two display shelves in aisle 6 (power tools) were empty. Store manager Okafor arrived at 12:31 AM and confirmed the cash box and approximately eleven cordless tool kits were missing.' },
      { para: 'One black work glove (right hand) was recovered in the rear lot approximately ten feet from the door and was bagged as item 1. Security footage from the rear camera (CAM 2) was requested from the store.' },
      { pageBreak: true },
      { heading: 'Property recovered' },
      { table: { cols: ['Item', 'Description', 'Disposition'], rows: [
        ['1', 'Black work glove, right hand', 'Sent to lab 03/15'],
        ['2', 'Photographs of rear door (6)', 'Evidence locker'],
        ['3', 'CAM 2 video export (USB)', 'Evidence locker'],
      ] } },
      { heading: 'Follow-up' },
      { para: 'Store manager provided a list of former stockroom employees from the past 24 months. Former employee Dana Whitlock was identified for interview based on familiarity with premises. Interview scheduled for March 16, 2026.' },
    ],
  }),
  'P-4': () => makePdf({
    exhibit: 'P-4',
    title: 'Inventory Loss Statement',
    subtitle: "Callan's Hardware · Prepared by M. Okafor, Store Manager · March 15, 2026",
    blocks: [
      { table: { cols: ['SKU', 'Item', 'Qty', 'Unit cost', 'Total'], rows: [
        ['DW-2040', '20V drill/driver kit', '4', '$189.00', '$756.00'],
        ['MK-1850', '18V impact driver kit', '3', '$219.00', '$657.00'],
        ['RY-0930', 'Combo tool kit (5 pc)', '2', '$349.00', '$698.00'],
        ['BK-2210', 'Cordless circular saw kit', '2', '$229.00', '$458.00'],
        ['CASH', 'Cash box (evening receipts)', '1', '$1,180.00', '$1,180.00'],
        ['', 'Rear door repair estimate', '1', '$465.00', '$465.00'],
      ] } },
      { rows: [['Merchandise + cash', '$3,749.00'], ['Door repair', '$465.00'], ['Total loss', '$4,214.00']] },
      { para: 'I certify that the above reflects inventory counts taken on the morning of March 15, 2026, compared against the closing count of March 14, 2026.' },
    ],
  }),
  'P-6': () => makePdf({
    exhibit: 'P-6',
    title: 'Subscriber Call Detail Records (Excerpt)',
    subtitle: 'Northway Wireless · Subpoena response · Number ending 4417 · March 14, 2026',
    blocks: [
      { table: { cols: ['Time', 'Type', 'Duration', 'Tower / sector'], rows: [
        ['10:58 PM', 'Data', '-', 'MLB-112 / B'],
        ['11:31 PM', 'SMS out', '-', 'MLB-112 / B'],
        ['11:39 PM', 'Voice out', '0:42', 'MLB-118 / A'],
        ['11:52 PM', 'Data', '-', 'MLB-118 / A'],
        ['12:20 AM', 'SMS in', '-', 'MLB-112 / B'],
      ] } },
      { heading: 'Tower notes (from carrier)' },
      { para: 'MLB-112 sector B serves the Brightline Logistics industrial park and the area south of Route 9. MLB-118 sector A serves downtown Millbrook including Ferris Street. Sector coverage areas may overlap by up to 0.8 miles depending on network load.' },
    ],
  }),
  'D-1': () => makePdf({
    exhibit: 'D-1',
    title: 'Employee Timecard Report',
    subtitle: 'Brightline Logistics, Warehouse 3 · Employee: D. Whitlock (#20877) · Week of March 9, 2026',
    blocks: [
      { table: { cols: ['Date', 'Clock in', 'Clock out', 'Hours'], rows: [
        ['Mon 03/09', '3:00 PM', '11:30 PM', '8.0'],
        ['Tue 03/10', '3:02 PM', '11:31 PM', '8.0'],
        ['Thu 03/12', '2:58 PM', '11:30 PM', '8.0'],
        ['Fri 03/13', '3:00 PM', '11:33 PM', '8.0'],
        ['Sat 03/14', '3:01 PM', '11:31 PM', '8.0'],
      ] } },
      { para: 'Clock events are recorded by badge scanner at the Warehouse 3 staff entrance. The scanner clock is synchronized nightly with the company network time server.' },
      { rows: [['Certified by', 'L. Ferreira, HR Records Custodian'], ['Date', 'August 2, 2026']] },
    ],
  }),
};

/* ── Images ────────────────────────────────────────────────────────── */

export const IMAGE_EXHIBITS = {
  'P-2': () => {
    const c = canvas(1200, 800, [150, 92, 76]);
    for (let row = 0; row < 800; row += 40) {
      const offset = (row / 40) % 2 ? 40 : 0;
      for (let x = -offset; x < 1200; x += 80) c.stroke(x, row, 80, 40, [120, 72, 60], 3);
    }
    c.rect(430, 150, 340, 600, [92, 98, 104]);
    c.stroke(430, 150, 340, 600, [60, 64, 68], 6);
    c.rect(720, 420, 26, 60, [180, 182, 176]);
    for (let i = 0; i < 6; i++) c.line(745 + i * 4, 380 + i * 18, 790 + i * 3, 386 + i * 18, [210, 205, 190], 3);
    c.rect(770, 160, 8, 580, [20, 20, 20]);
    c.rect(0, 750, 1200, 50, [70, 70, 70]);
    c.noise(26, 7);
    const caption = 'REAR SERVICE DOOR - 03/15/2026 00:14';
    c.rect(20, 20, c.textWidth(caption, 3) + 28, 44, [255, 255, 255], 0.8);
    c.text(caption, 34, 32, 3, [40, 40, 40]);
    c.circle(770, 420, 70, [255, 220, 60], 0.15);
    c.text('PRY MARKS', 820, 300, 3, [255, 236, 150]);
    c.line(860, 330, 780, 400, [255, 236, 150], 3);
    exhibitTag(c, "PEOPLE'S EXHIBIT P-2");
    return c.toBuffer();
  },
  'P-3': () => {
    const c = canvas(1200, 800, [248, 247, 242]);
    const ink = [60, 70, 80];
    c.text("CALLAN'S HARDWARE - FLOOR PLAN (NOT TO SCALE)", 60, 40, 3, ink);
    c.stroke(60, 90, 1080, 620, ink, 5);
    c.stroke(60, 90, 300, 220, ink, 4); c.text('OFFICE', 150, 140, 3, ink);
    c.rect(120, 220, 120, 50, [200, 190, 160]); c.text('DESK', 146, 236, 3, ink);
    c.circle(130, 262, 9, [190, 70, 60]); c.text('CASH BOX', 250, 250, 2, [190, 70, 60]);
    c.stroke(60, 310, 300, 400, ink, 4); c.text('STOCKROOM', 120, 480, 3, ink);
    c.rect(52, 560, 16, 90, [190, 70, 60]); c.text('REAR DOOR', 80, 600, 2, [190, 70, 60]);
    for (let i = 0; i < 6; i++) {
      c.rect(440 + i * 110, 180, 40, 380, [215, 220, 225]);
      c.text(`A${i + 1}`, 446 + i * 110, 580, 3, ink);
    }
    c.rect(990, 180, 40, 380, [240, 200, 190]);
    c.text('POWER TOOLS', 960, 140, 2, [190, 70, 60]);
    c.rect(560, 640, 260, 50, [200, 190, 160]); c.text('REGISTERS', 600, 656, 3, ink);
    c.rect(1132, 300, 16, 120, [70, 130, 90]); c.text('FRONT', 1050, 440, 2, [70, 130, 90]);
    exhibitTag(c, "PEOPLE'S EXHIBIT P-3");
    return c.toBuffer();
  },
  'P-5': () => {
    const c = canvas(1200, 800, [52, 56, 54]);
    c.rect(0, 520, 1200, 280, [72, 74, 70]);
    c.rect(700, 160, 300, 400, [40, 42, 44]);
    c.rect(760, 260, 120, 260, [28, 30, 30]);
    c.circle(560, 330, 40, [22, 22, 24]);
    c.rect(510, 360, 100, 190, [22, 22, 24]);
    c.rect(520, 550, 32, 110, [24, 24, 26]); c.rect(570, 550, 32, 110, [24, 24, 26]);
    c.circle(200, 120, 90, [230, 220, 170], 0.08);
    c.noise(40, 3);
    c.text('CAM 2  REAR LOT', 30, 30, 3, [235, 235, 235]);
    c.text('03/14/2026  23:42:17', 820, 30, 3, [235, 235, 235]);
    exhibitTag(c, "PEOPLE'S EXHIBIT P-5");
    return c.toBuffer();
  },
  'D-2': () => {
    const c = canvas(1200, 800, [236, 238, 230]);
    const road = [255, 255, 255];
    for (let x = 80; x < 1200; x += 160) c.rect(x, 0, 18, 800, road);
    for (let y = 60; y < 800; y += 140) c.rect(0, y, 1200, 18, road);
    c.rect(0, 480, 1200, 34, [250, 222, 150]); c.text('ROUTE 9', 1000, 524, 2, [120, 90, 30]);
    c.rect(880, 560, 220, 160, [200, 205, 215]); c.text('BRIGHTLINE', 900, 600, 2, [50, 60, 80]); c.text('WAREHOUSE 3', 900, 625, 2, [50, 60, 80]);
    c.circle(250, 210, 16, [190, 70, 60]); c.text("CALLAN'S HARDWARE", 280, 196, 2, [190, 70, 60]); c.text('412 FERRIS ST', 280, 220, 2, [190, 70, 60]);
    const route = [[890, 640], [890, 497], [570, 497], [570, 209], [250, 209]];
    for (let i = 0; i < route.length - 1; i++) c.line(...route[i], ...route[i + 1], [60, 110, 170], 6);
    c.rect(560, 330, 330, 80, [255, 255, 255], 0.9); c.stroke(560, 330, 330, 80, [60, 110, 170], 2);
    c.text('2.4 MILES', 580, 345, 3, [60, 110, 170]); c.text('ABOUT 7 MIN BY CAR', 580, 375, 2, [60, 110, 170]);
    c.text('N', 1130, 40, 4, [80, 80, 80]); c.line(1142, 75, 1142, 130, [80, 80, 80], 4);
    exhibitTag(c, "DEFENSE EXHIBIT D-2");
    return c.toBuffer();
  },
};

/* ── Placeholder audio (generated tones, no copyrighted material) ─── */

function wav(samples, sampleRate) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const SR = 16000;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

export const AUDIO_TRACKS = [
  {
    file: 'placeholder-slow-chords.wav',
    title: 'Slow Chords (placeholder)',
    creator: 'Generated locally',
    kind: 'music',
    description: 'Soft sustained chords. Replace with licensed music.',
    make: () => {
      const chords = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];
      const secs = 48, per = 6, out = new Float32Array(SR * secs);
      for (let i = 0; i < out.length; i++) {
        const t = i / SR, k = Math.floor(t / per) % chords.length, local = t % per;
        const env = Math.min(1, local / 1.5) * Math.min(1, (per - local) / 1.5);
        out[i] = chords[k].reduce((s, m) => s + Math.sin(2 * Math.PI * hz(m) * t) + 0.3 * Math.sin(4 * Math.PI * hz(m) * t), 0) * 0.09 * env;
      }
      return wav(out, SR);
    },
  },
  {
    file: 'placeholder-music-box.wav',
    title: 'Music Box (placeholder)',
    creator: 'Generated locally',
    kind: 'music',
    description: 'Gentle pentatonic plucks. Replace with licensed music.',
    make: () => {
      const scale = [72, 74, 76, 79, 81, 84];
      const secs = 40, out = new Float32Array(SR * secs);
      let seed = 11;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let n = 0; n < secs * 2; n++) {
        const start = Math.floor(n * 0.5 * SR), f = hz(scale[Math.floor(rand() * scale.length)]);
        for (let i = 0; i < SR * 1.6 && start + i < out.length; i++) {
          const t = i / SR;
          out[start + i] += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 3) * 0.22;
        }
      }
      return wav(out, SR);
    },
  },
  {
    file: 'placeholder-audiobook-sample.wav',
    title: 'Audiobook slot (placeholder)',
    creator: 'Generated locally',
    kind: 'audiobook',
    description: 'A short low hum marking where a licensed audiobook would go. See server/media/README.md.',
    make: () => {
      const secs = 20, out = new Float32Array(SR * secs);
      for (let i = 0; i < out.length; i++) {
        const t = i / SR;
        out[i] = (Math.sin(2 * Math.PI * 110 * t) * 0.12 + Math.sin(2 * Math.PI * 165 * t) * 0.06) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.2 * t)) * Math.min(1, t, secs - t);
      }
      return wav(out, SR);
    },
  },
];
