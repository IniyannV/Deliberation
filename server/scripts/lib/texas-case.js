import { makePdf } from './documents.js';
import { canvas, exhibitTag } from './raster.js';

/*
 * A second demo trial under Texas law: intoxication assault (Penal Code
 * § 49.07), failing to stop and render aid (Transportation Code § 550.021)
 * and the lesser-included offense of DWI (Penal Code § 49.04). The statutes
 * and definitions are quoted from Texas law; the people, cause number and
 * events are fictional. Any resemblance to real people or events is coincidental.
 */

export const TEXAS_CASE = {
  caption: 'The State of Texas v. Cody Ray Brennan',
  caseNumber: 'D-1-DC-26-301874',
  court: '427th District Court, Travis County, Texas',
  // Texas Code of Criminal Procedure art. 38.03 and the pattern charge's presumption of innocence.
  burden:
    'All persons are presumed to be innocent, and no person may be convicted of an offense unless each element of the offense is proved beyond a reasonable doubt. The fact that a person has been arrested, confined, indicted or otherwise charged gives rise to no inference of guilt. The State has the burden of proving the defendant guilty, and it must do so by proving each and every element of the offense charged beyond a reasonable doubt. If it fails to do so, you must acquit the defendant. Your verdict on each count must be unanimous.',
  counts: [
    {
      id: 'c1',
      label: 'Count 1: Intoxication Assault',
      statute: 'Texas Penal Code § 49.07(a)(1) (third-degree felony)',
      summary: 'A person commits intoxication assault if the person, by accident or mistake, while operating a motor vehicle in a public place while intoxicated, by reason of that intoxication causes serious bodily injury to another.',
      elements: [
        'The defendant, Cody Ray Brennan, on or about June 6, 2026, in Travis County, Texas, operated a motor vehicle: a gray 2019 Ford F-150 pickup.',
        'He operated it in a public place: Cedar Hollow Road near Bluff Creek Drive.',
        'He was intoxicated while operating it.',
        'By reason of that intoxication, he caused serious bodily injury to Lucía Ferrer by accident or mistake, by striking her bicycle with the pickup.',
      ],
      definitions: [
        { term: 'Intoxicated', text: '(A) Not having the normal use of mental or physical faculties by reason of the introduction of alcohol, a controlled substance, a drug, a dangerous drug, a combination of two or more of those substances, or any other substance into the body; or (B) having an alcohol concentration of 0.08 or more. Texas Penal Code § 49.01(2). You may find either one.' },
        { term: 'Alcohol concentration', text: 'The number of grams of alcohol per 210 liters of breath, per 100 milliliters of blood, or per 67 milliliters of urine. Texas Penal Code § 49.01(1). The State must prove the defendant was intoxicated at the time he was operating the vehicle, not only when his blood was drawn.' },
        { term: 'Serious bodily injury', text: 'Bodily injury that creates a substantial risk of death or that causes death, serious permanent disfigurement, or protracted loss or impairment of the function of any bodily member or organ. Texas Penal Code § 1.07(a)(46).' },
        { term: 'Public place', text: 'Any place to which the public or a substantial group of the public has access, including streets and highways. Texas Penal Code § 1.07(a)(40).' },
        { term: 'Operate', text: 'A person operates a motor vehicle when, under the totality of the circumstances, he takes action to affect the functioning of the vehicle in a manner that would enable its use.' },
        { term: 'Causation', text: 'A person is criminally responsible if the result would not have occurred but for his conduct, operating either alone or concurrently with another cause, unless the concurrent cause was clearly sufficient to produce the result and the conduct of the actor clearly insufficient. Texas Penal Code § 6.04(a).' },
      ],
    },
    {
      id: 'c2',
      label: 'Count 2: Accident Involving Injury (Failure to Stop and Render Aid)',
      statute: 'Texas Transportation Code §§ 550.021, 550.023 (third-degree felony where serious bodily injury results)',
      summary: 'The operator of a vehicle involved in an accident that results, or is reasonably likely to result, in injury to a person must immediately stop at or as close as possible to the scene, determine whether anyone needs aid, and remain until giving his information and rendering reasonable assistance.',
      elements: [
        'The defendant was operating a vehicle involved in an accident on Cedar Hollow Road on or about June 6, 2026.',
        'The accident resulted in injury to Lucía Ferrer.',
        'The defendant knew that the accident had occurred.',
        'The defendant intentionally or knowingly failed to stop at the scene, or as close to it as possible, and remain there until he had given his name, address, vehicle registration and insurance information and rendered reasonable assistance to the injured person.',
      ],
      definitions: [
        { term: 'Reasonable assistance', text: 'Including transporting, or making arrangements for transporting, the injured person to a physician or hospital for medical treatment if it is apparent that treatment is necessary or if the injured person requests it. Texas Transportation Code § 550.023(3).' },
        { term: 'Knowingly', text: 'A person acts knowingly with respect to the nature of his conduct or to circumstances surrounding his conduct when he is aware of the nature of his conduct or that the circumstances exist. Texas Penal Code § 6.03(b). You may infer knowledge from his acts, words and conduct.' },
      ],
    },
    {
      id: 'c3',
      label: 'Lesser-Included Offense of Count 1: Driving While Intoxicated',
      statute: 'Texas Penal Code § 49.04(a) (Class B misdemeanor)',
      summary: 'A person commits an offense if the person is intoxicated while operating a motor vehicle in a public place. Consider this count only if you find the defendant not guilty of Count 1, or if you have a reasonable doubt that he caused the serious bodily injury by reason of intoxication.',
      elements: [
        'The defendant, on or about June 6, 2026, in Travis County, Texas, operated a motor vehicle.',
        'He operated it in a public place: Cedar Hollow Road.',
        'He was intoxicated while operating it.',
      ],
      definitions: [
        { term: 'Intoxicated', text: 'The same meaning as in Count 1: not having the normal use of mental or physical faculties by reason of the introduction of alcohol into the body, or having an alcohol concentration of 0.08 or more.' },
      ],
    },
  ],
};

