import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load case from server db.json
const dbPath = path.join(rootDir, 'server', 'data', 'db.json');
if (!fs.existsSync(dbPath)) {
  console.error('db.json not found at:', dbPath);
  process.exit(1);
}
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const kase = db.case;
const exhibits = db.exhibits || [];

async function buildOnePagePdf() {
  const isTexas = kase.caseNumber === 'D-1-DC-26-301874' || kase.caption?.includes('Texas');
  const doc = await PDFDocument.create();
  doc.setTitle(`${kase.caption} (${kase.caseNumber}) - Jury Bench Sheet & Verdict Form`);
  doc.setAuthor(kase.court || 'Court');
  doc.setProducer('Deliberation Legal System');
  doc.setSubject('Official 1-Page Jury Deliberation Sheet, Admitted Exhibits Index and Verdict Form');

  // Standard Helvetica fonts for guaranteed 100% compatibility across all PDF engines
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const W = 612; // 8.5 in * 72 pt
  const H = 792; // 11 in * 72 pt
  const M = 36;  // 0.5 in margins for clean 1-page fit
  const contentWidth = W - 2 * M; // 540 pt

  const page = doc.addPage([W, H]);
  let y = H - M;

  function wrapText(text, f, size, maxWidth) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      if (!w) continue;
      const test = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // --- TOP HEADER ---
  const courtHeader = (kase.court || 'DISTRICT COURT').toUpperCase();
  const chW = bold.widthOfTextAtSize(courtHeader, 9.5);
  page.drawText(courtHeader, { x: (W - chW) / 2, y, size: 9.5, font: bold });
  y -= 11;

  const stateHeader = isTexas ? 'STATE OF TEXAS  -  CRIMINAL TERM' : 'STATE OF NEW YORK  -  CRIMINAL TERM';
  const shW = font.widthOfTextAtSize(stateHeader, 8);
  page.drawText(stateHeader, { x: (W - shW) / 2, y, size: 8, font });
  y -= 10;

  // --- CAPTION BOX ---
  const captionTopY = y;
  const captionH = 46;
  const colLeftW = 280;

  page.drawRectangle({
    x: M,
    y: captionTopY - captionH,
    width: contentWidth,
    height: captionH,
    borderWidth: 0.75,
    borderColor: rgb(0, 0, 0),
    color: rgb(1, 1, 1),
  });

  page.drawLine({
    start: { x: M + colLeftW, y: captionTopY },
    end: { x: M + colLeftW, y: captionTopY - captionH },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });

  // Left Caption
  const partyPlaintiff = isTexas ? 'THE STATE OF TEXAS,' : 'THE PEOPLE OF THE STATE OF NEW YORK,';
  const partyDefendant = isTexas ? 'CODY RAY BRENNAN,   Defendant.' : 'DANA WHITLOCK,      Defendant.';
  page.drawText(partyPlaintiff, { x: M + 8, y: captionTopY - 12, size: 8.5, font: bold });
  page.drawText('                    v.', { x: M + 8, y: captionTopY - 22, size: 8, font });
  page.drawText(partyDefendant, { x: M + 8, y: captionTopY - 34, size: 8.5, font: bold });

  // Right Details
  const rightX = M + colLeftW + 10;
  const causeLabel = isTexas ? `CAUSE NO.: ${kase.caseNumber}` : `INDICTMENT NO.: ${kase.caseNumber}`;
  page.drawText(causeLabel, { x: rightX, y: captionTopY - 12, size: 8.5, font: bold });
  page.drawText(`CHARGE: ${kase.counts?.length || 3}-Count Indictment/Charge`, { x: rightX, y: captionTopY - 22, size: 8, font });
  page.drawText('TRIAL TERM: Final Jury Charge & Verdict', { x: rightX, y: captionTopY - 34, size: 7.5, font: italic });

  y = captionTopY - captionH - 8;

  // Title Banner
  const titleText = 'OFFICIAL JURY DELIBERATION BENCH SHEET & VERDICT FORM';
  const ttW = bold.widthOfTextAtSize(titleText, 10);
  page.drawText(titleText, { x: (W - ttW) / 2, y, size: 10, font: bold });
  y -= 12;

  // --- BURDEN OF PROOF BOX ---
  const burdenBoxH = 32;
  page.drawRectangle({
    x: M,
    y: y - burdenBoxH,
    width: contentWidth,
    height: burdenBoxH,
    borderWidth: 0.5,
    borderColor: rgb(0, 0, 0),
    color: rgb(0.96, 0.96, 0.96),
  });

  page.drawText('PRESUMPTION OF INNOCENCE & BURDEN OF PROOF:', { x: M + 6, y: y - 9, size: 7.5, font: bold });
  const burdenLines = wrapText(
    kase.burden + ' The defendant is presumed innocent; guilt must be established on each element beyond a reasonable doubt.',
    font,
    7.5,
    contentWidth - 12
  );
  let by = y - 18;
  for (const bl of burdenLines.slice(0, 2)) {
    page.drawText(bl, { x: M + 6, y: by, size: 7.5, font });
    by -= 9;
  }
  y -= burdenBoxH + 6;

  // --- THE 3 COUNTS AND VERDICT CHECKBOXES ---
  page.drawText('SUBSTANTIVE OFFENSES & OFFICIAL JURY VERDICT (UNANIMOUS VOTE REQUIRED PER COUNT):', { x: M, y, size: 8, font: bold });
  y -= 10;

  for (let i = 0; i < kase.counts.length; i++) {
    const c = kase.counts[i];
    const boxH = 68;

    page.drawRectangle({
      x: M,
      y: y - boxH,
      width: contentWidth,
      height: boxH,
      borderWidth: 0.75,
      borderColor: rgb(0, 0, 0),
      color: rgb(1, 1, 1),
    });

    // Count Header Bar inside box
    page.drawRectangle({
      x: M,
      y: y - 16,
      width: contentWidth,
      height: 16,
      color: rgb(0.93, 0.93, 0.93),
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.5,
    });

    page.drawText(`${c.label.toUpperCase()} (${c.statute})`, {
      x: M + 6,
      y: y - 11,
      size: 8,
      font: bold,
    });

    // Checkboxes on Right Header Bar
    const cbNotGuiltyX = M + contentWidth - 165;
    const cbGuiltyX = M + contentWidth - 75;
    const cbY = y - 13;

    // NOT GUILTY
    page.drawRectangle({ x: cbNotGuiltyX, y: cbY, width: 10, height: 10, borderWidth: 1, borderColor: rgb(0, 0, 0), color: rgb(1, 1, 1) });
    page.drawText('NOT GUILTY', { x: cbNotGuiltyX + 13, y: cbY + 2, size: 7.5, font: bold });

    // GUILTY
    page.drawRectangle({ x: cbGuiltyX, y: cbY, width: 10, height: 10, borderWidth: 1, borderColor: rgb(0, 0, 0), color: rgb(1, 1, 1) });
    page.drawText('GUILTY', { x: cbGuiltyX + 13, y: cbY + 2, size: 7.5, font: bold });

    // Summary
    page.drawText(`Statutory Rule: ${c.summary}`, { x: M + 6, y: y - 24, size: 7, font: italic });

    // Elements (concise bullet lines)
    let elemY = y - 33;
    c.elements.forEach((elem, idx) => {
      const eLines = wrapText(`(${idx + 1}) ${elem}`, font, 6.8, contentWidth - 14);
      for (const el of eLines.slice(0, 1)) {
        page.drawText(el, { x: M + 8, y: elemY, size: 6.8, font });
        elemY -= 8;
      }
    });

    y -= boxH + 5;
  }

  // --- ADMITTED EVIDENCE & EXHIBIT INDEX ---
  y -= 2;
  page.drawText('MASTER ADMITTED EXHIBIT & TESTIMONY INDEX (AVAILABLE IN JURY ROOM & APP):', { x: M, y, size: 8, font: bold });
  y -= 9;

  const exBoxH = 68;
  page.drawRectangle({
    x: M,
    y: y - exBoxH,
    width: contentWidth,
    height: exBoxH,
    borderWidth: 0.5,
    borderColor: rgb(0, 0, 0),
    color: rgb(0.98, 0.98, 0.98),
  });

  // 2-column exhibit list
  const col1X = M + 6;
  const col2X = M + (contentWidth / 2) + 6;

  const exList1 = [
    'P-1 (Pros): Police Incident Report (Officer Delgado, March 14-15)',
    'P-2 (Pros): Photo of Rear Service Door showing fresh pry marks',
    'P-3 (Pros): Store Floor Plan of Callan\'s Hardware (Manager Okafor)',
    'P-4 (Pros): Inventory Loss Statement ($1,180 cash + 11 tool kits = $4,200)',
    'P-5 (Pros): Surveillance Still, Cam 2, 11:42 PM (hooded figure in lot)',
    'P-6 (Pros): Phone Records Excerpt (Cell number ending in 4417)',
  ];

  const exList2 = [
    'P-8 (Pros): Surveillance Video, Cam 2, 11:42 PM (frame-by-frame review)',
    'D-1 (Def): Brightline Logistics Timecard Records (week of March 9)',
    'D-2 (Def): Route & Distance Map (Brightline Warehouse to Ferris St)',
    'Tr-1 (Court): Sworn Testimony Excerpt of Officer Rosa Delgado (MPD)',
    'Tr-2 (Court): Sworn Testimony Excerpt of Store Manager Maya Okafor',
    'Display: Room Projector on closed LAN / Juror iPad touch review',
  ];

  let exY = y - 9;
  for (const item of exList1) {
    page.drawText(item, { x: col1X, y: exY, size: 6.8, font });
    exY -= 9.5;
  }

  exY = y - 9;
  for (const item of exList2) {
    page.drawText(item, { x: col2X, y: exY, size: 6.8, font });
    exY -= 9.5;
  }

  y -= exBoxH + 6;

  // --- JURY DELIBERATION RULES REMINDER ---
  page.drawText(
    'DELIBERATION RULES: All 12 jurors must be present. All votes are secret. Questions for the Judge must be in writing via the Bailiff. Verdict must be unanimous.',
    { x: M, y, size: 7, font: italic }
  );
  y -= 10;

  // --- FOREPERSON CERTIFICATION & SIGNATURES ---
  const certBoxH = 68;
  page.drawRectangle({
    x: M,
    y: y - certBoxH,
    width: contentWidth,
    height: certBoxH,
    borderWidth: 0.75,
    borderColor: rgb(0, 0, 0),
    color: rgb(1, 1, 1),
  });

  page.drawText('UNANIMOUS VERDICT CERTIFICATION:', { x: M + 8, y: y - 11, size: 7.5, font: bold });
  page.drawText(
    `We, the Jury in ${kase.caption} (${causeLabel}), do hereby certify upon our oaths that we have deliberated and unanimously agreed upon the verdict recorded in the checkboxes above.`,
    { x: M + 8, y: y - 21, size: 7, font }
  );

  const sigY = y - 36;
  // Date Line
  page.drawLine({ start: { x: M + 15, y: sigY }, end: { x: M + 175, y: sigY }, thickness: 0.75 });
  page.drawText('Date of Verdict', { x: M + 15, y: sigY - 9, size: 7, font });

  // Foreperson Line
  page.drawLine({ start: { x: M + 230, y: sigY }, end: { x: M + contentWidth - 15, y: sigY }, thickness: 0.75 });
  page.drawText('Foreperson Signature (Seat 1)', { x: M + 230, y: sigY - 9, size: 7.5, font: bold });

  // Court Clerk Receipt line
  const courtRecY = y - 56;
  page.drawLine({ start: { x: M + 8, y: courtRecY + 7 }, end: { x: M + contentWidth - 8, y: courtRecY + 7 }, thickness: 0.4, color: rgb(0.7, 0.7, 0.7) });
  page.drawText('Received in Open Court: ________________________ (Date/Time)     Court Clerk / Bailiff Attestation: ________________________', {
    x: M + 8,
    y: courtRecY - 2,
    size: 6.5,
    font,
  });

  // Footer
  const footerText = `${kase.court.toUpperCase()}  ·  CASE NO. ${kase.caseNumber}  ·  OFFICIAL 1-PAGE BENCH SHEET`;
  const ftW = font.widthOfTextAtSize(footerText, 6.5);
  page.drawText(footerText, {
    x: (W - ftW) / 2,
    y: 18,
    size: 6.5,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  const pdfBytes = await doc.save({ useObjectStreams: false });
  const filename = isTexas ? 'Texas_v_Brennan_Case_D-1-DC-26-301874_Jury_Packet.pdf' : 'People_v_Whitlock_Case_26-CR-0418_Jury_Packet.pdf';
  const outPath = path.join(rootDir, filename);
  fs.writeFileSync(outPath, Buffer.from(pdfBytes));
  console.log(`Generated exactly 1-page PDF: ${outPath} (${doc.getPageCount()} page)`);
  return outPath;
}

buildOnePagePdf().catch(err => {
  console.error('Error generating 1-page PDF:', err);
  process.exit(1);
});
