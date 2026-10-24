import { newId, nowIso } from '../../lib/util.js';

/*
 * Shared timelines already filled in for the fictional sample cases, as a
 * jury might build them during deliberation, keyed by case number. The jury
 * app's seed adds one, and so does loading one of these cases however it
 * arrives (Court Admin's "Send to jury iPads" or `npm run import-case`).
 * Any other case starts with an empty timeline. Times are local to this
 * machine, like times a juror types in.
 *
 * Attachments name exhibits by number. An excerpt names a transcript and the
 * text its first line starts with, plus how many lines it spans.
 */

const at = (year, month, day, hour, minute) => new Date(year, month - 1, day, hour, minute).toISOString();

/* ── People v. Dana Whitlock ── */
const WHITLOCK = [
  {
    at: at(2026, 1, 9, 9, 0), type: 'testimony', label: 'Whitlock leaves Callan’s',
    description: 'Okafor: Dana left the stock team in January for a job at Brightline Logistics, on good terms. Exact date not given.',
    attachments: [{ excerpt: 'Tr-2', from: 'Yes. Dana worked for us', lines: 3 }],
  },
  {
    at: at(2026, 1, 23, 9, 0), type: 'testimony', label: 'Rear door code changed',
    description: 'About two weeks after Dana left. Okafor agreed the old code would not have worked on March 14.',
    attachments: [{ excerpt: 'Tr-2', from: 'We changed it in late January', lines: 1 }, { excerpt: 'Tr-2', from: 'No. The old code would not have worked', lines: 1 }],
  },
  {
    at: at(2026, 3, 14, 15, 1), type: 'document', label: 'Whitlock clocks in at Warehouse 3',
    description: 'Brightline badge scanner. Scanner clock is synced nightly to the company time server.',
    attachments: [{ exhibit: 'D-1' }],
  },
  {
    at: at(2026, 3, 14, 22, 58), type: 'document', label: 'Phone data near the warehouse',
    description: 'Number ending 4417 on tower MLB-112 / B (Brightline industrial park, south of Route 9).',
    attachments: [{ exhibit: 'P-6' }],
  },
  {
    at: at(2026, 3, 14, 23, 31), type: 'document', label: 'Whitlock clocks out',
    description: 'Same clock-out time as most nights that week.',
    attachments: [{ exhibit: 'D-1' }],
  },
  {
    at: at(2026, 3, 14, 23, 31), type: 'document', label: 'Text sent, warehouse tower',
    description: 'SMS out from 4417, still on MLB-112 / B.',
    attachments: [{ exhibit: 'P-6' }],
  },
  {
    at: at(2026, 3, 14, 23, 39), type: 'document', label: '42-second call, downtown tower',
    description: 'Voice out on MLB-118 / A, which covers Ferris Street. Carrier notes the sectors can overlap by up to 0.8 miles. Warehouse to store is 2.4 miles, about 7 minutes by car (D-2).',
    attachments: [{ exhibit: 'P-6' }, { exhibit: 'D-2' }],
  },
  {
    at: at(2026, 3, 14, 23, 42), type: 'physical', label: 'Hooded figure on CAM 2',
    description: 'One person in a hooded jacket near the rear door. No face visible. The camera clock was never checked against an official time source.',
    attachments: [{ exhibit: 'P-5' }, { exhibit: 'P-8' }, { excerpt: 'Tr-1', from: 'That is correct. The hood covers the face', lines: 3 }],
  },
  {
    at: at(2026, 3, 14, 23, 47), type: 'testimony', label: 'Alarm at Callan’s Hardware',
    description: 'Dispatch reports the alarm at 412 Ferris Street.',
    attachments: [{ excerpt: 'Tr-1', from: 'Yes. Dispatch reported an alarm', lines: 1 }, { exhibit: 'P-1' }],
  },
  {
    at: at(2026, 3, 14, 23, 52), type: 'document', label: 'Phone data, downtown tower',
    description: 'Data session on MLB-118 / A, five minutes after the alarm.',
    attachments: [{ exhibit: 'P-6' }],
  },
  {
    at: at(2026, 3, 14, 23, 56), type: 'testimony', label: 'Officer Delgado arrives',
    description: 'Rear steel door ajar, fresh pry marks near the latch at about chest height. No one in the lot.',
    attachments: [{ excerpt: 'Tr-1', from: 'I arrived at 11:56 p.m.', lines: 3 }],
  },
  {
    at: at(2026, 3, 15, 0, 5), type: 'physical', label: 'Black work glove found',
    description: 'Right hand, about ten feet from the door. Sent to the lab; no results were presented and it was never matched to the defendant. Time not stated; found during the scene check.',
    attachments: [{ excerpt: 'Tr-1', from: 'A single black work glove', lines: 3 }, { exhibit: 'P-1' }],
  },
  {
    at: at(2026, 3, 15, 0, 14), type: 'physical', label: 'Rear door photographed',
    description: 'Pry marks next to the latch.',
    attachments: [{ exhibit: 'P-2' }],
  },
  {
    at: at(2026, 3, 15, 0, 20), type: 'document', label: 'Text received, warehouse tower',
    description: 'SMS in to 4417, back on MLB-112 / B.',
    attachments: [{ exhibit: 'P-6' }],
  },
  {
    at: at(2026, 3, 15, 0, 31), type: 'document', label: 'Okafor confirms the losses',
    description: 'Cash box ($1,180) missing from the bottom-left office drawer; eleven cordless tool kits gone from aisle 6.',
    attachments: [{ exhibit: 'P-1' }, { exhibit: 'P-3' }],
  },
  {
    at: at(2026, 3, 15, 8, 0), type: 'document', label: 'Inventory count: $4,214 loss',
    description: 'Merchandise and cash $3,749, door repair $465. Counted the morning of March 15.',
    attachments: [{ exhibit: 'P-4' }, { excerpt: 'Tr-2', from: 'About four thousand two hundred dollars', lines: 1 }],
  },
];

