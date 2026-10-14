import crypto from 'node:crypto';

export const newId = (prefix) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
export const nowIso = () => new Date().toISOString();

/** An error whose message is safe to send back to the client. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

export const bad = (message) => new HttpError(400, message);

export function str(value, { max = 200, min = 0, field = 'value' } = {}) {
  if (typeof value !== 'string') throw bad(`${field} must be text`);
  const v = value.replace(/\r\n/g, '\n').trim();
  if (v.length < min) throw bad(`${field} is required`);
  if (v.length > max) throw bad(`${field} must be at most ${max} characters`);
  return v;
}

export function optStr(value, opts) {
  if (value === undefined || value === null || value === '') return '';
  return str(value, opts);
}

export function oneOf(value, allowed, field = 'value') {
  if (!allowed.includes(value)) throw bad(`${field} must be one of: ${allowed.join(', ')}`);
  return value;
}

export function isoDateTime(value, field = 'date') {
  const d = new Date(value);
  if (typeof value !== 'string' || Number.isNaN(d.getTime())) throw bad(`${field} must be a valid date`);
  return d.toISOString();
}

export function isoDate(value, field = 'date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw bad(`${field} must be YYYY-MM-DD`);
  return value;
}

export function int(value, { min, max, field = 'value' } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${field} must be a whole number from ${min} to ${max}`);
  return n;
}
