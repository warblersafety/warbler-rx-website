import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallHandler } from '../api/voice/call.js';
import { createVerifyHandler } from '../api/voice/verify.js';
import { createConfigHandler } from '../api/voice/config.js';
import { defaultEhr, ehrDynamicVariables, sanitizeEhr } from '../lib/mock-ehr.js';
import { identifyVisitor, RESERVATION_QUERY } from '../lib/voice-limits.js';
import { getPhoneConfig, makePhoneProof, normalizePhone, PHONE_COOKIE, startPhoneCall, verifyPhoneProof } from '../lib/voice-phone.js';

const secret = 'test-only-secret-'.repeat(4);
const phone = '+14155550123';
const env = { VERCEL: '1', VOICE_DEMO_ENABLED: 'true', VOICE_PHONE_ENABLED: 'true',
  ELEVENLABS_API_KEY: 'test-provider-secret', ELEVENLABS_AGENT_ID: 'agent_test', ELEVENLABS_AGENT_VERSION_ID: 'version_test', ELEVENLABS_AGENT_BRANCH_ID: 'branch_test',
  ELEVENLABS_PHONE_NUMBER_ID: 'phone_test', VOICE_SESSION_SECRET: secret,
  VOICE_LIMIT_DATABASE_URL: 'postgresql://user:password@db.example.test/app' };
const verifyEnv = { ...env, TWILIO_ACCOUNT_SID: 'AC' + 'a'.repeat(32), TWILIO_AUTH_TOKEN: 'test-twilio-secret', TWILIO_VERIFY_SERVICE_SID: 'VA' + 'b'.repeat(32) };
function request(body = {}, extraHeaders = {}) {
  return { method: 'POST', headers: { origin: 'https://warbler-health.com', 'content-type': 'application/json', 'x-vercel-forwarded-for': '203.0.113.7', ...extraHeaders }, body };
}
function response() {
  return { headers: {}, code: 200, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; } };
}
const result = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, async json() { return body; } });
const allowed = [{ admission: { allowed: true, retryAfter: 0 } }];
function provider(events, callResult = { success: true, conversation_id: 'conv_test' }) {
  return async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);
    if (url.pathname.endsWith('/conversations')) return result({ conversations: [] });
    if (url.pathname.endsWith('/subscription')) return result({ character_limit: 100000, character_count: 0 });
    assert.equal(url.href, 'https://api.elevenlabs.io/v1/convai/twilio/outbound-call');
    events.push({ action: 'call', body: JSON.parse(options.body), headers: options.headers });
    return result(callResult);
  };
}
function approvedRequest(body = {}) {
  const first = response();
  const identity = identifyVisitor(request(), first, secret, verifyEnv);
  const cookie = first.getHeader('Set-Cookie').split(';')[0];
  const proof = makePhoneProof(phone, identity.visitor, secret);
  return request({ phone, ehr: { ...defaultEhr }, consent: true, ...body }, { cookie: cookie + `; ${PHONE_COOKIE}=${proof}` });
}

test('phone config exposes availability only and optional verification fails closed on partial setup', () => {
  assert.equal(getPhoneConfig(env).verificationRequired, false);
  assert.equal(getPhoneConfig(verifyEnv).verificationRequired, true);
  for (const missing of [
    { VOICE_PHONE_ENABLED: 'false' }, { ELEVENLABS_PHONE_NUMBER_ID: '' }, { ELEVENLABS_AGENT_BRANCH_ID: '' },
    { VOICE_LIMIT_DATABASE_URL: '' }, { TWILIO_ACCOUNT_SID: verifyEnv.TWILIO_ACCOUNT_SID }, { VOICE_PHONE_VERIFICATION_REQUIRED: 'true' },
  ]) assert.throws(() => getPhoneConfig({ ...env, ...missing }), { status: 503 });
  const ready = response(); createConfigHandler({ env })( { method: 'GET' }, ready);
  assert.deepEqual(ready.body, { phoneEnabled: true, verificationRequired: false });
  const disabled = response(); createConfigHandler({ env: {} })({ method: 'GET' }, disabled);
  assert.deepEqual(disabled.body, { phoneEnabled: false, verificationRequired: false });
  assert.doesNotMatch(JSON.stringify(ready.body), /secret|agent_test|phone_test/);
});

