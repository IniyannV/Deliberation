// Demo interactive exhibits. Each is a plain JSON spec; a clerk can upload
// the same shape as a .json file (format documented in server/lib/interactive.js).

const rect = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];

export const MAP_EXHIBIT = {
  kind: 'map',
  title: 'Downtown Millbrook: locations, driving route and cell coverage',
  width: 1000,
  height: 700,
  milesPerUnit: 0.00348, // the 690-unit route below measures 2.4 miles, matching D-2
  areas: [
    { kind: 'park', label: 'Millbrook Commons', points: rect(90, 60, 300, 135) },
    { kind: 'water', label: 'Millbrook River', points: [[700, 0], [745, 0], [700, 190], [770, 320], [1000, 345], [1000, 395], [745, 365], [655, 205]] },
    { kind: 'industrial', label: 'Industrial park', points: rect(560, 465, 990, 690), labelAt: [880, 672] },
    ...[[90, 160, 190, 240], [210, 160, 410, 240], [430, 160, 510, 240], [90, 260, 190, 330], [210, 260, 410, 330],
      [430, 260, 510, 330], [90, 350, 190, 430], [210, 350, 410, 430], [430, 350, 510, 430]].map(([a, b, c, d]) => ({ kind: 'block', label: '', points: rect(a, b, c, d) })),
  ],
  roads: [
    { label: 'Route 9', major: true, points: [[40, 440], [1000, 440]] },
    { label: 'Main St', major: true, points: [[420, 40], [420, 690]] },
    { label: 'Industrial Pkwy', points: [[640, 440], [640, 690]] },
    { label: 'Ferris St', points: [[60, 250], [560, 250]] },
    { label: 'Elm St', points: [[60, 150], [560, 150]] },
    { label: 'Mill Rd', points: [[60, 340], [560, 340]] },
    { label: 'Oak Ave', points: [[200, 40], [200, 440]] },
    { label: 'Cedar St', points: [[520, 40], [520, 440]] },
    { label: 'Warehouse Dr', points: [[640, 560], [900, 560]] },
  ],
  layers: [
    { id: 'places', label: 'Places', on: true },
    { id: 'route', label: 'Driving route (D-2)', on: true },
    { id: 'coverage', label: 'Cell tower coverage (P-6)', on: false },
  ],
  features: [
    { id: 'route', type: 'route', layer: 'route', label: 'Warehouse 3 to Callan’s Hardware', detail: 'About 2.4 miles, roughly 7 minutes by car (Defense Exhibit D-2).', points: [[680, 560], [640, 560], [640, 440], [420, 440], [420, 250], [300, 250]] },
    { id: 'cov118', type: 'circle', layer: 'coverage', x: 330, y: 190, r: 398, label: 'MLB-118 sector A (approx.)', detail: 'Carrier estimate of the area served. Coverage areas may overlap by up to 0.8 miles depending on network load.' },
    { id: 'cov112', type: 'circle', layer: 'coverage', x: 720, y: 600, r: 398, label: 'MLB-112 sector B (approx.)', detail: 'Carrier estimate of the area served. Coverage areas may overlap by up to 0.8 miles depending on network load.' },
    { id: 'store', type: 'marker', layer: 'places', icon: 'store', x: 300, y: 250, label: 'Callan’s Hardware', time: 'Alarm 11:47 PM, March 14', detail: '412 Ferris Street. The rear service door faces the lot watched by camera 2.', exhibits: ['P-2', 'P-3', 'P-5'] },
    { id: 'warehouse', type: 'marker', layer: 'places', icon: 'warehouse', x: 680, y: 560, label: 'Brightline Logistics, Warehouse 3', time: 'Clock-out 11:31 PM, March 14', detail: 'The defendant’s workplace. Clock events are recorded by the badge scanner at the staff entrance.', exhibits: ['D-1'] },
    { id: 't118', type: 'marker', layer: 'places', icon: 'tower', x: 330, y: 190, label: 'Tower MLB-118, sector A', detail: 'Serves downtown Millbrook, including Ferris Street. Handled the 11:39 PM call and the 11:52 PM data session.', exhibits: ['P-6'] },
    { id: 't112', type: 'marker', layer: 'places', icon: 'tower', x: 720, y: 600, label: 'Tower MLB-112, sector B', detail: 'Serves the industrial park and the area south of Route 9. Handled the 10:58 PM data session and the 11:31 PM and 12:20 AM texts.', exhibits: ['P-6'] },
    { id: 'pd', type: 'marker', layer: 'places', icon: 'police', x: 150, y: 390, label: 'Millbrook PD, Sector 4 substation', time: 'Officer on scene 11:56 PM', detail: 'Officer Delgado was on patrol in sector 4 when the alarm call came in.', exhibits: ['P-1'] },
  ],
};

export const LOSS_CHART = {
  kind: 'chart',
  chart: 'bar',
  title: 'Losses by item, March 14, 2026',
  unit: 'USD',
  valuePrefix: '$',
  bars: [
    { label: 'Cash box (evening receipts)', value: 1180, note: 'Cash, 1 box' },
    { label: '20V drill/driver kit', value: 756, note: '4 × $189.00' },
    { label: 'Combo tool kit (5 pc)', value: 698, note: '2 × $349.00' },
    { label: '18V impact driver kit', value: 657, note: '3 × $219.00' },
    { label: 'Rear door repair estimate', value: 465, note: 'Damage to the door, not property taken' },
    { label: 'Cordless circular saw kit', value: 458, note: '2 × $229.00' },
  ],
};

export const PHONE_CHART = {
  kind: 'chart',
  chart: 'events',
  title: 'Phone activity for the number ending 4417, by tower',
  rows: [
    { id: 't112', label: 'MLB-112 · sector B', detail: 'Industrial park, south of Route 9' },
    { id: 't118', label: 'MLB-118 · sector A', detail: 'Downtown, including Ferris Street' },
  ],
  categories: [
    { id: 'data', label: 'Data session' },
    { id: 'sms', label: 'Text message' },
    { id: 'voice', label: 'Voice call' },
  ],
  points: [
    { t: '2026-03-14T22:58:00', row: 't112', category: 'data', label: 'Data session', detail: '10:58 PM, MLB-112 sector B' },
    { t: '2026-03-14T23:31:00', row: 't112', category: 'sms', label: 'Text sent', detail: '11:31 PM, MLB-112 sector B' },
    { t: '2026-03-14T23:39:00', row: 't118', category: 'voice', label: 'Outgoing call, 0:42', detail: '11:39 PM, MLB-118 sector A' },
    { t: '2026-03-14T23:52:00', row: 't118', category: 'data', label: 'Data session', detail: '11:52 PM, MLB-118 sector A' },
    { t: '2026-03-15T00:20:00', row: 't112', category: 'sms', label: 'Text received', detail: '12:20 AM, MLB-112 sector B' },
  ],
  annotations: [
    { t: '2026-03-14T23:31:00', label: 'Clock-out (D-1)' },
    { t: '2026-03-14T23:42:00', label: 'CAM 2 still (P-5)' },
    { t: '2026-03-14T23:47:00', label: 'Alarm' },
    { t: '2026-03-14T23:56:00', label: 'Officer arrives' },
  ],
};
