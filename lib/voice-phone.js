import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { DemoError, getConfig } from './voice-server.js';
import { getAdmissionConfig, reserveAdmission } from './voice-limits.js';

export const PHONE_COOKIE = '__Host-warbler-phone';
const PROOF_LIFETIME = 300_000;
const digest = (secret, value) => createHmac('sha256', secret).update(value).digest('hex');
const unavailable = () => new DemoError(503, 'Phone demos are unavailable right now. You can talk to Warbler in your browser.');

export function getPhoneConfig(env = process.env) {
  const config = getConfig(env);
  const branchId = config.branchId || env.ELEVENLABS_AGENT_BRANCH_ID;
  const phoneNumberId = config.phoneNumberId || env.ELEVENLABS_PHONE_NUMBER_ID;
  if (env.VOICE_PHONE_ENABLED !== 'true'
    || !phoneNumberId || !branchId) throw unavailable();
  const verificationRequired = env.VOICE_PHONE_VERIFICATION_REQUIRED === 'true'
    || [env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_VERIFY_SERVICE_SID].some(Boolean);
  // Partial Verify configuration must not silently weaken an enabled check.
  if (verificationRequired && (!/^AC[a-fA-F0-9]{32}$/.test(env.TWILIO_ACCOUNT_SID || '')
    || !env.TWILIO_AUTH_TOKEN || !/^VA[a-fA-F0-9]{32}$/.test(env.TWILIO_VERIFY_SERVICE_SID || ''))) throw unavailable();
  getAdmissionConfig(env);
  return { ...config, branchId, verificationRequired, phoneNumberId,
    accountSid: env.TWILIO_ACCOUNT_SID, authToken: env.TWILIO_AUTH_TOKEN,
    verifyServiceSid: env.TWILIO_VERIFY_SERVICE_SID };
}

export function getVerifyConfig(env = process.env) {
  const config = getPhoneConfig(env);
  if (!config.verificationRequired) throw unavailable();
  return config;
}

export function normalizePhone(value) {
  if (typeof value !== 'string' || value.length > 30 || !/^[+\d\s().-]+$/.test(value)) {
    throw new DemoError(400, 'Enter your US or Canadian mobile number.');
  }
  let phone = value.replace(/[\s().-]/g, '');
  if (/^\d{10}$/.test(phone)) phone = '+1' + phone;
  else if (/^1\d{10}$/.test(phone)) phone = '+' + phone;
  if (!/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone)) throw new DemoError(400, 'Enter your US or Canadian mobile number.');
  // Other NANP countries and territories also use +1. Do not route this public
  // demo internationally, to premium numbers, or to toll-free destinations.
  const excluded = new Set(['242','246','264','268','284','340','345','441','473','649','658','664','670','671','684','721','758','767','784','787','809','829','849','868','869','876','939','800','833','844','855','866','877','888','900']);
  if (excluded.has(phone.slice(2, 5))) throw new DemoError(400, 'Enter your US or Canadian mobile number.');
  return phone;
}

export function phoneHash(phone, secret) { return digest(secret, `verified-phone:${phone}`); }

export function appendPhoneCookie(res, value, maxAge = PROOF_LIFETIME / 1000) {
  const previous = res.getHeader('Set-Cookie');
  const cookies = previous ? (Array.isArray(previous) ? previous : [previous]) : [];
  res.setHeader('Set-Cookie', [...cookies, `${PHONE_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`]);
}

export function makePhoneProof(phone, visitor, secret, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ phone: phoneHash(phone, secret), visitor,
    nonce: randomBytes(24).toString('hex'), expires: now + PROOF_LIFETIME })).toString('base64url');
  return body + '.' + digest(secret, `phone-proof:${body}`);
}

export function verifyPhoneProof(req, phone, visitor, secret, now = Date.now()) {
  const invalid = () => new DemoError(403, 'Verify your phone number again before requesting a call.');
  const token = String(req.headers.cookie || '').split(';').map(value => value.trim())
    .find(value => value.startsWith(PHONE_COOKIE + '='))?.slice(PHONE_COOKIE.length + 1);
  if (!token || token.length > 800) throw invalid();
  const [body, signature, extra] = token.split('.');
  if (extra || !/^[a-f0-9]{64}$/.test(signature || '')) throw invalid();
  const expected = digest(secret, `phone-proof:${body}`);
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw invalid();
  let proof;
  try { proof = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw invalid(); }
  if (!proof || proof.phone !== phoneHash(phone, secret) || proof.visitor !== visitor
    || !/^[a-f0-9]{48}$/.test(proof.nonce || '') || !Number.isFinite(proof.expires)
    || proof.expires <= now || proof.expires > now + PROOF_LIFETIME) throw invalid();
  return proof;
}