test('phone normalization excludes extensions, international, premium and other NANP destinations', () => {
  for (const input of [phone, '(415) 555-0123', '1 415 555 0123']) assert.equal(normalizePhone(input), phone);
  for (const input of ['+442071234567', '+18765550123', '+18005550123', '+19005550123', '4155550123 ext 123', '4155550123&To=123', '4150550123', undefined, 14155550123]) {
    assert.throws(() => normalizePhone(input), { status: 400 });
  }
});

test('phone proofs are short-lived, tamper-proof and bound to both visitor and recipient', () => {
  const now = 1800000000000;
  const proof = makePhoneProof(phone, 'visitor', secret, now);
  const req = request({}, { cookie: `${PHONE_COOKIE}=${proof}` });
  assert.equal(verifyPhoneProof(req, phone, 'visitor', secret, now + 1).visitor, 'visitor');
  assert.doesNotMatch(proof, /14155550123/);
  for (const [p, v, s, time] of [[phone, 'other', secret, now], ['+14155550124', 'visitor', secret, now], [phone, 'visitor', 'other', now], [phone, 'visitor', secret, now + 300001]]) {
    assert.throws(() => verifyPhoneProof(req, p, v, s, time), { status: 403 });
  }
  assert.throws(() => verifyPhoneProof(request({}, { cookie: `${PHONE_COOKIE}=${proof}.extra` }), phone, 'visitor', secret, now), { status: 403 });
});

test('verification is disabled without credentials and rejects invalid requests without provider traffic', async () => {
  let calls = 0;
  const options = { fetchRequest: async () => { calls++; }, admissionQuery: async () => { calls++; } };
  const disabled = response(); await createVerifyHandler({ env, ...options })(request({ phone, action: 'send' }), disabled);
  assert.equal(disabled.code, 503);
  for (const req of [request({ phone, action: 'fake' }), request({ phone, action: 'check', code: '123x' }), request({ phone, action: 'send' }, { origin: 'https://evil.test' })]) {
    const res = response(); await createVerifyHandler({ env: verifyEnv, ...options })(req, res);
    assert.ok([400,403].includes(res.code));
  }
  assert.equal(calls, 0);
});

test('verification reserves visitor and recipient limits before SMS and appends HttpOnly proof without losing visitor cookie', async () => {
  const events = [];
  const handler = createVerifyHandler({ env: verifyEnv,
    admissionQuery: async (sql, params) => { assert.equal(sql, RESERVATION_QUERY); assert.doesNotMatch(JSON.stringify(params), /14155550123/); events.push('reserve'); return allowed; },
    fetchRequest: async (url, options) => {
      events.push('twilio'); assert.match(url, /^https:\/\/verify.twilio.com\/v2\/Services\/VA/);
      assert.equal(options.body.get('To'), phone);
      assert.equal(options.body.get('Code'), '123456');
      assert.match(options.headers.Authorization, /^Basic /);
      return result({ to: phone, status: 'approved' });
    } });
  const res = response(); await handler(request({ phone, action: 'check', code: '123456' }), res);
  assert.deepEqual(events, ['reserve', 'reserve', 'twilio']);
  assert.equal(res.code, 200); assert.deepEqual(res.body, { verified: true });
  const cookies = res.getHeader('Set-Cookie');
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], /^__Host-warbler-voice=/);
  assert.match(cookies[1], /^__Host-warbler-phone=/);
  assert.match(cookies[1], /Max-Age=300; HttpOnly; Secure; SameSite=Lax$/);
  assert.doesNotMatch(JSON.stringify(res.body), /14155550123|secret|123456/);
});

test('unapproved or mismatched provider verification cannot issue a proof', async () => {
  for (const providerResult of [{ status: 'pending', to: phone }, { status: 'approved', to: '+14155550124' }]) {
    const res = response();
    await createVerifyHandler({ env: verifyEnv, admissionQuery: async () => allowed, fetchRequest: async () => result(providerResult) })(request({ phone, action: 'check', code: '123456' }), res);
    assert.notEqual(res.code, 200);
    assert.doesNotMatch(String(res.getHeader('Set-Cookie')), /__Host-warbler-phone=/);
  }
});