/* ── The State of Texas v. Cody Ray Brennan ── */
const BRENNAN = [
  {
    at: at(2026, 6, 6, 20, 52), type: 'document', label: 'Brennan opens a tab at the Rusty Spur',
    description: 'First Shiner Bock pint. Tab #4417, 8810 Ranch Road 620.',
    attachments: [{ exhibit: 'S-5' }],
  },
  {
    at: at(2026, 6, 6, 22, 31), type: 'document', label: 'Two Jameson shots',
    description: 'By now: three pints and brisket tacos (10:15 PM).',
    attachments: [{ exhibit: 'S-5' }],
  },
  {
    at: at(2026, 6, 6, 23, 12), type: 'document', label: 'Last pint ordered',
    description: 'Fifth Shiner Bock of the night. Bar total: five pints and two shots in about 2½ hours.',
    attachments: [{ exhibit: 'S-5' }],
  },
  {
    at: at(2026, 6, 6, 23, 26), type: 'document', label: 'Tab closed',
    description: '$72.50 on the card ending 0915. Brennan told the deputy he had “a couple of beers.”',
    attachments: [{ exhibit: 'S-5' }, { excerpt: 'Tr-1', from: 'He said he had a couple of beers', lines: 1 }],
  },
  {
    at: at(2026, 6, 6, 23, 45), type: 'testimony', label: 'Price sees cyclist and pickup',
    description: 'Driving westbound. His headlights pick up Lucía Ferrer on the eastbound shoulder in a yellow reflective vest, a pickup coming up behind her. No streetlights on that stretch.',
    attachments: [{ excerpt: 'Tr-2', from: 'Driving home westbound on Cedar Hollow', lines: 5 }],
  },
  {
    at: at(2026, 6, 6, 23, 48), type: 'testimony', label: 'Pickup drifts onto shoulder, hits Ferrer',
    description: 'Price: it drifted right over the white line, “maybe the speed limit.” Tire mark onto the shoulder at the point of impact. Price could not see the bike’s rear light or the driver.',
    attachments: [{ excerpt: 'Tr-2', from: 'It drifted right, over the white line', lines: 3 }, { exhibit: 'S-1' }, { exhibit: 'S-2' }],
  },
  {
    at: at(2026, 6, 6, 23, 48), type: 'physical', label: 'Bicycle rear light found off',
    description: 'Switch in the off position when the deputy inspected it, after EMS had moved the bike. Price was coming from the other direction and could not see it.',
    attachments: [{ excerpt: 'Tr-1', from: 'The switch was in the off position', lines: 1 }, { excerpt: 'Tr-2', from: 'I was coming from the other direction', lines: 3 }],
  },
  {
    at: at(2026, 6, 6, 23, 48), type: 'testimony', label: 'Brake lights, then keeps going east',
    description: 'Brake lights for “a second, maybe two,” then the pickup continues eastbound without stopping.',
    attachments: [{ excerpt: 'Tr-2', from: 'The brake lights came on for a second', lines: 1 }],
  },
  {
    at: at(2026, 6, 6, 23, 49), type: 'testimony', label: '911 call; dispatch puts out the crash',
    description: 'Price turns around, calls 911 and stays with Ferrer. Gray or silver full-size pickup, partial plate L-K-T, leaving eastbound.',
    attachments: [{ excerpt: 'Tr-2', from: 'I turned around, called 911', lines: 1 }, { excerpt: 'Tr-1', from: 'At 11:49 p.m. dispatch put out a crash', lines: 3 }],
  },
  {
    at: at(2026, 6, 6, 23, 55), type: 'document', label: 'Brennan gets home (about)',
    description: '1.6 miles east of the scene. Time from his statement, as given in the defense toxicologist’s report.',
    attachments: [{ exhibit: 'D-2' }],
  },
  {
    at: at(2026, 6, 7, 0, 5), type: 'testimony', label: 'Drink at home (time and amount unknown)',
    description: 'Brennan said he had one drink at home “to calm his nerves.” Dr. Whitcomb: a 4 oz whiskey pour around 12:05 AM could by itself account for 0.06–0.08 of the later blood result.',
    attachments: [{ excerpt: 'Tr-1', from: 'Only what he told me. He said one drink', lines: 1 }, { exhibit: 'D-2' }],
  },
  {
    at: at(2026, 6, 7, 0, 31), type: 'testimony', label: 'Deputy Kowalski at Brennan’s house',
    description: 'Pickup in the driveway, hood still warm. Brennan says he was driving on Cedar Hollow and thought he hit “a deer or a branch.” Odor of alcohol, slurred speech, red glassy eyes, steadying himself on the door frame.',
    attachments: [{ excerpt: 'Tr-1', from: '12:31 a.m. The pickup was in the driveway', lines: 9 }],
  },
  {
    at: at(2026, 6, 7, 0, 38), type: 'physical', label: 'Whiskey bottle and glass on the counter',
    description: 'Body-camera still: open whiskey bottle and a glass with some liquid in it, keys beside them.',
    attachments: [{ exhibit: 'D-1' }, { excerpt: 'Tr-1', from: 'An open bottle of whiskey', lines: 1 }],
  },
  {
    at: at(2026, 6, 7, 0, 44), type: 'physical', label: 'Pickup fender photographed',
    description: 'Fresh damage to the right front fender; right mirror broken off its mount. A mirror housing fragment was collected at the scene.',
    attachments: [{ exhibit: 'S-3' }, { excerpt: 'Tr-1', from: 'Fresh damage to the right front fender', lines: 1 }],
  },
  {
    at: at(2026, 6, 7, 0, 50), type: 'testimony', label: 'Field sobriety tests; breath test refused',
    description: 'HGN 6 of 6 clues, walk and turn 5 of 8, one leg stand 3 of 4. Time not stated. Brennan refused a breath sample; the deputy got a search warrant.',
    attachments: [{ excerpt: 'Tr-1', from: 'Yes. On horizontal gaze nystagmus', lines: 3 }],
  },
  {
    at: at(2026, 6, 7, 2, 41), type: 'document', label: 'Blood drawn: 0.118',
    description: 'Under search warrant, almost 3 hours after the crash. The lab reports the level at the draw only, not at the time of driving.',
    attachments: [{ exhibit: 'S-4' }, { exhibit: 'D-2' }],
  },
  {
    at: at(2026, 6, 7, 9, 0), type: 'document', label: 'Ferrer’s leg surgery',
    description: 'Open fracture of the left tibia and fibula (rod placed June 7), fractured pelvis, arm and shoulder abrasions. Time of day not in the records.',
    attachments: [{ exhibit: 'S-6' }],
  },
  {
    at: at(2026, 6, 16, 12, 0), type: 'document', label: 'Ferrer discharged to rehab',
    description: 'After 9 days at St. Brigid Medical Center.',
    attachments: [{ exhibit: 'S-6' }],
  },
  {
    at: at(2026, 9, 14, 10, 0), type: 'document', label: 'Surgeon follow-up',
    description: 'Walks with a cane; some permanent loss of ankle motion likely. Can’t return to work as a line cook.',
    attachments: [{ exhibit: 'S-6' }],
  },
];

export const DEMO_TIMELINES = {
  '26-CR-0418': WHITLOCK,
  'D-1-DC-26-301874': BRENNAN,
};

/** The demo timeline for `caseNumber` (empty if it has none), skipping any attachment whose exhibit or line isn't there. */
export function demoTimeline(caseNumber, exhibits) {
  const byNumber = new Map(exhibits.map((e) => [e.number, e]));
  const attach = (a) => {
    const ex = byNumber.get(a.exhibit ?? a.excerpt);
    if (!ex) return null;
    if (a.exhibit) return { kind: 'exhibit', exhibitId: ex.id };
    const line = ex.lines?.find((l) => l.text.startsWith(a.from));
    if (!line) return null;
    return { kind: 'excerpt', transcriptId: ex.id, fromLine: line.n, toLine: Math.min(line.n + a.lines - 1, ex.lines.length) };
  };
  return (DEMO_TIMELINES[caseNumber] ?? []).map(({ attachments, ...ev }) => ({
    id: newId('ev'),
    ...ev,
    attachments: attachments.map(attach).filter(Boolean),
    version: 1,
    updatedAt: nowIso(),
  }));
}
