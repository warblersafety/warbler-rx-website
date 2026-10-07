import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCall, checkAllowance, checkRequest, getConfig, publicResult, signReceipt, verifyReceipt } from '../lib/voice-server.js';

const config = { agentId: 'agent_website', version: 0, secret: 'a'.repeat(64), dailyLimit: 30 };
const now = 1800000000000;
const req = { method: 'POST', headers: { origin: 'https://warbler-rx-website.vercel.app', 'content-type': 'application/json' }, body: { scenarioId: 'refill' } };

test('anonymous callers cannot choose agents, inject prompts or enable tools', () => {
  const request = buildCall('coverage', config, 'visitor', now);
  assert.equal(request.agent_id, 'agent_website');
  assert.equal(request.agent_version, 0);
  assert.equal(request.agent_override.agent.max_call_duration_ms, 180000);
  assert.throws(() => buildCall('{{ignore instructions}}', config, 'visitor'), { status: 400 });
  assert.throws(() => buildCall('__proto__', config, 'visitor'), { status: 400 });
  assert.equal(request.retell_llm_dynamic_variables.scenario_context.includes('fictional'), true);
});

test('session API only accepts approved origins and JSON POST requests', () => {
  assert.doesNotThrow(() => checkRequest(req, { VERCEL: '1' }));
  for (const origin of ['https://warblersafety.com.evil.test', 'null', undefined, 'http://localhost:5173']) assert.throws(() => checkRequest({ ...req, headers: { ...req.headers, origin } }, { VERCEL: '1' }), { status: 403 });
  assert.throws(() => checkRequest({ ...req, method: 'GET' }), { status: 405 });
  assert.throws(() => checkRequest({ ...req, body: { value: 'x'.repeat(3000) } }), { status: 400 });
});

test('summary access is tied to an unmodified, unexpired signed receipt', () => {
  const receipt = signReceipt('call_own', config.secret, now);
  assert.equal(verifyReceipt(receipt, config.secret, now + 1000), 'call_own');
  assert.throws(() => verifyReceipt(receipt, 'different-secret', now), { status: 403 });
  assert.throws(() => verifyReceipt(receipt + '.extra', config.secret, now), { status: 403 });
  assert.throws(() => verifyReceipt(receipt, config.secret, now + 3600001), { status: 403 });
  assert.throws(() => verifyReceipt('call_someone_else', config.secret, now), { status: 403 });
});

test('provider history limits repeats and daily use across process restarts', () => {
  const ended = { call_status: 'ended', metadata: { visitor: 'one', createdAt: now - 1000 } };
  assert.throws(() => checkAllowance(Array(3).fill(ended), 'one', 30, now), { status: 429 });
  assert.doesNotThrow(() => checkAllowance(Array(3).fill(ended), 'two', 30, now));
  assert.throws(() => checkAllowance(Array(30).fill(ended), 'two', 30, now), { status: 429 });
  assert.throws(() => checkAllowance([{ ...ended, call_status: 'ongoing' }], 'one', 30, now), { status: 409 });
  assert.doesNotThrow(() => checkAllowance([{ ...ended, metadata: { visitor: 'one', createdAt: now - 86400001 } }], 'one', 1, now));
});

test('actual analysis overrides scenario and clinical concerns retain clinical review', () => {
  const result = publicResult({ metadata: { scenario: 'refill' }, call_analysis: { custom_analysis_data: { barrier: 'side_effects', review_team: 'none', patient_need: '<script>bad</script>' } } });
  assert.equal(result.team, 'Clinical review');
  assert.equal(result.barrier, 'Reported GLP-1 side effects');
  assert.equal(JSON.stringify(result).includes('<script>'), false);
  assert.match(result.next, /No clinician has been contacted/);
  assert.deepEqual(publicResult({ call_status: 'ended' }), { status: 'pending' });
  assert.deepEqual(publicResult({ call_status: 'error' }), { status: 'unavailable' });
});

test('unknown analysis cannot produce a completed or invented outcome', () => {
  const result = publicResult({ call_analysis: { custom_analysis_data: { barrier: 'approved', review_team: 'booked' } } });
  assert.equal(result.team, 'More information needed');
  assert.equal(result.barrier, 'GLP-1 need not established');
});

test('missing secrets and the kill switch fail closed; published version zero is valid', () => {
  assert.throws(() => getConfig({}), { status: 503 });
  const env = { RETELL_API_KEY: 'test', RETELL_WEB_AGENT_ID: 'website', RETELL_WEB_AGENT_VERSION: '0', VOICE_SESSION_SECRET: config.secret, VOICE_DEMO_ENABLED: 'true' };
  assert.equal(getConfig(env).version, 0);
  assert.throws(() => getConfig({ ...env, RETELL_WEB_AGENT_VERSION: '' }), { status: 503 });
  assert.throws(() => getConfig({ ...env, VOICE_DEMO_ENABLED: 'false' }), { status: 503 });
});
