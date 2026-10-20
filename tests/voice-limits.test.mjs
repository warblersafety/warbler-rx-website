import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdmissionConfig, identifyVisitor, normalizeNetwork, reserveAdmission, RESERVATION_QUERY } from '../lib/voice-limits.js';
import { createStartHandler } from '../api/voice/start.js';
import { getConfig, validateSignedSession, verifyReceipt } from '../lib/voice-server.js';

const secret = 'a'.repeat(64);
const config = { agentId: 'agent_test', versionId: 'version_test', secret, dailyLimit: 10 };
const database = { databaseUrl: 'postgresql://user:password@db.example.test/app' };
const env = { VERCEL: '1', VOICE_DEMO_ENABLED: 'true', ELEVENLABS_API_KEY: 'test-provider-secret', ELEVENLABS_AGENT_ID: config.agentId, ELEVENLABS_AGENT_VERSION_ID: config.versionId, VOICE_SESSION_SECRET: secret, VOICE_LIMIT_DATABASE_URL: database.databaseUrl };
const now = 1800000000000;
const request = (extra = {}) => ({ method: 'POST', body: { scenarioId: 'open' }, headers: { origin: 'https://warbler-health.com', 'content-type': 'application/json', 'x-vercel-forwarded-for': '203.0.113.7', ...extra } });
function response() {
  return { headers: {}, code: 200, body: null, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
const signedUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${config.agentId}&conversation_id=conv_test&conversation_signature=private-signature`;
const providerResponse = body => ({ ok: true, status: 200, async json() { return body; } });
function fakeProvider(events, session = { signed_url: signedUrl }) {
  return async url => {
    if (url.pathname.endsWith('/conversations')) return providerResponse({ conversations: [] });
    if (url.pathname.endsWith('/subscription')) return providerResponse({ character_limit: 100000, character_count: 0 });
    assert.equal(url.pathname, '/v1/convai/conversation/get-signed-url');
    assert.equal(url.searchParams.get('include_conversation_id'), 'true');
    assert.equal(url.searchParams.get('version_id'), config.versionId);
    assert.equal(url.searchParams.has('participant_name'), false);
    events.push('session');
    return providerResponse(session);
  };
}

test('database configuration fails closed and global cap cannot exceed ten', () => {
  assert.throws(() => getAdmissionConfig({}), { status: 503 });
  assert.throws(() => getAdmissionConfig({ DATABASE_URL: 'https://db.example.test' }), { status: 503 });
  assert.deepEqual(getAdmissionConfig({ DATABASE_URL: database.databaseUrl }), database);
  assert.deepEqual(getAdmissionConfig({ VOICE_LIMIT_DATABASE_URL: database.databaseUrl, DATABASE_URL: 'wrong' }), database);
  assert.equal(getConfig({ ...env, VOICE_DAILY_LIMIT: '999' }).dailyLimit, 10);
  assert.equal(getConfig({ ...env, VOICE_DAILY_LIMIT: '2.9' }).dailyLimit, 2);
});

test('signed visitor cookie survives a network change and rejects tampering and expiry', () => {
  const res = response();
  const initial = identifyVisitor(request(), res, secret, env, now);
  assert.match(res.headers['Set-Cookie'], /; Path=\/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax$/);
  const cookie = res.headers['Set-Cookie'].split(';')[0];
  const same = identifyVisitor(request({ cookie, 'x-vercel-forwarded-for': '198.51.100.8' }), response(), secret, env, now + 1000);
  assert.equal(same.visitor, initial.visitor);
  assert.notEqual(same.network, initial.network);
  const forged = identifyVisitor(request({ cookie: cookie.replace(/.$/, cookie.endsWith('a') ? 'b' : 'a') }), response(), secret, env, now + 1000);
  assert.notEqual(forged.visitor, initial.visitor);
  assert.equal(forged.network, initial.network);
  const expired = identifyVisitor(request({ cookie }), response(), secret, env, now + 30 * 86400_000);
  assert.notEqual(expired.visitor, initial.visitor);
  assert.equal(expired.network, initial.network);
  assert.match(initial.visitor, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(initial), /203\.0\.113/);
});

test('cookie clearing cannot change network identity and forwarded spoofing is ignored', () => {
  const first = identifyVisitor(request(), response(), secret, env, now);
  const second = identifyVisitor(request({ 'x-forwarded-for': '198.51.100.99', 'x-real-ip': '198.51.100.88' }), response(), secret, env, now);
  assert.notEqual(first.visitor, second.visitor);
  assert.equal(first.network, second.network);
  for (const value of [undefined, '', 'invalid', '203.0.113.7, 198.51.100.8']) {
    assert.throws(() => identifyVisitor(request({ 'x-vercel-forwarded-for': value, 'x-forwarded-for': '198.51.100.1' }), response(), secret, env), { status: 503 });
  }
  const local = { ...request({ 'x-vercel-forwarded-for': '198.51.100.1' }), socket: { remoteAddress: '127.0.0.1' } };
  const local2 = { ...local, headers: { 'x-forwarded-for': '198.51.100.99' } };
  assert.equal(identifyVisitor(local, response(), secret, {}, now).network, identifyVisitor(local2, response(), secret, {}, now).network);
  assert.throws(() => identifyVisitor({ ...local, socket: { remoteAddress: '198.51.100.1' } }, response(), secret, {}, now), { status: 503 });
});

test('IPv6 privacy address rotations share their /64 and mapped IPv4 shares its IPv4 limit', () => {
  assert.equal(normalizeNetwork('2001:db8:abcd:1234::1'), normalizeNetwork('2001:0db8:abcd:1234:ffff:8888:7777:6666'));
  assert.notEqual(normalizeNetwork('2001:db8:abcd:1234::1'), normalizeNetwork('2001:db8:abcd:1235::1'));
  assert.equal(normalizeNetwork('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(normalizeNetwork('::ffff:cb00:7107'), '203.0.113.7');
  for (const bad of ['2001:db8::1%eth0', '127.1', '', undefined]) assert.throws(() => normalizeNetwork(bad), { status: 503 });
});

test('admission adapter sends only bounded configuration and HMAC identities to the atomic function', async () => {
  const identity = { visitor: 'b'.repeat(64), network: 'c'.repeat(64) };
  await reserveAdmission(config, identity, database, async (query, values) => {
    assert.equal(query, RESERVATION_QUERY);
    assert.deepEqual(values, ['agent_test', identity.visitor, identity.network, 10]);
    assert.doesNotMatch(JSON.stringify(values), /password|version_test/);
    return [{ admission: { allowed: true, reason: null, retryAfter: 0 } }];
  });
  for (const reason of ['global', 'visitor', 'network']) {
    await assert.rejects(reserveAdmission(config, identity, database, async () => [{ admission: { allowed: false, reason, retryAfter: 7234 } }]), { status: 429, retryAfter: 7234 });
  }
});

test('database timeout, corrupt responses and incomplete configuration cannot permit a session or leak secrets', async () => {
  const identity = { visitor: 'b'.repeat(64), network: 'c'.repeat(64) };
  for (const value of [undefined, [], [{ admission: {} }], [{ admission: { allowed: false, reason: 'global', retryAfter: 0 } }], [{ admission: { allowed: true, retryAfter: 3 } }]]) {
    await assert.rejects(reserveAdmission(config, identity, database, async () => value), { status: 503 });
  }
  await assert.rejects(reserveAdmission(config, identity, database, async () => { throw new Error(database.databaseUrl); }), error => {
    assert.equal(error.status, 503);
    assert.doesNotMatch(JSON.stringify(error), /password|db.example/);
    return true;
  });
  let providerCalls = 0;
  const missing = createStartHandler({ env: { ...env, VOICE_LIMIT_DATABASE_URL: '' }, fetchRequest: async () => { providerCalls++; } });
  const res = response(); await missing(request(), res);
  assert.equal(res.code, 503); assert.equal(providerCalls, 0);
});

test('admission happens before the only signed URL grant and receipt matches its validated conversation ID', async () => {
  const events = [];
  const handler = createStartHandler({ env, fetchRequest: fakeProvider(events), admissionQuery: async () => { events.push('reserve'); return [{ admission: { allowed: true, retryAfter: 0 } }]; } });
  const res = response(); await handler(request(), res);
  assert.deepEqual(events, ['reserve', 'session']);
  assert.equal(res.code, 200);
  assert.equal(res.body.signedUrl, signedUrl);
  assert.equal(verifyReceipt(res.body.receipt, secret), 'conv_test');
  assert.doesNotMatch(JSON.stringify(res.body), /test-provider-secret|password|203\.0\.113/);
});

test('denied admissions return the database retry time without obtaining any provider session', async () => {
  const events = [];
  const handler = createStartHandler({ env, fetchRequest: fakeProvider(events), admissionQuery: async () => [{ admission: { allowed: false, reason: 'visitor', retryAfter: 81234 } }] });
  const res = response(); await handler(request(), res);
  assert.equal(res.code, 429); assert.equal(res.headers['Retry-After'], '81234');
  assert.equal(res.body.signedUrl, undefined); assert.deepEqual(events, []);
});

test('invalid website requests and scenarios cannot reserve capacity', async () => {
  let reservations = 0; let requests = 0;
  const handler = createStartHandler({ env, fetchRequest: async () => { requests++; }, admissionQuery: async () => { reservations++; } });
  for (const req of [request({ origin: 'https://evil.example' }), { ...request(), body: { scenarioId: 'fake' } }, { ...request(), method: 'GET' }]) {
    const res = response(); await handler(req, res); assert.ok([400, 403, 405].includes(res.code));
  }
  assert.equal(reservations, 0); assert.equal(requests, 0);
});

test('an uncertain or malformed session response cannot refund an already reserved start', async () => {
  const events = [];
  const handler = createStartHandler({ env, fetchRequest: fakeProvider(events, {}), admissionQuery: async () => { events.push('reserve'); return [{ admission: { allowed: true, retryAfter: 0 } }]; } });
  const res = response(); await handler(request(), res);
  assert.equal(res.code, 503); assert.deepEqual(events, ['reserve', 'session']);
});

test('signed session validation rejects other hosts, agents, missing receipt IDs and unsafe URLs', () => {
  assert.equal(validateSignedSession({ signed_url: signedUrl }, config).conversationId, 'conv_test');
  for (const value of [signedUrl.replace('wss:', 'https:'), signedUrl.replace('api.elevenlabs.io', 'evil.example'), signedUrl.replace('agent_test', 'agent_other'), signedUrl.replace('conv_test', ''), signedUrl.replace('private-signature', ''), signedUrl.replace('/v1/convai/conversation?', '/wrong?'), signedUrl.replace('api.elevenlabs.io', 'user:pass@api.elevenlabs.io'), signedUrl + '#fragment']) {
    assert.throws(() => validateSignedSession({ signed_url: value }, config));
  }
});
