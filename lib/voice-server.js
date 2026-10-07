import { createHmac, timingSafeEqual } from 'node:crypto';
import Retell from 'retell-sdk';
import { scenarioById } from './scenarios.js';

export class DemoError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function getConfig(env = process.env) {
  const version = Number(env.RETELL_WEB_AGENT_VERSION);
  if (env.VOICE_DEMO_ENABLED !== 'true' || !env.RETELL_API_KEY || !env.RETELL_WEB_AGENT_ID || !env.RETELL_WEB_AGENT_VERSION?.trim() || !Number.isInteger(version) || version < 0 || !env.VOICE_SESSION_SECRET || env.VOICE_SESSION_SECRET.length < 32) {
    throw new DemoError(503, 'The GLP-1 voice demo is taking a short break. Please try again later or book a demo.');
  }
  return { key: env.RETELL_API_KEY, agentId: env.RETELL_WEB_AGENT_ID, version, secret: env.VOICE_SESSION_SECRET, dailyLimit: Math.min(100, Math.max(1, Number(env.VOICE_DAILY_LIMIT) || 30)) };
}

export function checkRequest(req, env = process.env) {
  if (req.method !== 'POST') throw new DemoError(405, 'Please start the demo from the website.');
  const origins = ['https://warbler-rx-website.vercel.app', 'https://warblersafety.com', 'https://www.warblersafety.com'];
  for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) if (host) origins.push(`https://${host}`);
  if (!env.VERCEL) origins.push('http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000');
  if (!origins.includes(req.headers.origin)) throw new DemoError(403, 'Please open the demo on the Warbler website.');
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new DemoError(415, 'Please start the demo from the website.');
  if (Number(req.headers['content-length']) > 2048) throw new DemoError(413, 'The demo request is too large.');
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || JSON.stringify(req.body).length > 2048) throw new DemoError(400, 'Please choose a GLP-1 scenario and try again.');
}

export function fingerprint(req, secret) {
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  return createHmac('sha256', secret).update(`visitor:${ip}`).digest('hex');
}

export function signReceipt(callId, secret, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ callId, expires: now + 3600_000 })).toString('base64url');
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}

export function verifyReceipt(receipt, secret, now = Date.now()) {
  if (typeof receipt !== 'string' || receipt.length > 600) throw new DemoError(403, 'This demo summary is no longer available.');
  const [body, signature, extra] = receipt.split('.');
  const expected = createHmac('sha256', secret).update(body || '').digest('base64url');
  if (extra || !signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new DemoError(403, 'This demo summary is no longer available.');
  let data;
  try { data = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw new DemoError(403, 'This demo summary is no longer available.'); }
  if (!data.callId || !Number.isFinite(data.expires) || data.expires < now) throw new DemoError(403, 'This demo summary is no longer available.');
  return data.callId;
}

export function checkAllowance(calls, visitor, dailyLimit, now = Date.now()) {
  // Provider history persists across serverless instances. Metadata has no names,
  // contact details or transcript content. This is an admission guard, not an
  // atomic billing ceiling: simultaneous requests may pass the same snapshot.
  const recent = calls.filter(c => Number(c.metadata?.createdAt || c.start_timestamp || now) > now - 86400_000);
  if (recent.length >= dailyLimit) throw new DemoError(429, 'Today’s GLP-1 demo sessions are fully booked. Please come back tomorrow or book a demo.');
  const own = recent.filter(c => c.metadata?.visitor === visitor && Number(c.metadata?.createdAt || c.start_timestamp) > now - 3600_000);
  if (own.length >= 3) throw new DemoError(429, 'You’ve tried three GLP-1 conversations this hour. Please try again later or book a demo.');
  const active = recent.filter(c => ['registered', 'not_connected', 'ongoing'].includes(c.call_status) && Number(c.metadata?.createdAt || c.start_timestamp) > now - 210_000);
  if (active.some(c => c.metadata?.visitor === visitor)) throw new DemoError(409, 'A demo is already starting or running on this connection. End it before trying another.');
  if (active.length >= 3) throw new DemoError(429, 'All GLP-1 demo conversations are busy. Please try again in a few minutes.');
}

export function buildCall(scenarioId, config, visitor, now = Date.now()) {
  const scenario = scenarioById(scenarioId);
  if (!scenario) throw new DemoError(400, 'Please choose one of the GLP-1 scenarios.');
  return {
    agent_id: config.agentId, agent_version: config.version,
    retell_llm_dynamic_variables: { scenario_context: scenario.context, scenario_opening: scenario.opening },
    metadata: { surface: 'warbler-website-glp1', scenario: scenario.id, visitor, createdAt: now },
    agent_override: { agent: { max_call_duration_ms: 180000, end_call_after_silence_ms: 30000 } },
  };
}

const labels = { coverage: 'GLP-1 coverage barrier', side_effects: 'Reported GLP-1 side effects', refill: 'GLP-1 refill support', cost: 'GLP-1 affordability concern', delivery: 'GLP-1 supply or delivery concern', treatment_question: 'GLP-1 treatment question', no_barrier: 'No GLP-1 barrier reported', unclear: 'GLP-1 need not established' };
export function publicResult(call) {
  const data = call.call_analysis?.custom_analysis_data;
  if (!data) return { status: ['error', 'not_connected'].includes(call.call_status) ? 'unavailable' : 'pending' };
  const barrier = Object.hasOwn(labels, data.barrier) ? data.barrier : 'unclear';
  const clinical = ['side_effects', 'treatment_question'].includes(barrier) || data.review_team === 'clinical';
  const team = clinical ? 'clinical' : ['pharmacy_support', 'none'].includes(data.review_team) ? data.review_team : 'unclear';
  // Return fixed, reviewed language rather than arbitrary model-generated text.
  const next = {
    clinical: 'A pharmacist or prescribing clinician would review the GLP-1 concern. No clinician has been contacted by this demo.',
    pharmacy_support: 'The pharmacy support team would review the GLP-1 access barrier. No insurance review, order, or follow-up has been arranged.',
    none: 'No staff follow-up was identified in this demo. A plan to request a GLP-1 refill is not a confirmed order or evidence of medication use.',
    unclear: 'There was not enough information to identify a next step for GLP-1 support.',
  };
  return { status: 'ready', barrier: labels[barrier], team: { clinical: 'Clinical review', pharmacy_support: 'Pharmacy support', none: 'No staff follow-up identified', unclear: 'More information needed' }[team], next: next[team] };
}

export function provider(config) { return new Retell({ apiKey: config.key, maxRetries: 0, timeout: 12000 }); }
export function respondError(res, error, operation) {
  const known = error instanceof DemoError;
  if (!known) console.error(JSON.stringify({ event: 'voice_demo_error', operation, status: Number(error.status) || 500 }));
  const status = known ? error.status : 503;
  if (status === 429) res.setHeader('Retry-After', '600');
  return res.status(status).json({ error: known ? error.message : 'We couldn’t connect to the GLP-1 demo. Please try again in a moment.' });
}