export const TRANSCRIPT_KOWALSKI = `
THE CLERK: Testimony of Deputy Hannah Kowalski, Travis County Sheriff's Office. Direct examination by Assistant District Attorney Aldana.
Q: Deputy Kowalski, what were you doing on the night of June 6th?
A: I was on patrol in the western district, which covers Cedar Hollow Road.
Q: What call did you receive?
A: At 11:49 p.m. dispatch put out a crash involving a cyclist on Cedar Hollow near Bluff Creek Drive, with the striking vehicle leaving eastbound.
Q: What did the caller describe?
A: A gray or silver full-size pickup, partial Texas plate beginning L-K-T.
Q: What did you do?
A: EMS was already en route, so I ran the partial plate against gray pickups registered nearby. One came back to Cody Brennan, 1.6 miles east of the scene.
Q: When did you get to that address?
A: 12:31 a.m. The pickup was in the driveway. The hood was still warm.
Q: What did you see on the truck?
A: Fresh damage to the right front fender, and the right side mirror was broken off its mount. That is State's Exhibit S-3.
Q: Did you speak with the defendant?
A: Yes, at the front door. I asked if he had been driving on Cedar Hollow. He said yes, and that he thought he had hit a deer or a branch.
Q: Did you notice anything about him?
A: A strong odor of an alcoholic beverage, slurred speech, and red, glassy eyes. He used the door frame to steady himself.
Q: Did he say whether he had been drinking?
A: He said he had a couple of beers at the Rusty Spur, and then one drink at home to calm his nerves after he got back.
Q: Did you perform field sobriety tests?
A: Yes. On horizontal gaze nystagmus I observed six of six clues. On the walk and turn, five of eight. On the one leg stand, three of four.
Q: Did he give a breath sample?
A: He refused. I obtained a search warrant, and his blood was drawn at 2:41 a.m.
Q: Nothing further. Cross-examination by Mr. Kessler.
Q: Deputy, when you walked into the kitchen, what was on the counter?
A: An open bottle of whiskey and a glass with some liquid in it.
Q: That is Defense Exhibit D-1, the still from your body camera?
A: Yes.
Q: You did not see my client drinking before he drove, did you?
A: No, I did not.
Q: And you don't know how much he poured after he got home?
A: Only what he told me. He said one drink.
Q: The bicycle at the scene. Was its rear light on when you inspected it?
A: The switch was in the off position when I looked at it, after EMS had moved it.
Q: Thank you. Nothing further.
THE COURT: The witness may step down.
`.trim();

