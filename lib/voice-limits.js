import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { neon } from '@neondatabase/serverless';
import { DemoError } from './voice-server.js';

const COOKIE = '__Host-warbler-voice';
const COOKIE_LIFETIME = 30 * 86400;
const unavailable = () => new DemoError(503, 'The voice demo is taking a short break. Please try again later.');
const digest = (secret, value) => createHmac('sha256', secret).update(value).digest('hex');

export function getAdmissionConfig(env = process.env) {
  const databaseUrl = env.VOICE_LIMIT_DATABASE_URL || env.DATABASE_URL;
  let url;
  try { url = new URL(databaseUrl); } catch { throw unavailable(); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.password) throw unavailable();
  return { databaseUrl };
}

export function normalizeNetwork(value) {
  if (typeof value !== 'string' || value.includes('%')) throw unavailable();
  const address = value.trim();
  const version = isIP(address);
  if (version === 4) return address;
  if (version !== 6) throw unavailable();
  // URL canonicalization expands embedded IPv4 to hex before /64 normalization.
  const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1);
  const [left, right = ''] = canonical.split('::');
  const head = left ? left.split(':') : [];
  const tail = right ? right.split(':') : [];
  const words = canonical.includes('::')
    ? [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail]
    : head;
  const blocks = words.map(word => parseInt(word, 16));
  if (blocks.slice(0, 5).every(block => block === 0) && blocks[5] === 65535) {
    return [blocks[6] >> 8, blocks[6] & 255, blocks[7] >> 8, blocks[7] & 255].join('.');
  }
  return blocks.slice(0, 4).map(block => block.toString(16).padStart(4, '0')).join(':') + '::/64';
}

function networkFor(req, env) {
  if (env.VERCEL) {
    // Vercel supplies this header independently of client/proxy X-Forwarded-For.
    // https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for
    return normalizeNetwork(req.headers['x-vercel-forwarded-for']);
  }
  // Local development never trusts arbitrary forwarded headers.
  const address = req.socket?.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) throw unavailable();
  return normalizeNetwork(address);
}

export function identifyVisitor(req, res, secret, env = process.env, now = Date.now()) {
  const network = digest(secret, `network:${networkFor(req, env)}`);
  const supplied = String(req.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  const [id, expires, signature, extra] = (supplied || '').split('.');
  const validShape = !extra && /^[a-f0-9]{48}$/.test(id || '') && /^\d{13}$/.test(expires || '') && /^[a-f0-9]{64}$/.test(signature || '');
  const expected = validShape ? digest(secret, `visitor-cookie:${id}.${expires}`) : null;
  const valid = validShape && Number(expires) > now && Number(expires) <= now + COOKIE_LIFETIME * 1000
    && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  const visitorId = valid ? id : randomBytes(24).toString('hex');
  if (!valid) {
    const expiry = now + COOKIE_LIFETIME * 1000;
    const value = `${visitorId}.${expiry}.${digest(secret, `visitor-cookie:${visitorId}.${expiry}`)}`;
    res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; Max-Age=${COOKIE_LIFETIME}; HttpOnly; Secure; SameSite=Lax`);
  }
  return { visitor: digest(secret, `visitor:${visitorId}`), network };
}

export const RESERVATION_QUERY = `SELECT voice_demo.reserve_admission($1, $2, $3, $4) AS admission`;

export async function reserveAdmission(config, identity, admissionConfig, query) {
  try {
    const sql = query || neon(admissionConfig.databaseUrl).query;
    const rows = await sql(RESERVATION_QUERY,
      [config.agentId, identity.visitor, identity.network, config.dailyLimit],
      { fetchOptions: { signal: AbortSignal.timeout(6000) } });
    const admission = rows?.[0]?.admission;
    if (admission?.allowed === true && admission.retryAfter === 0) return;
    if (admission?.allowed !== false || !['global', 'visitor', 'network'].includes(admission.reason)
      || !Number.isInteger(admission.retryAfter) || admission.retryAfter < 1 || admission.retryAfter > 86400) throw unavailable();
    const message = admission.reason === 'global'
      ? 'The website has reached its 10 demo starts in 24 hours. Please try again after the allowance refreshes.'
      : 'You or someone on this connection has used three demo starts in 24 hours. Please try again after the allowance refreshes.';
    throw new DemoError(429, message, admission.retryAfter);
  } catch (error) {
    if (error instanceof DemoError) throw error;
    // Database errors can contain connection strings or query values. Never log them.
    const safe = unavailable();
    safe.diagnostic = { stage: 'admission', kind: 'unavailable' };
    throw safe;
  }
}
