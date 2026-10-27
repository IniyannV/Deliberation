/**
 * Predictable demo PINs for court cases so users testing the public demo can view previously generated PINs.
 */

export const DEMO_CASE_PINS = {
  'D-1-DC-26-301874': {
    '1': '863462',
    '2': '377793',
    '3': '606667',
    '4': '060801',
    '5': '356725',
    '6': '438289',
    '7': '177224',
    '8': '105733',
    '9': '109656',
    '10': '403991',
    '11': '494894',
    '12': '181719',
    bailiff: '906447',
    display: '673490',
  },
  '26-CR-0418': {
    '1': '178405',
    '2': '452008',
    '3': '123196',
    '4': '579079',
    '5': '319416',
    '6': '911031',
    '7': '590502',
    '8': '778210',
    '9': '411673',
    '10': '009762',
    '11': '318688',
    '12': '822267',
    bailiff: '799429',
    display: '446120',
  },
}

export function getDemoPinsForCase(caseNumber) {
  if (!caseNumber) return DEMO_CASE_PINS['D-1-DC-26-301874']
  return DEMO_CASE_PINS[caseNumber] || DEMO_CASE_PINS['D-1-DC-26-301874']
}