export const TRANSCRIPT_PRICE = `
THE CLERK: Testimony of Darnell Price. Direct examination by Assistant District Attorney Aldana.
Q: Mr. Price, where were you at about 11:45 on the night of June 6th?
A: Driving home westbound on Cedar Hollow Road, coming up on Bluff Creek Drive.
Q: Was anyone else on the road?
A: A cyclist on the eastbound shoulder, and a pickup coming up behind her eastbound.
Q: How could you see the cyclist?
A: My headlights picked her up. She had a reflective vest on, the yellow kind.
Q: What did you see the pickup do?
A: It drifted right, over the white line onto the shoulder, and the front corner hit her. She went off into the grass.
Q: Was it going fast?
A: Not crazy fast. Maybe the speed limit. It just drifted.
Q: What did the pickup do after that?
A: The brake lights came on for a second, maybe two, and then it kept going east.
Q: What did you do?
A: I turned around, called 911, and stayed with her until EMS came. I gave them the first three letters of the plate, L-K-T.
Q: How was she?
A: She was conscious, but her leg was bent wrong. She kept asking about her bike.
Q: Nothing further. Cross-examination by Mr. Kessler.
Q: Mr. Price, it was dark out there?
A: Yes. There are no streetlights on that stretch.
Q: Did you see a red light on the back of the bicycle?
A: I was coming from the other direction. I could not see the back of it.
Q: So you don't know if the rear light was on?
A: No, sir.
Q: You were looking into the pickup's headlights the whole time?
A: Mostly, yes.
Q: You didn't see who was driving?
A: No. I couldn't see inside the truck.
Q: Thank you. Nothing further.
THE COURT: You may step down, Mr. Price. Thank you.
`.trim();

/* ── PDF exhibits ──────────────────────────────────────────────────── */

const header = `427TH DISTRICT COURT, TRAVIS COUNTY, TEXAS  ·  ${TEXAS_CASE.caseNumber}`;

