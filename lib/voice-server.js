import { actionResult } from './action-result.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { scenarioById, medicationLabels } from './scenarios.js';

export class DemoError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function getConfig(env = process.env) {
  if (env.VOICE_DEMO_ENABLED !== 'true' || !env.ELEVENLABS_API_KEY || !env.ELEVENLABS_AGENT_ID || !env.ELEVENLABS_AGENT_VERSION_ID || !env.VOICE_SESSION_SECRET || env.VOICE_SESSION_SECRET.length < 32) {
    throw new DemoError(503, 'The GLP-1 voice demo is taking a short break. Please try again later or talk to us.');
  }
  return { key: env.ELEVENLABS_API_KEY, agentId: env.ELEVENLABS_AGENT_ID, versionId: env.ELEVENLABS_AGENT_VERSION_ID, secret: env.VOICE_SESSION_SECRET, dailyLimit: Math.min(10, Math.max(1, Number(env.VOICE_DAILY_LIMIT) || 10)) };
}

export function checkRequest(req, env = process.env) {
  if (req.method !== 'POST') throw new DemoError(405, 'Please start the demo from the website.');
  const origins = ['https://warbler-rx-website.vercel.app', 'https://warbler-rx-website-noahdelay-techs-projects.vercel.app', 'https://warblersafety.com', 'https://www.warblersafety.com', 'https://warbler-health.com', 'https://www.warbler-health.com'];
  for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) if (host) origins.push(`https://${host}`);
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

export function checkAllowance(calls, ownCalls, dailyLimit, now = Date.now()) {
  const recent = calls.filter(c => c.start_time_unix_secs * 1000 > now - 86400_000);
  // One-day allowance requested for October 8, 2026, America/Los_Angeles (PDT).
  // Restore the usual rolling 24-hour cap automatically at midnight, without a redeploy.
  const extraCalls = now >= Date.parse('2026-10-08T00:00:00-07:00') && now < Date.parse('2026-10-09T00:00:00-07:00') ? 10 : 0;
  if (recent.length >= dailyLimit + extraCalls) throw new DemoError(429, 'Today’s GLP-1 demo sessions are fully booked. Please come back tomorrow or talk to us.');
  const own = ownCalls.filter(c => c.start_time_unix_secs * 1000 > now - 3600_000);
  if (own.length >= 3) throw new DemoError(429, 'You’ve tried three GLP-1 conversations this hour. Please try again later or talk to us.');
  const active = c => ['initiated', 'in-progress'].includes(c.status) && c.start_time_unix_secs * 1000 > now - 150_000;
  if (own.some(active)) throw new DemoError(409, 'A demo is already starting or running on this connection. End it before trying another.');
  if (recent.filter(active).length >= 2) throw new DemoError(429, 'All GLP-1 demo conversations are busy. Please try again in a few minutes.');
}

export function checkQuota(subscription) {
  const remaining = Number(subscription.character_limit) - Number(subscription.character_count);
  if (!Number.isFinite(remaining) || remaining < 1500) throw new DemoError(429, 'The voice demo has reached its available allowance. Please try again after it refreshes or talk to us.');
}

export function buildCall(scenarioId, config, visitor) {
  if (!scenarioById(scenarioId)) throw new DemoError(400, 'Please choose one of the GLP-1 scenarios.');
  return { agent_id: config.agentId, version_id: config.versionId, participant_name: visitor };
}

const labels = { routine: 'Routine changes', renewal: 'Refill or renewal delays', coverage: 'GLP-1 coverage barrier', side_effects: 'Reported GLP-1 side effects', refill: 'GLP-1 refill support', cost: 'GLP-1 affordability concern', delivery: 'GLP-1 supply or delivery concern', treatment_question: 'GLP-1 treatment question', no_barrier: 'No GLP-1 barrier reported', unclear: 'GLP-1 need not established' };
// Only a short supply phrase quoted from a user turn can leave the server.
// Keep the original units and wording; do not expose arbitrary analysis or transcript text.
export function reportedSupply(value, transcript = []) {
  if (typeof value !== 'string' || value.length > 80 || !Array.isArray(transcript)) return null;
  const phrase = value.trim();
  const quantity = '(?:\\d{1,3}(?:[.½]\\d{0,2})?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|a half|half a|a couple of|a few|several)';
  const units = '(?:days?|weeks?|months?|hours?|injections?|doses?|pens?|pills?|tablets?|capsules?|vials?|milliliters?|m[lL])';
  const supply = new RegExp('^(?:(?:about|around|roughly|approximately|just|only|less than|more than) )?' + quantity + '(?: (?:and a half|to ' + quantity + '))? ' + units + '(?: (?:left|remaining|of medication|worth))?$', 'i');
  if (!supply.test(phrase) && !/^(?:none|no medication|nothing|running low|almost out)$/i.test(phrase)) return null;
  const normalize = text => text.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ');
  const quoted = normalize(phrase);
  const escaped = quoted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactPhrase = new RegExp('(?:^|[^a-z0-9])' + escaped + '(?=$|[^a-z0-9])');
  return transcript.some(turn => turn.role === 'user' && typeof turn.message === 'string' &&
    exactPhrase.test(normalize(turn.message))) ? phrase : null;
}