export async function consumePhoneProof(proof, config, identity, admissionConfig, admissionQuery) {
  try {
    // The existing atomic admission row is the one-use claim. Never delete a
    // fresh claim or refund an uncertain outbound request. Only hashed IDs are
    // stored. Expired phone-proof rows can be pruned after 24 hours.
    await reserveAdmission({ ...config, agentId: `phone-proof:${digest(config.secret, config.agentId + ':' + proof.nonce)}`, dailyLimit: 1 }, identity, admissionConfig, admissionQuery);
  } catch (error) {
    if (error instanceof DemoError && error.status === 429) throw new DemoError(409, 'This verification has already been used. Verify your number again to request another call.');
    throw error;
  }
}

export async function reservePhoneAttempt(stage, config, identity, phone, admissionConfig, admissionQuery) {
  try {
    await reserveAdmission({ ...config, agentId: `${config.agentId}:phone-${stage}` }, identity, admissionConfig, admissionQuery);
    await reserveAdmission({ ...config, agentId: `${config.agentId}:phone-${stage}-number` },
      { visitor: phoneHash(phone, config.secret), network: identity.network }, admissionConfig, admissionQuery);
  } catch (error) {
    if (error instanceof DemoError && error.status === 429) {
      throw new DemoError(429, stage === 'call' ? 'The phone demo allowance has been used. Please try again after it refreshes.'
        : 'The phone verification allowance has been used. Please try again after it refreshes.', error.retryAfter);
    }
    throw error;
  }
}

export async function reservePhoneRecipient(config, identity, phone, admissionConfig, admissionQuery) {
  try {
    // One callback per destination per rolling 24 hours across browsers/IPs.
    // Phone numbers never enter the database, and no provider retry is made.
    await reserveAdmission({ ...config, agentId: `phone-number:${digest(config.secret, config.agentId + ':' + phone)}`, dailyLimit: 1 },
      { visitor: phoneHash(phone, config.secret), network: identity.network }, admissionConfig, admissionQuery);
  } catch (error) {
    if (error instanceof DemoError && error.status === 429) throw new DemoError(429, 'This number has already requested a demo call in the last 24 hours. Please use the browser demo or try again later.', error.retryAfter);
    throw error;
  }
}

export async function twilioVerify(config, phone, action, code, fetchRequest = globalThis.fetch) {
  const checking = action === 'check';
  const url = `https://verify.twilio.com/v2/Services/${config.verifyServiceSid}/${checking ? 'VerificationCheck' : 'Verifications'}`;
  const body = new URLSearchParams(checking ? { To: phone, Code: code } : { To: phone, Channel: 'sms' });
  let response;
  try {
    response = await fetchRequest(url, { method: 'POST', body,
      headers: { Authorization: 'Basic ' + Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10000) });
  } catch { throw new DemoError(503, 'We couldn’t complete phone verification. Please try again in a moment.'); }
  if (!response.ok) {
    if (response.status === 429) throw new DemoError(429, 'Too many verification attempts. Please try again later.', 600);
    if ([400, 404].includes(response.status)) throw new DemoError(400, checking ? 'That code is invalid or expired. Check the code or request a new one.' : 'We couldn’t send a code to that number. Check it and try again.');
    throw unavailable();
  }
  let result;
  try { result = await response.json(); } catch { throw unavailable(); }
  if (result.to && result.to !== phone) throw unavailable();
  if (checking && result.status !== 'approved') throw new DemoError(400, 'That code is invalid or expired. Check the code or request a new one.');
  if (!checking && result.status !== 'pending') throw unavailable();
  return result;
}

export async function startPhoneCall(config, identity, phone, dynamicVariables, fetchRequest = globalThis.fetch) {
  const body = { agent_id: config.agentId, agent_phone_number_id: config.phoneNumberId, to_number: phone,
    conversation_initiation_client_data: { branch_id: config.branchId, user_id: identity.visitor, dynamic_variables: dynamicVariables },
    call_recording_enabled: false,
    telephony_call_config: { ringing_timeout_secs: 30, twilio_call_recording_enabled: false } };
  let response;
  try {
    response = await fetchRequest('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
      method: 'POST', headers: { 'xi-api-key': config.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  } catch {
    // Do not retry: the provider may have accepted a request before timing out.
    throw new DemoError(503, 'We couldn’t confirm whether the call started. Wait a minute before trying again.');
  }
  if (!response.ok) throw new DemoError(response.status === 429 ? 429 : 503, 'The phone demo couldn’t connect. Please try again later.');
  let result;
  try { result = await response.json(); } catch { throw new DemoError(503, 'We couldn’t confirm whether the call started. Wait a minute before trying again.'); }
  if (result.success !== true || !/^conv_[a-zA-Z0-9_-]{1,180}$/.test(result.conversation_id || '')) throw new DemoError(503, 'We couldn’t confirm whether the call started. Wait a minute before trying again.');
  return result.conversation_id;
}