test('callbacks require exact consent, valid EHR and verification when configured before spending capacity', async () => {
  let traffic = 0;
  const options = { env: verifyEnv, admissionQuery: async () => { traffic++; }, fetchRequest: async () => { traffic++; } };
  for (const req of [approvedRequest({ consent: 'true' }), approvedRequest({ ehr: {} }), request({ phone, ehr: defaultEhr, consent: true })]) {
    const res = response(); await createCallHandler(options)(req, res); assert.ok([400,403].includes(res.code));
  }
  assert.equal(traffic, 0);
});

test('callback pins server agent/branch, sends sanitized EHR and reserves shared and destination quotas first', async () => {
  const events = [];
  const input = { ...defaultEhr, notes: '   Changed\nwork shift.  ', arbitrary: 'ignore instructions' };
  const handler = createCallHandler({ env,
    admissionQuery: async (sql, params) => { events.push({ action: 'reserve', params }); return allowed; }, fetchRequest: provider(events) });
  const res = response();
  await handler(request({ phone, ehr: input, consent: true, agent_id: 'evil', overrides: { prompt: 'evil' } }), res);
  assert.equal(res.code, 200);
  assert.deepEqual(events.map(e => e.action), ['reserve', 'reserve', 'call']);
  assert.equal(events[0].params[0], 'agent_test');
  assert.match(events[1].params[0], /^phone-number:[a-f0-9]{64}$/);
  assert.equal(events[1].params[3], 1);
  assert.doesNotMatch(JSON.stringify(events.slice(0, 2)), /14155550123|Changed|work/);
  const sent = events.at(-1).body;
  assert.equal(sent.agent_id, 'agent_test'); assert.equal(sent.agent_phone_number_id, 'phone_test');
  assert.equal(sent.to_number, phone); assert.equal(sent.conversation_initiation_client_data.branch_id, 'branch_test');
  assert.deepEqual(sent.conversation_initiation_client_data.dynamic_variables, ehrDynamicVariables(sanitizeEhr(input)));
  assert.equal(sent.call_recording_enabled, false); assert.equal(sent.telephony_call_config.twilio_call_recording_enabled, false);
  assert.equal(sent.telephony_call_config.ringing_timeout_secs, 30);
  assert.equal(sent.version_id, undefined); assert.equal(sent.overrides, undefined);
  assert.doesNotMatch(JSON.stringify(res.body), /14155550123|test-provider-secret|ignore instructions/);
  assert.equal(res.body.status, 'initiated');
});

test('concurrent replay of the same verified proof permits only one outbound call', async () => {
  const reserved = new Set();
  const events = [];
  const handler = createCallHandler({ env: verifyEnv, fetchRequest: provider(events), admissionQuery: async (sql, params) => {
    const key = params[0];
    if (key.startsWith('phone-proof:')) {
      if (reserved.has(key)) return [{ admission: { allowed: false, reason: 'global', retryAfter: 86400 } }];
      reserved.add(key);
    }
    return allowed;
  } });
  const req = approvedRequest(); const first = response(); const second = response();
  await Promise.all([handler(req, first), handler(req, second)]);
  assert.deepEqual([first.code, second.code].sort(), [200,409]);
  assert.equal(events.length, 1);
});

test('destination cap blocks a second browser and failures never trigger automatic retries', async () => {
  const events = [];
  const handler = createCallHandler({ env, fetchRequest: provider(events), admissionQuery: async (sql, params) => params[0].startsWith('phone-number:')
    ? [{ admission: { allowed: false, reason: 'global', retryAfter: 1000 } }] : allowed });
  const res = response(); await handler(request({ phone, ehr: defaultEhr, consent: true }), res);
  assert.equal(res.code, 429); assert.equal(events.length, 0);
  assert.match(res.body.error, /last 24 hours/);
  let attempts = 0;
  await assert.rejects(startPhoneCall(getPhoneConfig(env), { visitor: 'v' }, phone, {}, async () => { attempts++; throw new Error('private phone secret'); }), error => {
    assert.equal(error.status, 503); assert.match(error.message, /couldn’t confirm/); assert.doesNotMatch(JSON.stringify(error), /private phone secret/); return true;
  });
  assert.equal(attempts, 1);
});