export function publicResult(call) {
  const fields = call.analysis?.data_collection_results;
  if (!fields) return { status: call.status === 'failed' ? 'unavailable' : 'pending' };
  const data = { barrier: fields.barrier?.value, review_team: fields.review_team?.value };
  const barrier = Object.hasOwn(labels, data.barrier) ? data.barrier : 'unclear';
  const routing = fields.clinical_routing?.value;
  const emergency = routing === 'emergency';
  const clinical = emergency || ['side_effects', 'treatment_question'].includes(barrier) || data.review_team === 'clinical';
  const team = clinical ? 'clinical' : ['pharmacy_support', 'none'].includes(data.review_team) ? data.review_team : 'unclear';
  // Return fixed, reviewed language rather than arbitrary model-generated text.
  const next = {
    clinical: 'Clinical care team review was identified. Permission for follow-up was not confirmed. No clinician has been contacted by this demo.',
    pharmacy_support: 'The pharmacy support team would review the GLP-1 access barrier. No insurance review, order, or follow-up has been arranged.',
    none: 'No staff follow-up was identified in this demo. A plan to request a GLP-1 refill is not a confirmed order or evidence of medication use.',
    unclear: 'There was not enough information to identify a next step for GLP-1 support.',
  };
  const medication = fields.medication?.value;
  let barrierLabel = barrier === 'side_effects'
    ? `Reported ${Object.hasOwn(medicationLabels, medication) ? medicationLabels[medication] : 'medication'} side effect`
    : labels[barrier];
  const schedulingPreview = clinical && !emergency && routing === 'accepted';
  let teamLabel = { clinical: 'Clinical care team', pharmacy_support: 'Pharmacy support', none: 'No staff follow-up identified', unclear: 'More information needed' }[team];
  let nextText = next[team];
  if (schedulingPreview) {
    teamLabel = 'Automatic scheduling';
    nextText = 'Based on the clinical care team’s availability. Demo preview only — no appointment has been booked or clinician contacted.';
  } else if (emergency) {
    teamLabel = 'Immediate medical help';
    nextText = 'If this is happening now, seek immediate help through local emergency services. This demo cannot provide care or arrange emergency help.';
  } else if (clinical && routing === 'declined') {
    teamLabel = 'Clinical follow-up declined';
    nextText = 'The patient declined clinical follow-up. No scheduling or clinician contact will occur through this demo.';
  }
  let costPreview = false;
  if (barrier === 'cost' && !clinical) {
    const supply = reportedSupply(fields.remaining_supply?.value, call.transcript);
    barrierLabel = `Barrier ID: Cost with ${supply || 'supply not established'}`;
    const resources = fields.cost_resources?.value === 'accepted';
    const appointment = fields.cost_appointment?.value === 'accepted';
    const actions = [];
    if (resources) actions.push('Text sent with resources');
    if (appointment) actions.push('Appointment auto-scheduled with the customer success team');
    costPreview = resources || appointment;
    teamLabel = actions.length ? actions.join(' · ') : 'No cost-support next step agreed';
    nextText = 'Simulated outcomes only — no text has been sent and no appointment has been booked.';
    if (!resources) nextText += fields.cost_resources?.value === 'declined' ? ' Resource text declined.' : ' Resource-text permission not confirmed.';
    if (!appointment) nextText += fields.cost_appointment?.value === 'declined' ? ' Financial-support appointment declined.' : ' Appointment permission not confirmed.';
  }
  return { status: 'ready', barrier: barrierLabel, team: teamLabel, next: nextText, schedulingPreview, costPreview, ...actionResult(fields, { barrier, clinical, emergency, nextText }) };

}

const providerStages = new Set(['history', 'visitor_history', 'subscription', 'session_token', 'conversation_result']);
export function provider(config, fetchRequest = globalThis.fetch) {
  return async (path, query = {}, stage = 'provider_request') => {
    const safeStage = providerStages.has(stage) ? stage : 'provider_request';
    const started = Date.now();
    const url = new URL(path, 'https://api.elevenlabs.io');
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, String(value));
    let response;
    try {
      response = await fetchRequest(url, { headers: { 'xi-api-key': config.key }, signal: AbortSignal.timeout(12000) });
    } catch (cause) {
      const error = new Error('ElevenLabs request failed');
      error.diagnostic = { stage: safeStage, kind: ['TimeoutError', 'AbortError'].includes(cause?.name) ? 'timeout' : 'network', elapsedMs: Date.now() - started };
      throw error;
    }
    if (!response.ok) {
      const error = response.status === 429
        ? new DemoError(429, 'The GLP-1 voice demo is busy or has reached its allowance. Please try again later.')
        : new Error('ElevenLabs request failed');
      error.status = response.status;
      error.diagnostic = { stage: safeStage, kind: 'http', providerStatus: response.status, elapsedMs: Date.now() - started };
      throw error;
    }
    try { return await response.json(); }
    catch {
      const error = new Error('Invalid ElevenLabs response');
      error.diagnostic = { stage: safeStage, kind: 'invalid_json', providerStatus: response.status, elapsedMs: Date.now() - started };
      throw error;
    }
  };
}
export function respondError(res, error, operation) {
  const known = error instanceof DemoError;
  if (!known || error.diagnostic) console.error(JSON.stringify({ event: 'voice_demo_error', operation, status: Number(error.status) || 500, ...error.diagnostic }));
  const status = known ? error.status : 503;
  if (status === 429) res.setHeader('Retry-After', '600');
  return res.status(status).json({ error: known ? error.message : 'We couldn’t connect to the GLP-1 demo. Please try again in a moment.' });
}
