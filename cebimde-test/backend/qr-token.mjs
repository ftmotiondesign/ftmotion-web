import { randomBytes, createHash } from 'node:crypto';
export function newVisitToken() { return randomBytes(32).toString('base64url'); }
export function tokenHash(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Invalid QR token');
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
export function safeQrPayload(token) {
  tokenHash(token);
  return JSON.stringify({ version: 1, kind: 'cebimde_visit', token });
}
export function parseQrPayload(input) {
  let data;
  try { data = JSON.parse(input); } catch { throw new Error('Invalid QR payload'); }
  if (!data || data.version !== 1 || data.kind !== 'cebimde_visit') throw new Error('Invalid QR payload');
  tokenHash(data.token);
  return data.token;
}
