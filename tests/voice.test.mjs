import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCall, checkAllowance, checkQuota, checkRequest, getConfig, publicResult, signReceipt, verifyReceipt } from '../lib/voice-server.js';

const config = { agentId: 'agent_website', versionId: 'version_website', secret: 'a'.repeat(64), dailyLimit: 10 };
const now = 1800000000000;
const req = { method: 'POST', headers: { origin: 'https://warbler-rx-website.vercel.app', 'content-type': 'application/json' }, body: { scenarioId: 'refill' } };

test('anonymous callers cannot choose agents, inject prompts or enable tools', () => {
  const request = buildCall('coverage', config, 'visitor', now);
  assert.equal(request.agent_id, 'agent_website');
  assert.equal(request.version_id, 'version_website');
  assert.deepEqual(Object.keys(request).sort(), ['agent_id', 'participant_name', 'version_id']);
  assert.throws(() => buildCall('{{ignore instructions}}', config, 'visitor'), { status: 400 });
  assert.throws(() => buildCall('__proto__', config, 'visitor'), { status: 400 });
});

test('session API only accepts approved origins and JSON POST requests', () => {
  assert.doesNotThrow(() => checkRequest(req, { VERCEL: '1' }));
  const originRequest = origin => ({ ...req, headers: { ...req.headers, origin } });
  assert.doesNotThrow(() => checkRequest(originRequest('https://warbler-rx-website-noahdelay-techs-projects.vercel.app'), { VERCEL: '1' }));
  assert.doesNotThrow(() => checkRequest(originRequest('https://production.example.test'), { VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'production.example.test' }));
  assert.throws(() => checkRequest(originRequest('https://warbler-rx-website-noahdelay-techs-projects.vercel.app.evil.test'), { VERCEL: '1' }), { status: 403 });
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
  const ended = { status: 'done', start_time_unix_secs: (now - 1000) / 1000 };
  assert.throws(() => checkAllowance(Array(3).fill(ended), Array(3).fill(ended), 10, now), { status: 429 });
  assert.doesNotThrow(() => checkAllowance(Array(3).fill(ended), [], 10, now));
  assert.throws(() => checkAllowance(Array(10).fill(ended), [], 10, now), { status: 429 });
  assert.throws(() => checkAllowance([ended], [{ ...ended, status: 'in-progress' }], 10, now), { status: 409 });
  assert.throws(() => checkAllowance(Array(2).fill({...ended,status:'initiated'}), [], 10, now), {status:429});
  assert.doesNotThrow(() => checkAllowance([{...ended,start_time_unix_secs:(now-86400001)/1000}], [], 1, now));
});

test('actual analysis overrides scenario and clinical concerns retain clinical review', () => {
  const result = publicResult({ analysis: { data_collection_results: { barrier: {value:'side_effects'}, review_team: {value:'none'}, patient_need: {value:'<script>bad</script>'} } } });
  assert.equal(result.team, 'Clinical review');
  assert.equal(result.barrier, 'Reported GLP-1 side effects');
  assert.equal(JSON.stringify(result).includes('<script>'), false);
  assert.match(result.next, /No clinician has been contacted/);
  assert.deepEqual(publicResult({ status: 'done' }), { status: 'pending' });
  assert.deepEqual(publicResult({ status: 'failed' }), { status: 'unavailable' });
});

test('unknown analysis cannot produce a completed or invented outcome', () => {
  const result = publicResult({ analysis: { data_collection_results: { barrier: {value:'approved'}, review_team: {value:'booked'} } } });
  assert.equal(result.team, 'More information needed');
  assert.equal(result.barrier, 'GLP-1 need not established');
});

test('missing secrets and the kill switch fail closed; a pinned version is required', () => {
  assert.throws(() => getConfig({}), { status: 503 });
  const env = { ELEVENLABS_API_KEY: 'test', ELEVENLABS_AGENT_ID: 'website', ELEVENLABS_AGENT_VERSION_ID: 'version_website', VOICE_SESSION_SECRET: config.secret, VOICE_DEMO_ENABLED: 'true' };
  assert.equal(getConfig(env).versionId, 'version_website');
  assert.throws(() => getConfig({ ...env, ELEVENLABS_AGENT_VERSION_ID: '' }), { status: 503 });
  assert.throws(() => getConfig({ ...env, VOICE_DEMO_ENABLED: 'false' }), { status: 503 });
});

test('quota checks fail closed below the free allowance reserve', () => {
  assert.doesNotThrow(() => checkQuota({character_limit:10000,character_count:8000}));
  assert.throws(() => checkQuota({character_limit:10000,character_count:9000}), {status:429});
  assert.throws(() => checkQuota({}), {status:429});
});