const TEXAS_PDFS = {
  'S-1': () => makePdf({
    header,
    exhibit: 'S-1',
    title: "Texas Peace Officer's Crash Report (Excerpt)",
    subtitle: "Form CR-3 · Travis County Sheriff's Office · Investigator: Dep. H. Kowalski #4471",
    blocks: [
      { rows: [
        ['Crash ID', 'TCSO-26-0606-2219'],
        ['Date and time', 'June 6, 2026, approx. 11:48 PM'],
        ['Location', 'Cedar Hollow Road, 300 ft west of Bluff Creek Drive, Travis County'],
        ['Road', 'Two-lane rural road, 45 mph, dark, not lighted, dry'],
        ['Unit 1', '2019 Ford F-150, gray, TX plate LKT-4821, eastbound. Driver: Cody Ray Brennan'],
        ['Unit 2', 'Pedalcyclist, eastbound on improved shoulder. Lucía Ferrer, age 34'],
        ['Injury severity', 'Unit 2: suspected serious injury (A). Transported by Travis County EMS'],
      ] },
      { heading: 'Investigator narrative' },
      { para: 'Unit 2 was traveling eastbound on the improved shoulder of Cedar Hollow Road. Unit 1 was traveling eastbound in the eastbound lane. Unit 1 left the lane to the right and its right front struck the left rear of Unit 2. Unit 2 came to rest in the grass south of the shoulder. Unit 1 did not stop and continued eastbound. A witness (Price) driving westbound reported a partial plate.' },
      { para: 'Unit 1 was located at 12:31 AM at the registered owner\'s residence, 1.6 miles east. Damage to the right front fender and right mirror was consistent with the impact. The driver showed signs of intoxication and was arrested after standardized field sobriety tests. Blood specimen obtained under search warrant at 2:41 AM.' },
      { pageBreak: true },
      { heading: 'Contributing factors (investigator opinion)' },
      { table: { cols: ['Unit', 'Factor', 'Basis'], rows: [
        ['1', 'Under influence: alcohol', 'SFSTs; odor; admission'],
        ['1', 'Failed to drive in single lane', 'Witness; tire mark onto shoulder'],
        ['1', 'Left scene of crash', 'Located at residence'],
        ['2', 'None determined', 'Rear lamp switch found OFF post-crash'],
      ] } },
      { heading: 'Evidence collected' },
      { table: { cols: ['Item', 'Description', 'Disposition'], rows: [
        ['1', 'Mirror housing fragment (scene)', 'Property room'],
        ['2', 'Bicycle, rear lamp, vest', 'Property room'],
        ['3', 'Blood kit, 2 gray-top tubes', 'DPS Austin lab'],
        ['4', 'Body-worn camera video', 'Digital evidence'],
      ] } },
    ],
  }),
  'S-4': () => makePdf({
    header,
    exhibit: 'S-4',
    title: 'Laboratory Report: Blood Alcohol Analysis',
    subtitle: 'Texas DPS Crime Laboratory, Austin · Lab case L-26-118842 · Analyst: P. Nguyen',
    blocks: [
      { rows: [
        ['Subject', 'Cody Ray Brennan'],
        ['Requesting agency', "Travis County Sheriff's Office (Dep. H. Kowalski)"],
        ['Specimen', 'Two gray-top blood tubes, seals intact on receipt'],
        ['Collected', 'June 7, 2026, 2:41 AM, by RN T. Lusk under search warrant'],
        ['Received', 'June 8, 2026'],
        ['Method', 'Headspace gas chromatography, dual column'],
      ] },
      { heading: 'Result' },
      { table: { cols: ['Analyte', 'Result', 'Uncertainty (99.7%)'], rows: [
        ['Ethanol', '0.118 g/100 mL', '+/- 0.006 g/100 mL'],
      ] } },
      { para: 'The result is the alcohol concentration of the specimen at the time it was collected. This report does not estimate the alcohol concentration at any earlier time.' },
      { rows: [['Analyst', 'Priya Nguyen, Forensic Scientist II'], ['Technical review', 'D. Holcomb, July 2, 2026']] },
    ],
  }),
  'S-5': () => makePdf({
    header,
    exhibit: 'S-5',
    title: 'Bar Tab Receipt',
    subtitle: 'The Rusty Spur, 8810 Ranch Road 620 · Business records affidavit attached · June 6, 2026',
    blocks: [
      { rows: [['Tab', '#4417 · BRENNAN C'], ['Opened', '8:52 PM'], ['Closed', '11:26 PM (card ending 0915)']] },
      { table: { cols: ['Time', 'Item', 'Qty', 'Price'], rows: [
        ['8:52 PM', 'Shiner Bock pint', '1', '$6.50'],
        ['9:24 PM', 'Shiner Bock pint', '1', '$6.50'],
        ['9:58 PM', 'Shiner Bock pint', '1', '$6.50'],
        ['10:15 PM', 'Brisket tacos', '1', '$12.00'],
        ['10:31 PM', 'Jameson shot', '2', '$16.00'],
        ['10:49 PM', 'Shiner Bock pint', '1', '$6.50'],
        ['11:12 PM', 'Shiner Bock pint', '1', '$6.50'],
      ] } },
      { rows: [['Subtotal', '$60.50'], ['Tip', '$12.00'], ['Total', '$72.50']] },
      { para: 'Certified a true copy of a record kept in the regular course of business by A. Montoya, General Manager.' },
    ],
  }),
  'S-6': () => makePdf({
    header,
    exhibit: 'S-6',
    title: 'Medical Records Summary (Certified, Redacted)',
    subtitle: 'St. Brigid Medical Center Trauma Service · Patient: L. Ferrer · Admitted June 7, 2026',
    blocks: [
      { heading: 'Injuries on admission' },
      { table: { cols: ['Injury', 'Treatment'], rows: [
        ['Open fracture, left tibia and fibula', 'Intramedullary rod, June 7'],
        ['Fracture, left pelvis (superior ramus)', 'Non-operative; protected weight bearing'],
        ['Abrasions, left arm and shoulder', 'Wound care'],
      ] } },
      { rows: [['Length of stay', '9 days (discharged June 16, 2026)'], ['Discharge', 'To inpatient rehabilitation']] },
      { heading: 'Treating surgeon follow-up, September 14, 2026' },
      { para: 'Patient walks with a cane. Fracture is healing but she has not regained full range of motion of the left ankle. Expected recovery to prior function is 9 to 12 months from injury; some permanent loss of ankle motion is likely. She is unable to return to her work as a line cook, which requires standing for long shifts.' },
    ],
  }),
  'D-2': () => makePdf({
    header,
    exhibit: 'D-2',
    title: 'Toxicology Consultation Report',
    subtitle: 'Alan Whitcomb, Ph.D., Forensic Toxicologist · Retained by the defense · August 20, 2026',
    blocks: [
      { heading: 'Question' },
      { para: 'Can Mr. Brennan\'s blood alcohol concentration at about 11:48 PM on June 6 be determined from the 0.118 g/100 mL result of blood drawn at 2:41 AM on June 7?' },
      { heading: 'Information considered' },
      { para: 'DPS lab report S-4; bar receipt S-5; crash report S-1; body-camera video showing an open whiskey bottle and a glass on the kitchen counter at 12:38 AM; Mr. Brennan\'s statement that he drank after arriving home at about 11:55 PM; his height (5 ft 11 in) and weight (205 lb).' },
      { heading: 'Opinion' },
      { para: 'Retrograde extrapolation from a single sample requires knowing whether the subject was still absorbing alcohol and what he drank after driving. Here, drinking at home after the crash is reported but its amount is unknown. A 4 oz pour of 80-proof whiskey at about 12:05 AM could by itself account for roughly 0.06 to 0.08 g/100 mL of the 2:41 AM result.' },
      { para: 'In my opinion, the 2:41 AM result cannot reliably establish that his alcohol concentration was 0.08 or more at the time of driving. I express no opinion on whether he had lost the normal use of his mental or physical faculties.' },
    ],
  }),
};

