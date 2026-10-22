import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSCRIPT_DELGADO, TRANSCRIPT_OKAFOR } from './case-content.js';
import { IMAGE_EXHIBITS, PDF_EXHIBITS } from './documents.js';

/*
 * The fictional demo case's exhibits, shared by the jury app's seed and the
 * court admin app's seed. Every file is generated or read from ./assets.
 */

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');

export const DEMO_EXHIBITS = [
  { number: 'P-1', title: 'Police incident report', party: 'prosecution', dateAdmitted: '2026-09-14', kind: 'pdf', description: 'Report of Officer R. Delgado, March 14–15, 2026.' },
  { number: 'P-2', title: 'Photograph: rear service door', party: 'prosecution', dateAdmitted: '2026-09-14', kind: 'image', description: 'Taken 12:14 AM, March 15, 2026, showing pry marks near the latch.' },
  { number: 'P-3', title: 'Store floor plan', party: 'prosecution', dateAdmitted: '2026-09-14', kind: 'image', description: "Diagram of Callan's Hardware prepared by the store manager." },
  { number: 'P-4', title: 'Inventory loss statement', party: 'prosecution', dateAdmitted: '2026-09-15', kind: 'pdf', description: 'Itemized merchandise, cash and repair losses.' },
  { number: 'P-5', title: 'Surveillance still, CAM 2, 11:42 PM', party: 'prosecution', dateAdmitted: '2026-09-15', kind: 'image', description: 'Rear lot camera frame showing one hooded figure.' },
  { number: 'P-6', title: 'Phone records excerpt', party: 'prosecution', dateAdmitted: '2026-09-16', kind: 'pdf', description: 'Carrier call-detail records for the number ending 4417.' },
  { number: 'D-1', title: 'Brightline timecard records', party: 'defense', dateAdmitted: '2026-09-17', kind: 'pdf', description: "Defendant's clock-in and clock-out times, week of March 9." },
  { number: 'D-2', title: 'Route map: warehouse to store', party: 'defense', dateAdmitted: '2026-09-17', kind: 'image', description: 'Driving route and distance between Warehouse 3 and Ferris Street.' },
  { number: 'Tr-1', title: 'Transcript: Officer Rosa Delgado', party: 'court', dateAdmitted: '2026-09-14', kind: 'transcript', text: TRANSCRIPT_DELGADO, description: 'Direct and cross-examination.' },
  { number: 'Tr-2', title: 'Transcript: Maya Okafor (store manager)', party: 'court', dateAdmitted: '2026-09-15', kind: 'transcript', text: TRANSCRIPT_OKAFOR, description: 'Direct and cross-examination.' },
  { number: 'P-8', title: 'Surveillance video, CAM 2, 11:42 PM', party: 'prosecution', dateAdmitted: '2026-09-15', kind: 'video', file: 'cam2-rear-lot.mp4', description: 'Fourteen seconds of rear-lot footage; the still in P-5 is taken from it.' },
];
/** One demo exhibit's file: `{ buffer, ext, mime, type }`. */
export async function renderDemoExhibit(def) {
  if (def.kind === 'pdf') return { buffer: await PDF_EXHIBITS[def.number](), ext: '.pdf', mime: 'application/pdf', type: 'pdf' };
  if (def.kind === 'image') return { buffer: IMAGE_EXHIBITS[def.number](), ext: '.png', mime: 'image/png', type: 'image' };
  if (def.kind === 'transcript') return { buffer: Buffer.from(def.text + '\n', 'utf8'), ext: '.txt', mime: 'text/plain; charset=utf-8', type: 'transcript' };
  if (def.kind === 'video') return { buffer: fs.readFileSync(path.join(ASSETS, def.file)), ext: '.mp4', mime: 'video/mp4', type: 'video' };
  throw new Error(`Unknown demo exhibit kind: ${def.kind}`);
}