/* ── Image exhibits ────────────────────────────────────────────────── */

const TEXAS_IMAGES = {
  'S-2': () => {
    const c = canvas(1200, 800, [222, 230, 208]);
    const ink = [50, 60, 70];
    c.text('SCENE DIAGRAM - CEDAR HOLLOW RD AT BLUFF CREEK DR (NOT TO SCALE)', 40, 30, 2, ink);
    c.rect(0, 330, 1200, 170, [96, 98, 100]); // roadway
    c.rect(0, 500, 1200, 40, [150, 148, 140]); // eastbound shoulder
    c.rect(760, 70, 110, 260, [96, 98, 100]); // Bluff Creek Dr
    c.text('BLUFF CREEK DR', 640, 150, 2, ink);
    for (let x = 0; x < 1200; x += 70) if (x < 750 || x > 880) c.rect(x, 412, 40, 6, [240, 210, 70]);
    c.rect(0, 496, 1200, 4, [245, 245, 245]);
    c.text('WESTBOUND', 40, 360, 2, [235, 235, 235]);
    c.text('EASTBOUND', 40, 450, 2, [235, 235, 235]);
    // Unit 1 path, drifting onto the shoulder
    c.line(260, 460, 400, 462, [60, 110, 170], 6);
    c.line(400, 462, 520, 510, [60, 110, 170], 6);
    c.line(520, 510, 700, 470, [60, 110, 170], 6);
    c.line(700, 470, 1140, 460, [60, 110, 170], 6);
    c.line(1120, 446, 1145, 460, [60, 110, 170], 5); c.line(1120, 474, 1145, 460, [60, 110, 170], 5);
    c.rect(170, 440, 90, 40, [170, 172, 176]); c.stroke(170, 440, 90, 40, ink, 2); c.text('1', 208, 450, 3, ink);
    c.text('UNIT 1 CONTINUED EAST 1.6 MI', 820, 560, 2, [60, 110, 170]);
    // Point of impact and final rest
    c.line(505, 495, 535, 525, [200, 50, 40], 5); c.line(535, 495, 505, 525, [200, 50, 40], 5);
    c.text('POI', 500, 560, 3, [200, 50, 40]);
    c.circle(600, 620, 14, [200, 50, 40]); c.text('UNIT 2 FINAL REST', 630, 612, 2, [200, 50, 40]);
    c.line(530, 525, 595, 610, [200, 50, 40], 2);
    c.text('TIRE MARK ONTO SHOULDER', 300, 600, 2, ink);
    c.line(420, 590, 470, 505, ink, 2);
    // Witness vehicle
    c.rect(900, 345, 90, 40, [240, 240, 240]); c.stroke(900, 345, 90, 40, ink, 2); c.text('W', 937, 355, 3, ink);
    c.text('WITNESS PRICE (WB)', 900, 300, 2, ink);
    c.text('N', 1130, 60, 4, [80, 80, 80]); c.line(1142, 95, 1142, 150, [80, 80, 80], 4);
    exhibitTag(c, "STATE'S EXHIBIT S-2");
    return c.toBuffer();
  },
  'S-3': () => {
    const c = canvas(1200, 800, [38, 40, 44]);
    c.rect(0, 600, 1200, 200, [88, 86, 80]); // driveway
    c.rect(80, 180, 1040, 440, [128, 132, 138]); // fender panel
    c.rect(80, 180, 1040, 30, [150, 154, 160]);
    c.circle(860, 640, 150, [30, 30, 32]); c.circle(860, 640, 70, [110, 112, 116]);
    c.circle(520, 380, 120, [100, 104, 110]); // dent
    c.circle(500, 360, 60, [86, 90, 96]);
    for (let i = 0; i < 7; i++) c.line(380 + i * 30, 300 + i * 6, 460 + i * 34, 330 + i * 9, [180, 184, 188], 2);
    c.rect(150, 230, 150, 90, [24, 24, 26]); c.line(150, 230, 300, 320, [90, 90, 92], 3); // broken mirror mount
    c.text('MIRROR MOUNT', 140, 340, 2, [235, 230, 200]);
    c.rect(560, 520, 300, 22, [235, 225, 160]);
    for (let x = 560; x <= 860; x += 30) c.rect(x, 520, 2, 12, [40, 40, 40]);
    c.text('12 IN', 880, 522, 2, [235, 225, 160]);
    c.rect(700, 230, 60, 60, [250, 210, 40]); c.text('1', 722, 248, 4, [30, 30, 30]);
    c.noise(22, 11);
    const caption = '2019 FORD F150 RIGHT FRONT - 06/07/2026 00:44';
    c.rect(20, 20, c.textWidth(caption, 3) + 28, 44, [255, 255, 255], 0.8);
    c.text(caption, 34, 32, 3, [40, 40, 40]);
    exhibitTag(c, "STATE'S EXHIBIT S-3");
    return c.toBuffer();
  },
  'D-1': () => {
    const c = canvas(1200, 800, [70, 62, 54]);
    c.rect(0, 0, 1200, 300, [96, 90, 80]); // cabinets
    for (let x = 40; x < 1200; x += 280) c.stroke(x, 30, 240, 240, [70, 64, 56], 4);
    c.rect(0, 420, 1200, 380, [180, 170, 150]); // counter
    c.rect(0, 410, 1200, 14, [150, 140, 122]);
    c.rect(520, 190, 90, 260, [150, 92, 30], 0.85); c.rect(545, 130, 40, 70, [150, 92, 30], 0.85); // bottle
    c.rect(535, 260, 60, 80, [235, 225, 200]);
    c.rect(520, 330, 90, 120, [110, 64, 20], 0.6); // whiskey level
    c.rect(700, 330, 80, 120, [210, 220, 225], 0.5); c.rect(700, 410, 80, 40, [170, 110, 40], 0.7); // glass
    c.rect(300, 440, 140, 26, [40, 40, 40]); // keys
    c.text('KEYS', 320, 480, 2, [235, 235, 235]);
    c.noise(30, 5);
    c.rect(0, 0, 1200, 60, [0, 0, 0], 0.55);
    c.text('TCSO BWC K4471', 30, 18, 3, [240, 240, 240]);
    c.text('2026-06-07 00:38:12', 820, 18, 3, [240, 240, 240]);
    exhibitTag(c, 'DEFENSE EXHIBIT D-1');
    return c.toBuffer();
  },
};

export const TEXAS_EXHIBITS = [
  { number: 'S-1', title: 'Crash report (Form CR-3 excerpt)', party: 'prosecution', dateAdmitted: '2026-10-19', kind: 'pdf', description: "Deputy H. Kowalski's report of the June 6, 2026 crash on Cedar Hollow Road." },
  { number: 'S-2', title: 'Scene diagram', party: 'prosecution', dateAdmitted: '2026-10-19', kind: 'image', description: 'Point of impact, tire mark onto the shoulder, final rest of the bicycle, witness position.' },
  { number: 'S-3', title: 'Photograph: pickup right front fender', party: 'prosecution', dateAdmitted: '2026-10-19', kind: 'image', description: "Taken 12:44 AM, June 7, 2026, in the defendant's driveway." },
  { number: 'S-4', title: 'DPS lab report: blood alcohol', party: 'prosecution', dateAdmitted: '2026-10-20', kind: 'pdf', description: 'Blood drawn 2:41 AM, June 7, 2026: 0.118 g/100 mL ethanol.' },
  { number: 'S-5', title: 'Bar tab receipt, The Rusty Spur', party: 'prosecution', dateAdmitted: '2026-10-20', kind: 'pdf', description: 'Tab opened 8:52 PM, closed 11:26 PM, June 6, 2026.' },
  { number: 'S-6', title: 'Medical records summary', party: 'prosecution', dateAdmitted: '2026-10-20', kind: 'pdf', description: "Certified and redacted records of Lucía Ferrer's injuries and treatment." },
  { number: 'D-1', title: 'Body-camera still: kitchen counter, 12:38 AM', party: 'defense', dateAdmitted: '2026-10-21', kind: 'image', description: "Open whiskey bottle and glass in the defendant's kitchen." },
  { number: 'D-2', title: 'Toxicology consultation report', party: 'defense', dateAdmitted: '2026-10-21', kind: 'pdf', description: 'Dr. A. Whitcomb on retrograde extrapolation and drinking after driving.' },
  { number: 'Tr-1', title: 'Transcript: Deputy Hannah Kowalski', party: 'court', dateAdmitted: '2026-10-19', kind: 'transcript', text: TRANSCRIPT_KOWALSKI, description: 'Direct and cross-examination.' },
  { number: 'Tr-2', title: 'Transcript: Darnell Price (eyewitness)', party: 'court', dateAdmitted: '2026-10-19', kind: 'transcript', text: TRANSCRIPT_PRICE, description: 'Direct and cross-examination.' },
];

export const TEXAS_JURY = { bailiff: { login: 'B1', name: 'Bailiff J. Ortiz' } };
export const TEXAS_SIGNOFF = { judge: 'Hon. R. Villarreal', prosecution: 'ADA S. Aldana', defense: 'M. Kessler, Esq.', date: '2026-10-22' };

/** One exhibit's file: `{ buffer, ext, mime, type }`. */
export async function renderTexasExhibit(def) {
  if (def.kind === 'pdf') return { buffer: await TEXAS_PDFS[def.number](), ext: '.pdf', mime: 'application/pdf', type: 'pdf' };
  if (def.kind === 'image') return { buffer: TEXAS_IMAGES[def.number](), ext: '.png', mime: 'image/png', type: 'image' };
  if (def.kind === 'transcript') return { buffer: Buffer.from(def.text + '\n', 'utf8'), ext: '.txt', mime: 'text/plain; charset=utf-8', type: 'transcript' };
  throw new Error(`Unknown exhibit kind: ${def.kind}`);
}
